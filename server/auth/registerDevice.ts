import { z } from 'zod'
import { authorize } from './authorize'

export async function registerDevice(request: Request, input: unknown, dependencies: {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  query: (sql: string, params: string[]) => Promise<{ rows: Array<Record<string, unknown>> }>
}): Promise<{ status: 200; id: string } | { status: 400 | 401 | 403 | 405 | 409 }> {
  if (request.method !== 'POST') return { status: 405 }
  const authorization = await authorize(request, dependencies.auth)
  if (authorization.status !== 200) return authorization
  const parsed = z.object({ id: z.string().uuid() }).strict().safeParse(input)
  if (!parsed.success) return { status: 400 }
  const result = await dependencies.query(`
    INSERT INTO arsen_devices (id, user_id) VALUES ($1, $2)
    ON CONFLICT (id) DO UPDATE SET id = arsen_devices.id
    WHERE arsen_devices.user_id = EXCLUDED.user_id RETURNING id::text
  `, [parsed.data.id, authorization.userId])
  return result.rows.length === 1 ? { status: 200, id: parsed.data.id } : { status: 409 }
}
