import { backupObjectPath } from './blobReader'

type Query = (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
type Result = { status: 'idle' | 'blocked' | 'complete' | 'pending'; deleted: number }

// Solo debe llamarse desde un mantenimiento autenticado, nunca desde una ruta pública.
export async function cleanupOneBackup(dependencies: {
  transaction: <T>(work: (query: Query) => Promise<T>) => Promise<T>
  list: (prefix: string, limit: number) => Promise<string[]>
  remove: (paths: string[]) => Promise<void>
}): Promise<Result> {
  const candidate = await dependencies.transaction(async (query) => (await query("SELECT backup_id::text, user_id FROM arsen_backup_cleanup WHERE not_before <= clock_timestamp() ORDER BY not_before, backup_id LIMIT 1", [])).rows[0])
  if (!candidate) return { status: 'idle', deleted: 0 }
  if (typeof candidate.backup_id !== 'string' || typeof candidate.user_id !== 'string') throw new Error('Cola de limpieza inválida')
  const { backup_id: backupId, user_id: userId } = candidate
  return dependencies.transaction(async (query): Promise<Result> => {
    await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [userId])
    const entry = (await query('SELECT backup_id FROM arsen_backup_cleanup WHERE backup_id = $1 AND user_id = $2 AND not_before <= clock_timestamp() FOR UPDATE SKIP LOCKED', [backupId, userId])).rows[0]
    if (!entry) return { status: 'idle', deleted: 0 }
    if ((await query('SELECT id FROM arsen_backups WHERE id = $1 AND user_id = $2', [backupId, userId])).rows.length) {
      await query("UPDATE arsen_backup_cleanup SET not_before = clock_timestamp() + interval '1 hour' WHERE backup_id = $1 AND user_id = $2", [backupId, userId])
      return { status: 'blocked', deleted: 0 }
    }
    const prefix = backupObjectPath(userId, backupId, 'manifest').slice(0, -'manifest'.length)
    const paths = await dependencies.list(prefix, 100)
    if (!Array.isArray(paths) || paths.length > 100 || new Set(paths).size !== paths.length || paths.some((path) => typeof path !== 'string' || !path.startsWith(prefix) || path.length <= prefix.length)) throw new Error('Listado de objetos inválido')
    if (paths.length) {
      await dependencies.remove(paths)
      return { status: 'pending', deleted: paths.length }
    }
    await query('DELETE FROM arsen_backup_cleanup WHERE backup_id = $1 AND user_id = $2', [backupId, userId])
    return { status: 'complete', deleted: 0 }
  })
}
