import { createHash } from 'node:crypto'
import { z } from 'zod'
import { authorize } from '../auth/authorize'

const schema = z.object({ backupId: z.string().uuid(), id: z.string().min(1).max(256) }).strict()

export async function authorizeAssetUpload(request: Request, input: unknown, dependencies: {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  transaction: <T>(work: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => Promise<T>
  sign: (input: { userId: string; backupId: string; kind: 'asset'; assetId: string; maxBytes: number; serverLimitBytes: number }) => Promise<string>
  maxBackupBytes: number
}): Promise<{ status: 200; url: string } | { status: 400 | 401 | 403 | 404 | 405 | 409 }> {
  if (request.method !== 'POST') return { status: 405 }
  const authorization = await authorize(request, dependencies.auth)
  if (authorization.status !== 200) return authorization
  const parsed = schema.safeParse(input)
  if (!parsed.success || !Number.isSafeInteger(dependencies.maxBackupBytes) || dependencies.maxBackupBytes <= 0) return { status: 400 }
  const { backupId, id } = parsed.data
  const key = createHash('sha256').update(id, 'utf8').digest('hex')
  return dependencies.transaction(async (query) => {
  await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [authorization.userId])
  const profile = (await query('SELECT user_id FROM arsen_profiles WHERE user_id = $1 FOR UPDATE', [authorization.userId])).rows[0]
  if (!profile) return { status: 403 }
  const row = (await query(`
    SELECT b.status, b.includes_health, p.health_sync_consent, c.size_bytes::text
    FROM arsen_backups b JOIN arsen_profiles p ON p.user_id = b.user_id
    JOIN arsen_backup_components c ON c.backup_id = b.id AND c.user_id = b.user_id
    WHERE b.id = $1 AND b.user_id = $2 AND c.component_key = $3
  `, [backupId, authorization.userId, key])).rows[0]
  if (!row) return { status: 404 }
  if (row.status !== 'pending') return { status: 409 }
  if (row.includes_health === true && row.health_sync_consent !== true) return { status: 403 }
  const size = Number(row.size_bytes)
  if (!Number.isSafeInteger(size) || size <= 0 || size > dependencies.maxBackupBytes) return { status: 400 }
  const url = await dependencies.sign({ userId: authorization.userId, backupId, kind: 'asset', assetId: id, maxBytes: size, serverLimitBytes: dependencies.maxBackupBytes })
  return { status: 200, url }
  })
}
