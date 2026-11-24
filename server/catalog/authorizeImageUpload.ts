import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { authorize } from '../auth/authorize'

const inputSchema = z.object({ mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']), sizeBytes: z.number().int().positive().max(10 * 1024 * 1024) }).strict()
type Input = z.infer<typeof inputSchema>

export async function authorizeCatalogImageUpload(request: Request, input: unknown, dependencies: {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  query: (sql: string, params: string[]) => Promise<{ rows: Array<Record<string, unknown>> }>
  sign: (input: Input & { pathname: string }) => Promise<{ uploadUrl: string; imageUrl: string }>
}) {
  if (request.method !== 'POST') return { status: 405 as const }
  const authorization = await authorize(request, dependencies.auth, 'admin')
  if (authorization.status !== 200) return authorization
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { status: 400 as const }
  const assetId = randomUUID()
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[parsed.data.mimeType]
  await dependencies.query("INSERT INTO arsen_catalog_draft_audit (actor_id,action,target_id) VALUES ($1,'image.upload.requested',$2)", [authorization.userId, assetId])
  const urls = await dependencies.sign({ ...parsed.data, pathname: `catalog/images/${assetId}.${extension}` })
  return { status: 200 as const, ...urls }
}
