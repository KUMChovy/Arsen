import { z } from 'zod'
import { authorize } from '../auth/authorize'

const itemId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/)

export async function archiveCatalogExercise(request: Request, id: string, dependencies: {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  query: (sql: string, params: string[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}): Promise<{ status: 200; version: number } | { status: 400 | 401 | 403 | 404 | 405 | 409 }> {
  if (request.method !== 'POST') return { status: 405 }
  const authorization = await authorize(request, dependencies.auth, 'admin')
  if (authorization.status !== 200) return authorization
  if (!itemId.safeParse(id).success) return { status: 400 }
  const existing = await dependencies.query('SELECT id FROM arsen_catalog_items WHERE id = $1 AND published IS NOT NULL', [id])
  if (!existing.rows[0]) return { status: 404 }
  const result = await dependencies.query(`
    WITH locked_state AS (
      SELECT singleton FROM arsen_catalog_state WHERE singleton = true FOR UPDATE
    ), item AS (
      UPDATE arsen_catalog_items SET archived = true, updated_at = now()
      WHERE id = $1 AND published IS NOT NULL AND archived = false
        AND EXISTS (SELECT 1 FROM locked_state)
      RETURNING id
    ), next_version AS (
      UPDATE arsen_catalog_state SET version = version + 1
      WHERE singleton IN (SELECT singleton FROM locked_state) AND EXISTS (SELECT 1 FROM item)
      RETURNING version
    )
    INSERT INTO arsen_catalog_changes (version, item_id, action, actor_id, payload)
    SELECT next_version.version, item.id, 'archive', $2, NULL FROM item CROSS JOIN next_version
    RETURNING version::text AS version
  `, [id, authorization.userId])
  if (!result.rows[0]) return { status: 409 }
  const version = Number(result.rows[0].version)
  if (!Number.isSafeInteger(version) || version < 1) throw new Error('Versión de catálogo inválida')
  return { status: 200, version }
}
