import { createHash } from 'node:crypto'
import { z } from 'zod'
import { authorize } from '../auth/authorize'

const schema = z.discriminatedUnion('kind', [
  z.object({ backupId: z.string().uuid(), kind: z.literal('manifest') }).strict(),
  z.object({ backupId: z.string().uuid(), kind: z.literal('asset'), id: z.string().min(1).max(256) }).strict(),
])

export async function authorizeBackupDownload(request: Request, input: unknown, dependencies: {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  transaction: <T>(work: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => Promise<T>
  sign: (input: { userId: string; backupId: string; kind: 'manifest' | 'asset'; assetId?: string }) => Promise<string>
}): Promise<{ status: 200; url: string; sha256: string; sizeBytes: number } | { status: 400 | 401 | 403 | 404 | 405 | 409 }> {
  if (request.method !== 'POST') return { status: 405 }
  const authorization = await authorize(request, dependencies.auth)
  if (authorization.status !== 200) return authorization
  const parsed = schema.safeParse(input)
  if (!parsed.success) return { status: 400 }
  const { backupId, kind } = parsed.data
  const assetId = kind === 'asset' ? parsed.data.id : undefined
  const key = assetId ? createHash('sha256').update(assetId, 'utf8').digest('hex') : ''
  return dependencies.transaction(async (query) => {
  await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [authorization.userId])
  const profile = (await query('SELECT user_id FROM arsen_profiles WHERE user_id = $1 FOR UPDATE', [authorization.userId])).rows[0]
  if (!profile) return { status: 403 }
  const row = (await query(`
    SELECT b.status, b.includes_health, p.health_sync_consent, c.component_key,
           b.manifest_sha256, b.manifest_size_bytes::text, c.sha256 AS component_sha256, c.size_bytes::text AS component_size_bytes
    FROM arsen_backups b JOIN arsen_profiles p ON p.user_id = b.user_id
    LEFT JOIN arsen_backup_components c ON c.backup_id = b.id AND c.user_id = b.user_id AND c.component_key = $3
    WHERE b.id = $1 AND b.user_id = $2
  `, [backupId, authorization.userId, key])).rows[0]
  if (!row) return { status: 404 }
  if (row.status !== 'confirmed') return { status: 409 }
  if (row.includes_health === true && row.health_sync_consent !== true) return { status: 403 }
  if (kind === 'asset' && row.component_key !== key) return { status: 404 }
  const sha256 = kind === 'manifest' ? row.manifest_sha256 : row.component_sha256
  const rawSize = kind === 'manifest' ? row.manifest_size_bytes : row.component_size_bytes
  const sizeBytes = Number(rawSize)
  if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256) || rawSize === null || !Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) return { status: 409 }
  const url = await dependencies.sign({ userId: authorization.userId, backupId, kind, ...(assetId ? { assetId } : {}) })
  return { status: 200, url, sha256, sizeBytes }
  })
}
