import { createHash } from 'node:crypto'
import { z } from 'zod'
import { authorize } from './authorize'

type Query = (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
type Dependencies = {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  issuer: string
  storeFingerprint: () => string
  transaction: <T>(work: (query: Query) => Promise<T>) => Promise<T>
  ban: (userId: string) => Promise<void>
  deleteIdentity: (userId: string) => Promise<void>
  list: (prefix: string, limit: number) => Promise<string[]>
  remove: (paths: string[]) => Promise<void>
}

export async function deleteAdminAccount(request: Request, userId: string, deps: Dependencies) {
  if (request.method !== 'POST') return { status: 405 as const }
  const authorization = await authorize(request, deps.auth, 'admin')
  if (authorization.status !== 200) return authorization
  if (!/^user_[A-Za-z0-9]{1,123}$/.test(userId) || !z.string().max(128).safeParse(userId).success) return { status: 400 as const }
  if (authorization.userId === userId) return { status: 403 as const }
  const fingerprint = deps.storeFingerprint()
  if (!/^[a-f0-9]{64}$/.test(fingerprint)) throw new Error('Almacén inválido')
  const step = () => deps.transaction(async (query) => {
    await query("SELECT pg_advisory_xact_lock(hashtextextended('arsen-account-deletion', 0))", [])
    await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [userId])
    const actor = (await query("SELECT role FROM arsen_profiles WHERE user_id = $1 AND NOT EXISTS (SELECT 1 FROM arsen_account_deletions WHERE user_id = $1) FOR UPDATE", [authorization.userId])).rows[0]
    if (actor?.role !== 'admin') return { status: 403 as const }
    const target = (await query('SELECT role FROM arsen_profiles WHERE user_id = $1 FOR UPDATE', [userId])).rows[0]
    if (!target) return { status: 404 as const }
    const job = (await query('SELECT issuer, store_fingerprint, phase, not_before <= clock_timestamp() AS ready FROM arsen_account_deletions WHERE user_id = $1 FOR UPDATE', [userId])).rows[0]
    if (!job) {
      if (target.role === 'admin') {
        const remaining = (await query("SELECT count(*)::text AS total FROM arsen_profiles p WHERE p.role = 'admin' AND p.user_id <> $1 AND NOT EXISTS (SELECT 1 FROM arsen_account_deletions d WHERE d.user_id = p.user_id)", [userId])).rows[0]
        const count = Number(remaining?.total)
        if (!Number.isSafeInteger(count) || count < 1) return { status: 403 as const }
      }
      await query('INSERT INTO arsen_account_deletions (user_id, requested_by, issuer, store_fingerprint) VALUES ($1, $2, $3, $4)', [userId, authorization.userId, deps.issuer, fingerprint])
      await query("INSERT INTO arsen_account_deletion_audit (actor_id, target_id, action) VALUES ($1,$2,'requested')", [authorization.userId, userId])
      return { status: 200 as const, result: 'started' as const }
    }
    if (job.issuer !== deps.issuer) throw new Error('El entorno de identidad cambió')
    if (job.store_fingerprint !== fingerprint) throw new Error('El almacén configurado cambió')
    if (job.phase === 'requested') {
      await deps.ban(userId)
      await query("UPDATE arsen_account_deletions SET phase = 'waiting', not_before = clock_timestamp() + interval '1 hour' WHERE user_id = $1", [userId])
      return { status: 200 as const, result: 'waiting' as const }
    }
    if (job.phase !== 'waiting') throw new Error('Estado de eliminación inválido')
    if (job.ready !== true) return { status: 200 as const, result: 'waiting' as const }
    const prefix = `backups/${createHash('sha256').update(userId, 'utf8').digest('hex')}/`
    const paths = await deps.list(prefix, 100)
    if (!Array.isArray(paths) || paths.length > 100 || new Set(paths).size !== paths.length || paths.some((path) => typeof path !== 'string' || !path.startsWith(prefix) || path.length <= prefix.length)) throw new Error('Listado de objetos inválido')
    if (paths.length) { await deps.remove(paths); return { status: 200 as const, result: 'pending' as const } }
    await deps.deleteIdentity(userId)
    await query('DELETE FROM arsen_invitations WHERE accepted_by = $1', [userId])
    await query('DELETE FROM arsen_backup_cleanup WHERE user_id = $1', [userId])
    await query('DELETE FROM arsen_profiles WHERE user_id = $1', [userId])
    await query('DELETE FROM arsen_account_deletions WHERE user_id = $1', [userId])
    await query("INSERT INTO arsen_account_deletion_audit (actor_id, target_id, action) VALUES ($1,$2,'completed')", [authorization.userId, userId])
    return { status: 200 as const, result: 'complete' as const }
  })
  const result = await step()
  if (result.status !== 200 || result.result !== 'started') return result
  const next = await step()
  if (next.status === 200 && next.result === 'started') throw new Error('No se pudo continuar la eliminación')
  return next
}
