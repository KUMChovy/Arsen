import { z } from 'zod'
import { catalogImageSchema } from '../../src/shared/validation/remoteCatalog'
import { authorize } from '../auth/authorize'

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/)
const draftSchema = z.object({
  id,
  name: z.string().trim().min(1).max(200),
  canonicalName: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200).optional(),
  mainMuscle: z.enum(['Pecho', 'Espalda', 'Hombros', 'Brazos', 'Abdomen', 'Piernas']).optional(),
  aliases: z.array(z.string().trim().min(1).max(200)).max(100).optional(),
  technicalNotes: z.string().max(10000).optional(),
  image: catalogImageSchema.nullable().optional(),
}).strict()
const inputSchema = z.object({ draft: draftSchema, expected: draftSchema.nullable() }).strict()
type Dependencies = {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  query: (sql: string, params: string[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}

export async function listCatalogDrafts(request: Request, cursor: string | null, dependencies: Dependencies) {
  if (request.method !== 'GET') return { status: 405 as const }
  const authorization = await authorize(request, dependencies.auth, 'admin')
  if (authorization.status !== 200) return authorization
  if (cursor !== null && !id.safeParse(cursor).success) return { status: 400 as const }
  const result = await dependencies.query(`SELECT id, draft, published, archived, updated_at::text
    FROM arsen_catalog_items WHERE id > $1 ORDER BY id LIMIT 101`, [cursor ?? ''])
  const items = result.rows.slice(0, 100)
  const nextCursor = result.rows.length > 100 && typeof items[items.length - 1]?.id === 'string' ? items[items.length - 1]!.id : null
  return { status: 200 as const, items, nextCursor }
}

export async function saveCatalogDraft(request: Request, input: unknown, dependencies: Dependencies) {
  if (request.method !== 'POST') return { status: 405 as const }
  const authorization = await authorize(request, dependencies.auth, 'admin')
  if (authorization.status !== 200) return authorization
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success || (parsed.data.expected && parsed.data.expected.id !== parsed.data.draft.id)) return { status: 400 as const }
  const { draft, expected } = parsed.data
  const operation = expected === null
    ? `INSERT INTO arsen_catalog_items (id, draft) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING RETURNING id`
    : `UPDATE arsen_catalog_items SET draft = $2::jsonb, updated_at = now() WHERE id = $1 AND draft = $4::jsonb RETURNING id`
  const result = await dependencies.query(`WITH item AS (${operation})
    INSERT INTO arsen_catalog_draft_audit (actor_id, action, target_id)
    SELECT $3, 'draft.save', id FROM item RETURNING target_id`, expected === null
    ? [draft.id, JSON.stringify(draft), authorization.userId]
    : [draft.id, JSON.stringify(draft), authorization.userId, JSON.stringify(expected)])
  if (!result.rows[0]) return { status: 409 as const }
  return { status: expected === null ? 201 as const : 200 as const }
}
