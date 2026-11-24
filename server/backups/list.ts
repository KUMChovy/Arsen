import { authorize } from '../auth/authorize'

type BackupSummary = { id: string; deviceId: string; localRevision: number; contractVersion: number; sizeBytes: number; includesHealth: boolean; confirmedAt: string }
type Result = { status: 200; backups: BackupSummary[] } | { status: 401 | 403 | 405 }

export function parseBackupSummaries(rows: Array<Record<string, unknown>>): BackupSummary[] {
  return rows.map((row) => {
    if (typeof row.id !== 'string' || typeof row.device_id !== 'string' || typeof row.includes_health !== 'boolean' || typeof row.confirmed_at !== 'string') throw new Error('Metadatos de respaldo inválidos')
    const localRevision = Number(row.local_revision)
    const contractVersion = Number(row.contract_version)
    const sizeBytes = Number(row.size_bytes)
    if (![localRevision, contractVersion, sizeBytes].every(Number.isSafeInteger)) throw new Error('Metadatos de respaldo inválidos')
    return { id: row.id, deviceId: row.device_id, localRevision, contractVersion, sizeBytes, includesHealth: row.includes_health, confirmedAt: new Date(row.confirmed_at).toISOString() }
  })
}

export async function listBackups(request: Request, dependencies: {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  query: (sql: string, params: string[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}): Promise<Result> {
  if (request.method !== 'GET') return { status: 405 }
  const authorization = await authorize(request, dependencies.auth)
  if (authorization.status !== 200) return authorization
  const result = await dependencies.query(`
    SELECT id::text, device_id::text, local_revision::text, contract_version::text, size_bytes::text, includes_health, confirmed_at::text
    FROM arsen_backups WHERE user_id = $1 AND status = 'confirmed' ORDER BY confirmed_at DESC, id DESC LIMIT 5
  `, [authorization.userId])
  return { status: 200, backups: parseBackupSummaries(result.rows) }
}
