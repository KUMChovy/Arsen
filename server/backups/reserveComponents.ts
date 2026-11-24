import { createHash } from 'node:crypto'
import { z } from 'zod'
import { authorize } from '../auth/authorize'
import { validateRemoteManifest } from './validateManifest'

type Query = (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
type Result = { status: 200 | 400 | 401 | 403 | 404 | 405 | 409 }
const component = z.object({ id: z.string().min(1).max(256), sizeBytes: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strict()
const schema = z.object({ backupId: z.string().uuid(), components: z.array(component).max(5000) }).strict()

export async function reserveBackupComponents(request: Request, input: unknown, dependencies: {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  transaction: <T>(callback: (query: Query) => Promise<T>) => Promise<T>
  readManifest: (userId: string, backupId: string, maxBytes: number) => Promise<Uint8Array | null>
  maxBackupBytes: number
}): Promise<Result> {
  if (request.method !== 'POST') return { status: 405 }
  const authorization = await authorize(request, dependencies.auth)
  if (authorization.status !== 200) return authorization
  const parsed = schema.safeParse(input)
  if (!parsed.success || !Number.isSafeInteger(dependencies.maxBackupBytes) || dependencies.maxBackupBytes <= 0) return { status: 400 }
  const { backupId, components } = parsed.data
  if (new Set(components.map((item) => item.id)).size !== components.length) return { status: 400 }
  const userId = authorization.userId
  const fetchBackup = (query: Query) => query('SELECT status, manifest_sha256, size_bytes::text, includes_health, manifest_size_bytes::text FROM arsen_backups WHERE id = $1 AND user_id = $2', [backupId, userId])
  const initial = await dependencies.transaction(async (query) => {
    const row = (await fetchBackup(query)).rows[0]
    const profile = row ? (await query('SELECT health_sync_consent FROM arsen_profiles WHERE user_id = $1', [userId])).rows[0] : undefined
    return { row, profile }
  })
  if (!initial.row) return { status: 404 }
  if (initial.row.status !== 'pending') return { status: 409 }
  if (initial.row.includes_health === true && initial.profile?.health_sync_consent !== true) return { status: 403 }
  const size = Number(initial.row.size_bytes)
  if (!Number.isSafeInteger(size) || size <= 0 || size > dependencies.maxBackupBytes || typeof initial.row.manifest_sha256 !== 'string' || typeof initial.row.includes_health !== 'boolean') return { status: 400 }
  const bytes = await dependencies.readManifest(userId, backupId, Math.min(size, 4 * 1024 * 1024))
  if (!bytes) return { status: 400 }
  let manifest: ReturnType<typeof validateRemoteManifest>
  try { manifest = validateRemoteManifest(bytes, initial.row.manifest_sha256, initial.row.includes_health) } catch { return { status: 400 } }
  if (manifest.healthIncluded !== initial.row.includes_health) return { status: 400 }
  const sizes = new Map(components.map((item) => [item.id, item.sizeBytes]))
  if (manifest.assets.length !== sizes.size || manifest.assets.some((asset) => !sizes.has(asset.id))) return { status: 400 }
  const total = components.reduce((sum, item) => sum + BigInt(item.sizeBytes), BigInt(bytes.byteLength))
  if (total !== BigInt(size)) return { status: 400 }
  const entries = manifest.assets.map((asset) => ({ key: createHash('sha256').update(asset.id, 'utf8').digest('hex'), sha256: asset.sha256, size: sizes.get(asset.id)! })).sort((a, b) => a.key.localeCompare(b.key))
  return dependencies.transaction(async (query): Promise<Result> => {
    const profile = (await query('SELECT health_sync_consent FROM arsen_profiles WHERE user_id = $1 FOR UPDATE', [userId])).rows[0]
    if (!profile) return { status: 403 }
    const row = (await fetchBackup(query)).rows[0]
    if (!row) return { status: 404 }
    if (row.status !== 'pending' || row.manifest_sha256 !== initial.row!.manifest_sha256 || row.size_bytes !== initial.row!.size_bytes || row.includes_health !== initial.row!.includes_health) return { status: 409 }
    if (row.includes_health && profile.health_sync_consent !== true) return { status: 403 }
    if (row.manifest_size_bytes !== null) {
      const existing = (await query('SELECT component_key, sha256, size_bytes::text FROM arsen_backup_components WHERE backup_id = $1 AND user_id = $2 ORDER BY component_key', [backupId, userId])).rows
      if (Number(row.manifest_size_bytes) !== bytes.byteLength || existing.length !== entries.length || entries.some((entry, index) => existing[index]?.component_key !== entry.key || existing[index]?.sha256 !== entry.sha256 || Number(existing[index]?.size_bytes) !== entry.size)) return { status: 409 }
      return { status: 200 }
    }
    await query('UPDATE arsen_backups SET manifest_size_bytes = $1 WHERE id = $2 AND user_id = $3', [bytes.byteLength, backupId, userId])
    for (const entry of entries) await query('INSERT INTO arsen_backup_components (backup_id, user_id, component_key, sha256, size_bytes) VALUES ($1, $2, $3, $4, $5)', [backupId, userId, entry.key, entry.sha256, entry.size])
    return { status: 200 }
  })
}
