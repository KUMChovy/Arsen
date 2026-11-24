import { z } from 'zod'
import { publishedCatalogSchema } from '../../src/shared/validation/remoteCatalog'
import { authorize } from '../auth/authorize'

type Image = z.infer<typeof publishedCatalogSchema>['exercises'][number]['image']
type Result = { status: 200; version: number } | { status: 401 | 403 | 404 | 405 | 409 | 422 }

export async function publishCatalogExercise(
  request: Request,
  id: string,
  dependencies: {
    query: (sql: string, params: string[]) => Promise<{ rows: Array<Record<string, unknown>> }>
    auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
    verifyImage: (image: Image) => Promise<boolean>
  },
): Promise<Result> {
  if (request.method !== 'POST') return { status: 405 }
  const authorization = await authorize(request, dependencies.auth, 'admin')
  if (authorization.status !== 200) return authorization
  const result = await dependencies.query('SELECT draft FROM arsen_catalog_items WHERE id = $1', [id])
  if (!result.rows[0]) return { status: 404 }
  const raw = result.rows[0].draft
  const parsed = publishedCatalogSchema.safeParse({ version: 1, exercises: [raw] })
  const exercise = parsed.success ? parsed.data.exercises[0] : undefined
  if (!exercise || exercise.id !== id || !(await dependencies.verifyImage(exercise.image))) return { status: 422 }
  const updated = await dependencies.query(`
    WITH locked_state AS (
      SELECT singleton FROM arsen_catalog_state WHERE singleton = true FOR UPDATE
    ), item AS (
      UPDATE arsen_catalog_items
      SET published = $3::jsonb, archived = false, updated_at = now()
      WHERE id = $1 AND draft = $2::jsonb AND (archived OR published IS DISTINCT FROM $3::jsonb)
        AND EXISTS (SELECT 1 FROM locked_state)
      RETURNING id, published
    ), next_version AS (
      UPDATE arsen_catalog_state SET version = version + 1
      WHERE singleton IN (SELECT singleton FROM locked_state) AND EXISTS (SELECT 1 FROM item)
      RETURNING version
    )
    INSERT INTO arsen_catalog_changes (version, item_id, action, actor_id, payload)
    SELECT next_version.version, item.id, 'publish', $4, item.published FROM item CROSS JOIN next_version
    RETURNING version::text AS version
  `, [id, JSON.stringify(raw), JSON.stringify(exercise), authorization.userId])
  if (!updated.rows[0]) return { status: 409 }
  return { status: 200, version: Number(updated.rows[0].version) }
}
