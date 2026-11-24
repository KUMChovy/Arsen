import { authorize } from './authorize'

export async function getAdminOverview(request: Request, dependencies: {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  query: (sql: string, params: string[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}) {
  if (request.method !== 'GET') return { status: 405 as const }
  const authorization = await authorize(request, dependencies.auth, 'admin')
  if (authorization.status !== 200) return authorization
  const result = await dependencies.query(`SELECT
    (SELECT COUNT(*)::text FROM arsen_profiles) AS accounts,
    (SELECT COUNT(*)::text FROM arsen_devices) AS devices,
    (SELECT COUNT(*)::text FROM arsen_backups WHERE status = 'confirmed') AS confirmed_backups,
    (SELECT COUNT(*)::text FROM arsen_catalog_items WHERE published IS NOT NULL AND archived = false) AS published_exercises`, [])
  const row = result.rows[0]
  if (!row) throw new Error('Resumen administrativo inválido')
  const counts = [row.accounts, row.devices, row.confirmed_backups, row.published_exercises].map(Number)
  if (!counts.every((value) => Number.isSafeInteger(value) && value >= 0)) throw new Error('Resumen administrativo inválido')
  return { status: 200 as const, accounts: counts[0]!, devices: counts[1]!, confirmedBackups: counts[2]!, publishedExercises: counts[3]! }
}
