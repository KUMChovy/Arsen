import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { z } from 'zod'

export async function createInvitation(
  query: (sql: string, params: string[]) => Promise<unknown>,
  address: string,
): Promise<{ id: string; token: string }> {
  const email = z.string().trim().email().max(254).parse(address).toLowerCase()
  const id = randomUUID()
  const token = randomBytes(32).toString('base64url')
  const hash = createHash('sha256').update(token).digest('hex')
  await query("INSERT INTO arsen_invitations (id, email, token_sha256, expires_at) VALUES ($1, $2, $3, now() + interval '7 days')", [id, email, hash])
  return { id, token }
}
