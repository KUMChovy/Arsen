import { authorize } from './authorize'

export async function getAdminAudit(request: Request, dependencies: {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  query: (sql: string, params: string[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}) {
  if (request.method !== 'GET') return { status: 405 as const }
  const authorization = await authorize(request, dependencies.auth, 'admin')
  if (authorization.status !== 200) return authorization
  const result = await dependencies.query(`SELECT actor_id, action, target_id,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
    FROM (
      SELECT actor_id, action, target_id::text, created_at FROM arsen_admin_audit
      UNION ALL SELECT actor_id, 'account.deletion.' || action AS action, target_id, created_at FROM arsen_account_deletion_audit
      UNION ALL SELECT actor_id, action, target_id, created_at FROM arsen_catalog_draft_audit
      UNION ALL SELECT actor_id, action, item_id AS target_id, created_at FROM arsen_catalog_changes
    ) events ORDER BY created_at DESC, actor_id, action, target_id LIMIT 100`, [])
  return { status: 200 as const, events: result.rows }
}
