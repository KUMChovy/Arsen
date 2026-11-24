import type { AdminClerk } from './clerk'

export function readAdminConfig(publishableKey: string, configuredOrigin: string, pageOrigin: string) {
  if (publishableKey.length > 512 || !/^pk_(test|live)_[A-Za-z0-9+/=_-]+$/.test(publishableKey)) throw new Error('Falta configurar la clave pública de Clerk')
  const apiOrigin = configuredOrigin || pageOrigin
  const url = new URL(apiOrigin)
  if (url.protocol !== 'https:' || url.origin !== apiOrigin || url.username || url.password) throw new Error('El origen de la API de administración no es válido')
  return { publishableKey, apiOrigin }
}

export async function getStableAdminToken(clerk: AdminClerk): Promise<string | null> {
  const session = clerk.session
  if (!session) return null
  const token = await session.getToken()
  return clerk.session?.id === session.id ? token : null
}
