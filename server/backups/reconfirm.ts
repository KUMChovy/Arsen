import { z } from 'zod'
import { authorize } from '../auth/authorize'

type Query = (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
type Backup = { id: string; userId: string; manifestSha256: string; sizeBytes: number; contractVersion: number; includesHealth: boolean }
type Dependencies = {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  transaction: <T>(callback: (query: Query) => Promise<T>) => Promise<T>
  verifyObjects: (backup: Backup) => Promise<boolean>
}
type Result = { status: 200; id: string } | { status: 400 | 401 | 403 | 404 | 405 | 409 }
const inputSchema = z.object({ backupId: z.string().uuid(), baseBackupId: z.string().uuid(), manifestSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict()

export async function reconfirmBackup(request: Request, input: unknown, dependencies: Dependencies): Promise<Result> {
  if (request.method !== 'POST') return { status: 405 }
  const authorization = await authorize(request, dependencies.auth)
  if (authorization.status !== 200) return authorization
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { status: 400 }
  const { backupId, baseBackupId, manifestSha256 } = parsed.data
  const userId = authorization.userId
  const fetchRow = (query: Query) => query('SELECT id::text, status, manifest_sha256, size_bytes::text, contract_version::text, includes_health FROM arsen_backups WHERE id = $1 AND user_id = $2', [backupId, userId])
  const initial = await dependencies.transaction(async (query) => (await fetchRow(query)).rows[0])
  if (!initial) return { status: 404 }
  if (initial.status !== 'confirmed' || initial.manifest_sha256 !== manifestSha256 || typeof initial.includes_health !== 'boolean') return { status: 409 }
  if (initial.includes_health) {
    const consent = await dependencies.transaction(async (query) => (await query('SELECT health_sync_consent FROM arsen_profiles WHERE user_id = $1', [userId])).rows[0])
    if (consent?.health_sync_consent !== true) return { status: 403 }
  }
  if (!await dependencies.verifyObjects({ id: backupId, userId, manifestSha256, sizeBytes: Number(initial.size_bytes), contractVersion: Number(initial.contract_version), includesHealth: initial.includes_health })) return { status: 409 }
  return dependencies.transaction(async (query): Promise<Result> => {
    await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [userId])
    const profile = (await query('SELECT health_sync_consent FROM arsen_profiles WHERE user_id = $1 FOR UPDATE', [userId])).rows[0]
    if (!profile) return { status: 403 }
    const current = (await fetchRow(query)).rows[0]
    if (!current) return { status: 404 }
    if (JSON.stringify(current) !== JSON.stringify(initial)) return { status: 409 }
    if (current.includes_health && profile.health_sync_consent !== true) return { status: 403 }
    const latest = (await query("SELECT id::text FROM arsen_backups WHERE user_id = $1 AND status = 'confirmed' ORDER BY confirmed_at DESC, id DESC LIMIT 1", [userId])).rows[0]
    if (latest?.id === backupId) return { status: 200, id: backupId }
    if (latest?.id !== baseBackupId) return { status: 409 }
    await query("UPDATE arsen_backups SET confirmed_at = clock_timestamp() WHERE id = $1 AND user_id = $2 AND status = 'confirmed'", [backupId, userId])
    return { status: 200, id: backupId }
  })
}
