export async function activateAccount(request: Request, dependencies: {
  verify: (token: string) => Promise<string>
  getUser: (userId: string) => Promise<{ userId: string; verifiedEmail: string | null; invitationId: string | null }>
  query: (sql: string, params: string[]) => Promise<{ rows: Array<{ user_id: string }> }>
}): Promise<{ status: 200 | 401 | 403 }> {
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') ?? '')
  if (!match?.[1]) return { status: 401 }
  let userId: string
  try { userId = await dependencies.verify(match[1]) } catch { return { status: 401 } }
  const identity = await dependencies.getUser(userId)
  if (!userId.trim() || identity.userId !== userId || !identity.verifiedEmail) return { status: 403 }
  await dependencies.query('INSERT INTO arsen_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [userId])
  return { status: 200 }
}
