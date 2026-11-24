import { z } from 'zod'
import { authorize } from '../auth/authorize'

const limit = 4 * 1024 * 1024
const schema = z.object({ backupId: z.string().uuid(), sizeBytes: z.number().int().positive().max(limit) }).strict()

export async function authorizeManifestUpload(request: Request, input: unknown, dependencies: {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  transaction: <T>(work: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => Promise<T>
  sign: (input: { userId: string; backupId: string; kind: 'manifest'; maxBytes: number; serverLimitBytes: number }) => Promise<string>
}): Promise<{ status: 200; url: string } | { status: 400 | 401 | 403 | 404 | 405 | 409 }> {
  if (request.method !== 'POST') return { status: 405 }
  const authorization = await authorize(request, dependencies.auth)
  if (authorization.status !== 200) return authorization
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { status: 400 }
  const { backupId, sizeBytes } = parsed.data
  return dependencies.transaction(async (query) => {
  await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [authorization.userId])
  const profile = (await query('SELECT user_id FROM arsen_profiles WHERE user_id = $1 FOR UPDATE', [authorization.userId])).rows[0]
  if (!profile) return { status: 403 }
  const result = await query(`
    SELECT b.status, b.size_bytes::text, b.includes_health, p.health_sync_consent
    FROM arsen_backups b JOIN arsen_profiles p ON p.user_id = b.user_id WHERE b.id = $1 AND b.user_id = $2
  `, [backupId, authorization.userId])
  const row = result.rows[0]
  if (!row) return { status: 404 }
  if (row.status !== 'pending') return { status: 409 }
  if (row.includes_health === true && row.health_sync_consent !== true) return { status: 403 }
  const total = Number(row.size_bytes)
  if (!Number.isSafeInteger(total) || sizeBytes > total) return { status: 400 }
  const url = await dependencies.sign({ userId: authorization.userId, backupId, kind: 'manifest', maxBytes: sizeBytes, serverLimitBytes: limit })
  return { status: 200, url }
  })
}
