import { authorize } from '../auth/authorize'

export async function runManualMaintenance(request: Request, dependencies: {
  auth: { verify: (token: string) => Promise<string>; role: (userId: string) => Promise<'user' | 'admin' | null> }
  run: () => Promise<{ status: string; deleted: number }>
}) {
  if (request.method !== 'POST') return { status: 405 as const }
  const authorization = await authorize(request, dependencies.auth, 'admin')
  if (authorization.status !== 200) return authorization
  const result = await dependencies.run()
  return { status: 200 as const, result: result.status, deleted: result.deleted }
}
