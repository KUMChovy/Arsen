import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { authorize } from './authorize'

type Dependencies = {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  query: (sql: string, params: string[]) => Promise<{ rows: Array<Record<string, unknown>> }>
  find: (marker: string, email: string) => Promise<boolean>
  create: (marker: string, email: string) => Promise<void>
}
type Result = { status: 200; id: string } | { status: 400 | 401 | 403 | 405 | 409 | 503 }
const inputSchema = z.object({ id: z.string().uuid(), email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()) }).strict()

export async function issueClerkInvitation(request: Request, input: unknown, dependencies: Dependencies): Promise<Result> {
  if (request.method !== 'POST') return { status: 405 }
  const auth = await authorize(request, dependencies.auth, 'admin')
  if (auth.status !== 200) return auth
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return { status: 400 }
  const { id, email } = parsed.data
  const hash = createHash('sha256').update(randomBytes(32)).digest('hex')
  await dependencies.query(`
    WITH created AS (
      INSERT INTO arsen_invitations (id,email,token_sha256,expires_at) VALUES ($1,$2,$3,now() + interval '7 days')
      ON CONFLICT (id) DO NOTHING RETURNING id
    )
    INSERT INTO arsen_admin_audit (actor_id, action, target_id)
    SELECT $4, 'invitation.requested', id FROM created
  `, [id, email, hash, auth.userId])
  const existing = (await dependencies.query('SELECT email, accepted_at, expires_at > now() AS valid FROM arsen_invitations WHERE id = $1', [id])).rows[0]
  if (!existing || existing.email !== email || existing.accepted_at !== null || existing.valid !== true) return { status: 409 }
  try {
    if (!await dependencies.find(id, email)) await dependencies.create(id, email)
    return { status: 200, id }
  } catch {
    return { status: 503 }
  }
}
