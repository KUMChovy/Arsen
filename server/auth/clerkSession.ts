import { z } from 'zod'

const sessionSchema = z.object({ id: z.string().min(1), user_id: z.string().min(1), status: z.string().min(1) })
const userSchema = z.object({
  id: z.string().min(1), banned: z.boolean(), locked: z.boolean(), deprovisioned: z.boolean(),
  primary_email_address_id: z.string().nullable(),
  public_metadata: z.object({ arsen_invitation_id: z.string().uuid().optional() }).nullable().optional(),
  email_addresses: z.array(z.object({ id: z.string(), email_address: z.string().email().max(254), verification: z.object({ status: z.string() }).nullable() })),
})

function reader(secretKey: string, fetcher: typeof fetch) {
  if (!secretKey) throw new Error('Falta la configuración de Clerk')
  return async (kind: 'sessions' | 'users', id: string) => {
    const prefix = kind === 'sessions' ? 'sess' : 'user'
    if (!new RegExp(`^${prefix}_[a-zA-Z0-9]+$`).test(id)) throw new Error('Identificador de Clerk inválido')
    const response = await fetcher(`https://api.clerk.com/v1/${kind}/${id}`, {
      headers: { authorization: `Bearer ${secretKey}` }, signal: AbortSignal.timeout(5000), redirect: 'error',
    })
    if (!response.ok) throw new Error('No se pudo consultar Clerk')
    return response.json()
  }
}

export function createClerkSessionReader(secretKey: string, fetcher: typeof fetch = fetch) {
  const get = reader(secretKey, fetcher)
  return async (sessionId: string): Promise<{ id: string; userId: string; status: string }> => {
    const session = sessionSchema.parse(await get('sessions', sessionId))
    return { id: session.id, userId: session.user_id, status: session.status }
  }
}

export function createClerkUserReader(secretKey: string, fetcher: typeof fetch = fetch) {
  const get = reader(secretKey, fetcher)
  return async (userId: string): Promise<{ userId: string; verifiedEmail: string | null; invitationId: string | null }> => {
    const user = userSchema.parse(await get('users', userId))
    if (user.id !== userId || user.banned || user.locked || user.deprovisioned) throw new Error('La cuenta no está disponible')
    const email = user.email_addresses.find((item) => item.id === user.primary_email_address_id)
    return { userId, verifiedEmail: email?.verification?.status === 'verified' ? email.email_address : null, invitationId: user.public_metadata?.arsen_invitation_id ?? null }
  }
}
