import { z } from 'zod'
import { authorize } from '../auth/authorize'

type Query = (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
type Backup = { id: string; userId: string; manifestSha256: string; sizeBytes: number; contractVersion: number; includesHealth: boolean }
type Dependencies = {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  transaction: <T>(callback: (query: Query) => Promise<T>) => Promise<T>
  // Must verify immutable, privately owned object versions, all bytes, sizes and manifest contents.
  verifyObjects: (backup: Backup) => Promise<boolean>
}
type Result = { status: 200; id: string } | { status: 400 | 401 | 403 | 404 | 405 | 409 }

export async function confirmBackup(request: Request, id: string, dependencies: Dependencies): Promise<Result> {
  if (request.method !== 'POST') return { status: 405 }
  const authorization = await authorize(request, dependencies.auth)
  if (authorization.status !== 200) return authorization
  if (!z.string().uuid().safeParse(id).success) return { status: 400 }
  const userId = authorization.userId
  const fetchRow = (query: Query) => query('SELECT id::text, status, base_backup_id::text, device_id::text, local_revision::text, manifest_sha256, size_bytes::text, contract_version::text, includes_health FROM arsen_backups WHERE id = $1 AND user_id = $2', [id, userId])
  const lookup = await dependencies.transaction(async (query) => {
    const row = (await fetchRow(query)).rows[0]
    const profile = row?.status === 'pending' && row.includes_health === true
      ? (await query('SELECT health_sync_consent FROM arsen_profiles WHERE user_id = $1', [userId])).rows[0]
      : undefined
    return { row, profile }
  })
  const initial = lookup.row
  if (!initial) return { status: 404 }
  if (initial.status === 'confirmed') return { status: 200, id }
  if (initial.status !== 'pending' || typeof initial.manifest_sha256 !== 'string' || typeof initial.includes_health !== 'boolean') return { status: 409 }
  if (initial.includes_health && lookup.profile?.health_sync_consent !== true) return { status: 403 }
  const backup: Backup = { id, userId, manifestSha256: initial.manifest_sha256, sizeBytes: Number(initial.size_bytes), contractVersion: Number(initial.contract_version), includesHealth: initial.includes_health }
  if (!await dependencies.verifyObjects(backup)) return { status: 409 }
  return dependencies.transaction(async (query): Promise<Result> => {
    const profile = (await query('SELECT health_sync_consent FROM arsen_profiles WHERE user_id = $1 FOR UPDATE', [userId])).rows[0]
    if (!profile) return { status: 403 }
    const current = (await fetchRow(query)).rows[0]
    if (!current) return { status: 404 }
    if (current.status === 'confirmed') return { status: 200, id }
    if (current.status !== 'pending' || JSON.stringify(current) !== JSON.stringify(initial)) return { status: 409 }
    if (current.includes_health && profile.health_sync_consent !== true) return { status: 403 }
    const latest = (await query("SELECT id::text, device_id::text, local_revision::text FROM arsen_backups WHERE user_id = $1 AND status = 'confirmed' ORDER BY confirmed_at DESC, id DESC LIMIT 1", [userId])).rows[0]
    if ((latest?.id ?? null) !== current.base_backup_id || (latest?.device_id === current.device_id && Number(current.local_revision) <= Number(latest.local_revision))) return { status: 409 }
    await query("UPDATE arsen_backups SET status = 'confirmed', confirmed_at = clock_timestamp() WHERE id = $1 AND user_id = $2", [id, userId])
    await query(`
      WITH removed AS (
        DELETE FROM arsen_backups WHERE user_id = $1 AND id IN (
          SELECT id FROM arsen_backups WHERE user_id = $1 AND status = 'confirmed'
          ORDER BY confirmed_at DESC, id DESC OFFSET 5
        ) RETURNING id, user_id
      )
      INSERT INTO arsen_backup_cleanup (backup_id, user_id, not_before)
      SELECT id, user_id, clock_timestamp() + interval '1 hour' FROM removed
    `, [userId])
    return { status: 200, id }
  })
}
