type Role = 'user' | 'admin'
type Authorization = { status: 200; userId: string } | { status: 401 | 403 }

export async function authorize(
  request: Request,
  dependencies: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<Role | null> },
  required: Role = 'user',
): Promise<Authorization> {
  const match = /^Bearer ([^\s]+)$/i.exec(request.headers.get('authorization') ?? '')
  if (!match?.[1]) return { status: 401 }
  let userId: string
  try {
    userId = await dependencies.verify(match[1])
  } catch {
    return { status: 401 }
  }
  const role = await dependencies.role(userId)
  if (role !== 'admin' && (role !== 'user' || required === 'admin')) return { status: 403 }
  return { status: 200, userId }
}
