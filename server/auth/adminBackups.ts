import { z } from 'zod'
import { parseBackupSummaries } from '../backups/list'
import { authorize } from './authorize'

export async function listAdminBackups(request: Request, userId: string, dependencies: {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  query: (sql: string, params: string[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}) {
  if (request.method !== 'GET') return { status: 405 as const }
  const authorization = await authorize(request, dependencies.auth, 'admin')
  if (authorization.status !== 200) return authorization
  if (!z.string().regex(/^user_[A-Za-z0-9]{1,123}$/).safeParse(userId).success) return { status: 400 as const }
  const result = await dependencies.query(`
    SELECT id::text, device_id::text, local_revision::text, contract_version::text, size_bytes::text, includes_health, confirmed_at::text
    FROM arsen_backups WHERE user_id = $1 AND status = 'confirmed' ORDER BY confirmed_at DESC, id DESC LIMIT 5
  `, [userId])
  return { status: 200 as const, backups: parseBackupSummaries(result.rows) }
}
