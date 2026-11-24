import { z } from 'zod'
import { prepareRemoteBackupSchema } from '../../src/shared/validation/remoteBackup'
import { authorize } from '../auth/authorize'

type Query = (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
type Dependencies = {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  transaction: <T>(callback: (query: Query) => Promise<T>) => Promise<T>
}
type Result = { status: 200 | 201; id: string; state: 'pending' | 'confirmed'; localRevision: number; deviceId: string } | { status: 400 | 401 | 403 | 405 | 409 }
const requestSchema = z.object({ deviceId: z.string().uuid(), backup: prepareRemoteBackupSchema }).strict()

async function readBody(request: Request): Promise<unknown> {
  if (!request.body) throw new Error('Solicitud vacía')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 4096) { await reader.cancel(); throw new Error('Solicitud demasiado grande') }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
}

export async function prepareBackup(request: Request, dependencies: Dependencies): Promise<Result> {
  if (request.method !== 'POST') return { status: 405 }
  const authorization = await authorize(request, dependencies.auth)
  if (authorization.status !== 200) return authorization
  let input: z.infer<typeof requestSchema>
  try { input = requestSchema.parse(await readBody(request)) } catch { return { status: 400 } }
  const { deviceId, backup } = input
  try {
    return await dependencies.transaction(async (query): Promise<Result> => {
      await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [authorization.userId])
      const profiles = await query('SELECT health_sync_consent FROM arsen_profiles WHERE user_id = $1 FOR UPDATE', [authorization.userId])
      if (!profiles.rows[0] || (backup.includesHealth && profiles.rows[0].health_sync_consent !== true)) return { status: 403 }
      const devices = await query('SELECT id FROM arsen_devices WHERE id = $1 AND user_id = $2', [deviceId, authorization.userId])
      if (!devices.rows[0]) return { status: 403 }
      const existing = await query('SELECT id::text, status, local_revision::text, device_id::text, contract_version::text, size_bytes::text, includes_health FROM arsen_backups WHERE user_id = $1 AND manifest_sha256 = $2', [authorization.userId, backup.manifestSha256])
      const row = existing.rows[0]
      if (row) {
        if (Number(row.contract_version) !== backup.contractVersion || Number(row.size_bytes) !== backup.sizeBytes || row.includes_health !== backup.includesHealth || (row.status === 'pending' && row.device_id !== deviceId)) return { status: 409 }
        if ((row.status !== 'pending' && row.status !== 'confirmed') || typeof row.id !== 'string' || typeof row.device_id !== 'string') throw new Error('Metadatos de respaldo inválidos')
        return { status: 200, id: row.id, state: row.status, localRevision: Number(row.local_revision), deviceId: row.device_id }
      }
      const cleanup = await query('SELECT backup_id FROM arsen_backup_cleanup WHERE backup_id = $1', [backup.id])
      if (cleanup.rows[0]) return { status: 409 }
      const latest = await query("SELECT id::text, device_id::text, local_revision::text FROM arsen_backups WHERE user_id = $1 AND status = 'confirmed' ORDER BY confirmed_at DESC, id DESC LIMIT 1", [authorization.userId])
      const base = latest.rows[0]
      if ((base?.id ?? null) !== backup.baseBackupId || (base?.device_id === deviceId && backup.localRevision <= Number(base.local_revision))) return { status: 409 }
      await query('INSERT INTO arsen_backups (id, user_id, device_id, base_backup_id, contract_version, local_revision, manifest_sha256, size_bytes, includes_health) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [backup.id, authorization.userId, deviceId, backup.baseBackupId, backup.contractVersion, backup.localRevision, backup.manifestSha256, backup.sizeBytes, backup.includesHealth])
      return { status: 201, id: backup.id, state: 'pending', localRevision: backup.localRevision, deviceId }
    })
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') return { status: 409 }
    throw error
  }
}
