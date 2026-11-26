import { z } from 'zod'

const identity = z.object({ id: z.string(), banned: z.boolean() })
async function isMissingIdentity(response: Response): Promise<boolean> {
  if (response.status !== 404) return false
  const parsed = z.object({ errors: z.array(z.object({ code: z.string() })) }).safeParse(await response.json().catch(() => null))
  return parsed.success && parsed.data.errors.some((error) => error.code === 'resource_not_found')
}
export function createClerkDeletionClient(secretKey: string, fetcher: typeof fetch = fetch) {
  if (!secretKey) throw new Error('Falta la configuración de Clerk')
  const url = (id: string) => {
    if (!/^user_[A-Za-z0-9]{1,123}$/.test(id)) throw new Error('Identificador inválido')
    return `https://api.clerk.com/v1/users/${id}`
  }
  const options = { headers: { authorization: `Bearer ${secretKey}` }, redirect: 'error' as const }
  return {
    async ban(id: string): Promise<void> {
      const response = await fetcher(url(id), { ...options, signal: AbortSignal.timeout(5000) })
      if (await isMissingIdentity(response)) return
      if (!response.ok) throw new Error('No se pudo consultar la cuenta')
      const user = identity.parse(await response.json())
      if (user.id !== id) throw new Error('Identidad incorrecta')
      if (user.banned) return
      const banned = await fetcher(`${url(id)}/ban`, { ...options, method: 'POST', signal: AbortSignal.timeout(5000) })
      if (!banned.ok) throw new Error('No se pudo revocar el acceso')
      const result = identity.parse(await banned.json())
      if (result.id !== id || !result.banned) throw new Error('No se pudo verificar la revocación')
    },
    async deleteIdentity(id: string): Promise<void> {
      const response = await fetcher(url(id), { ...options, method: 'DELETE', signal: AbortSignal.timeout(5000) })
      if (response.ok) return
      if (await isMissingIdentity(response)) return
      throw new Error('No se pudo eliminar la identidad')
    },
  }
}
