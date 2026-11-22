import { CURRENT_SCHEMA_VERSION, db } from './schema'
import { backupSchema } from '../shared/validation/arsenImportSchemas'
import { createContractBackupFromDataset, type ContractBackup } from './contractBackup'

function differences(before: unknown, after: unknown, path: string, result: string[]) {
  if (Object.is(before, after)) return
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length)
    for (let i = 0; i < length; i++) differences(before[i], after[i], `${path}[${i}]`, result)
    return
  }
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
    const left = before as Record<string, unknown>
    const right = after as Record<string, unknown>
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) differences(left[key], right[key], `${path}.${key}`, result)
    return
  }
  result.push(path)
}

function preservePresentValues(original: unknown, withDefaults: unknown): unknown {
  if (Array.isArray(original) && Array.isArray(withDefaults)) return original.map((value, index) => preservePresentValues(value, withDefaults[index]))
  if (original && withDefaults && typeof original === 'object' && typeof withDefaults === 'object' && !Array.isArray(original) && !Array.isArray(withDefaults)) {
    const left = original as Record<string, unknown>
    const right = withDefaults as Record<string, unknown>
    return Object.fromEntries([...new Set([...Object.keys(left), ...Object.keys(right)])].map((key) => [key, Object.hasOwn(left, key) ? preservePresentValues(left[key], right[key]) : right[key]]))
  }
  return original
}

/** Prepares a candidate only. The caller must preserve the original backup before restoring it. */
export async function prepareContractTransition(content: string): Promise<{ backup: ContractBackup; changes: string[] }> {
  const input: unknown = JSON.parse(content)
  if (typeof input !== 'object' || input === null || !('schemaVersion' in input) || input.schemaVersion !== CURRENT_SCHEMA_VERSION || !('tables' in input) || typeof input.tables !== 'object' || input.tables === null) {
    throw new Error('El respaldo no corresponde a la versión local compatible')
  }
  const tables = input.tables as Record<string, unknown>
  if (db.tables.some((table) => !Array.isArray(tables[table.name]))) throw new Error('El respaldo de transición está incompleto')
  const parsed = backupSchema.safeParse(input)
  if (!parsed.success) throw new Error('El respaldo de transición contiene datos inválidos')
  const candidate = preservePresentValues(tables, parsed.data.tables) as typeof parsed.data.tables
  for (const exercise of candidate.routineExercises) Reflect.deleteProperty(exercise, 'progression')
  for (const item of candidate.exerciseCatalog) Reflect.deleteProperty(item, 'progressionStrategy')
  for (const settings of candidate.settings) {
    settings.schemaVersion = CURRENT_SCHEMA_VERSION
    delete settings.lastContractBackupSha256
  }
  const backup = await createContractBackupFromDataset(candidate)
  const changes: string[] = []
  differences(tables, candidate, 'tables', changes)
  return { backup, changes: changes.sort() }
}
