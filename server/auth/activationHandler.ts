import { activateClerkInvitation } from './activateInvitation'

export async function activateAccount(request: Request, dependencies: {
  verify: (token: string) => Promise<string>
  getUser: (userId: string) => Promise<{ userId: string; verifiedEmail: string | null; invitationId: string | null }>
  query: (sql: string, params: string[]) => Promise<{ rows: Array<{ user_id: string }> }>
}): Promise<{ status: 200 | 401 | 403 }> {
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') ?? '')
  if (!match?.[1]) return { status: 401 }
  let userId: string
  try { userId = await dependencies.verify(match[1]) } catch { return { status: 401 } }
  const activated = await activateClerkInvitation(match[1], { ...dependencies, verify: async () => userId })
  return { status: activated ? 200 : 403 }
}
