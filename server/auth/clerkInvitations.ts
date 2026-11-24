import { z } from 'zod'

const item = z.object({ email_address: z.string(), public_metadata: z.object({ arsen_invitation_id: z.string().optional() }).nullable(), status: z.enum(['pending', 'accepted', 'expired', 'revoked']) })
const page = z.union([z.array(item), z.object({ data: z.array(item), total_count: z.number().int().nonnegative() })])
const input = z.object({ marker: z.string().uuid(), email: z.string().email().max(254) })

export function createClerkInvitationClient(secretKey: string, fetcher: typeof fetch = fetch) {
  if (!secretKey) throw new Error('Falta la configuración de Clerk')
  const headers = { authorization: `Bearer ${secretKey}` }
  return {
    async find(marker: string, email: string): Promise<boolean> {
      input.parse({ marker, email })
      for (const status of ['current', 'revoked'] as const) {
        let offset = 0
        let complete = false
        for (let attempt = 0; attempt < 100; attempt++) {
          const params = new URLSearchParams({ query: email, limit: '100', offset: String(offset) })
          if (status === 'revoked') params.set('status', status)
          const response = await fetcher(`https://api.clerk.com/v1/invitations?${params}`, { headers, signal: AbortSignal.timeout(5000), redirect: 'error' })
          if (!response.ok) throw new Error('No se pudieron consultar invitaciones')
          const parsed = page.parse(await response.json())
          const data = Array.isArray(parsed) ? parsed : parsed.data
          for (const entry of data) {
            if (entry.email_address.toLowerCase() === email.toLowerCase() && entry.public_metadata?.arsen_invitation_id === marker) {
              if (entry.status === 'pending' || entry.status === 'accepted') return true
              throw new Error('La invitación ya no está vigente')
            }
          }
          offset += data.length
          if (Array.isArray(parsed) ? data.length < 100 : offset >= parsed.total_count) { complete = true; break }
          if (data.length === 0) throw new Error('La paginación de Clerk está incompleta')
        }
        if (!complete) throw new Error('Demasiadas invitaciones para verificar')
      }
      return false
    },
    async create(marker: string, email: string): Promise<void> {
      input.parse({ marker, email })
      const response = await fetcher('https://api.clerk.com/v1/invitations', {
        method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, signal: AbortSignal.timeout(5000), redirect: 'error',
        body: JSON.stringify({ email_address: email, public_metadata: { arsen_invitation_id: marker }, expires_in_days: 7, notify: true, ignore_existing: false }),
      })
      if (!response.ok) throw new Error('No se pudo crear la invitación')
    },
  }
}
