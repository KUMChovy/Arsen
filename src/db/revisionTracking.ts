import type { DBCore, DBCoreMutateRequest, DBCoreTransaction, Dexie } from 'dexie'

const metadataTable = 'localMetadata'
export const CONTRACT_TABLE_NAMES = [
  'settings', 'deloadCycles', 'routines', 'routineDays', 'routineExercises', 'exerciseCatalog', 'exerciseAssets',
  'weeklyVolumeTargets', 'workoutSessions', 'exerciseLogs', 'setLogs', 'dropSetLogs', 'skipLogs',
] as const
const contractTables = new Set<string>(CONTRACT_TABLE_NAMES)

function isBackupMarkerOnly(name: string, request: DBCoreMutateRequest) {
  return name === 'settings' && request.type === 'put' && request.changeSpec !== undefined
    && Object.keys(request.changeSpec).length === 1 && Object.hasOwn(request.changeSpec, 'lastContractBackupSha256')
}

function incrementRevision(transaction: DBCoreTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    const native = transaction as IDBTransaction
    const fail = (error: unknown) => {
      try { native.abort() } catch { /* already inactive */ }
      reject(error)
    }
    try {
      const store = native.objectStore(metadataTable)
      const read = store.get('revision')
      read.onerror = () => fail(read.error)
      read.onsuccess = () => {
        try {
          if (!read.result) throw new Error('Falta la revisión local de los datos')
          const previous = read.result.value
          if (!Number.isSafeInteger(previous) || previous < 0 || previous >= Number.MAX_SAFE_INTEGER) throw new Error('La revisión local no es válida')
          const write = store.put({ id: 'revision', value: previous + 1 })
          write.onerror = () => fail(write.error)
          write.onsuccess = () => resolve()
        } catch (error) {
          fail(error)
        }
      }
    } catch (error) {
      fail(error)
    }
  })
}

export function installRevisionTracking(database: Dexie) {
  const tracked = new WeakMap<DBCoreTransaction, Promise<void>>()
  database.use({
    stack: 'dbcore',
    name: 'arsen-local-revision',
    create(down: DBCore): DBCore {
      return {
        ...down,
        transaction(stores, mode, options) {
          return down.transaction(mode === 'readwrite' && stores.some((store) => contractTables.has(store)) ? [...new Set([...stores, metadataTable])] : stores, mode, options)
        },
        table(name) {
          const table = down.table(name)
          if (!contractTables.has(name)) return table
          return {
            ...table,
            async mutate(request) {
              const response = await table.mutate(request)
              if (isBackupMarkerOnly(name, request)) return response
              const pending = tracked.get(request.trans) ?? incrementRevision(request.trans)
              tracked.set(request.trans, pending)
              await pending
              return response
            },
          }
        },
      }
    },
  })
}
