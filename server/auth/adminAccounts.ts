import { z } from 'zod'
import { authorize } from './authorize'

const userId = z.string().regex(/^user_[A-Za-z0-9]{1,123}$/)

export async function listAdminAccounts(request: Request, cursor: string | null, dependencies: {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  query: (sql: string, params: string[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}) {
  if (request.method !== 'GET') return { status: 405 as const }
  const authorization = await authorize(request, dependencies.auth, 'admin')
  if (authorization.status !== 200) return authorization
  if (cursor !== null && !userId.safeParse(cursor).success) return { status: 400 as const }
  const result = await dependencies.query(`
    SELECT p.user_id, p.role, p.created_at::text,
      (SELECT COUNT(*)::text FROM arsen_devices d WHERE d.user_id = p.user_id) AS device_count,
      (SELECT COUNT(*)::text FROM arsen_backups b WHERE b.user_id = p.user_id AND b.status = 'confirmed') AS backup_count,
      (SELECT MAX(b.confirmed_at)::text FROM arsen_backups b WHERE b.user_id = p.user_id AND b.status = 'confirmed') AS last_backup_at
    FROM arsen_profiles p WHERE p.user_id > $1 ORDER BY p.user_id LIMIT 51
  `, [cursor ?? ''])
  const accounts = result.rows.slice(0, 50).map((row) => {
    if (typeof row.user_id !== 'string' || !userId.safeParse(row.user_id).success || (row.role !== 'user' && row.role !== 'admin') || typeof row.created_at !== 'string' || (row.last_backup_at !== null && typeof row.last_backup_at !== 'string')) throw new Error('Metadatos de cuenta inválidos')
    const deviceCount = Number(row.device_count)
    const backupCount = Number(row.backup_count)
    if (![deviceCount, backupCount].every((n) => Number.isSafeInteger(n) && n >= 0)) throw new Error('Metadatos de cuenta inválidos')
    return { userId: row.user_id, role: row.role, createdAt: new Date(row.created_at).toISOString(), deviceCount, backupCount, lastBackupAt: row.last_backup_at === null ? null : new Date(row.last_backup_at as string).toISOString() }
  })
  return { status: 200 as const, accounts, nextCursor: result.rows.length > 50 ? accounts[accounts.length - 1]!.userId : null }
}
