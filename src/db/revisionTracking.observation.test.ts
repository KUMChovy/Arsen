import Dexie from 'dexie'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import { ArsenDatabase } from './schema'

it('notifies the automatic preparation observer after a personal data transaction', async () => {
  const database = new ArsenDatabase('isolated-revision-observer', { indexedDB: new IDBFactory(), IDBKeyRange })
  let observed = 0
  const listener = () => { observed++ }
  Dexie.on('storagemutated', listener)
  try {
    await database.open()
    await database.routines.put({ id: 'routine', name: 'fixture' } as never)
    expect((await database.localMetadata.get('revision'))?.value).toBe(1)
    expect(observed).toBeGreaterThan(0)
  } finally {
    Dexie.on.storagemutated.unsubscribe(listener)
    database.close()
  }
})
