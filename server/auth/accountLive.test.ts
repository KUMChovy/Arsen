import { afterAll, describe, expect, it, vi } from 'vitest'
import { serveAccount } from './accountVercel'
import { serveAdminInvitations } from './adminVercel'

describe.skipIf(process.env.RUN_CLERK_LIVE_CHECK !== '1')('Clerk and Neon account integration smoke test', () => {
  afterAll(() => vi.unstubAllEnvs())
  it('authenticates a real development session and resolves its profile', async () => {
    const secret = process.env.CLERK_SECRET_KEY
    if (!secret || !process.env.DATABASE_URL) throw new Error('Falta la configuración de desarrollo')
    const headers = { authorization: `Bearer ${secret}` }
    const options = { headers, signal: AbortSignal.timeout(10000), redirect: 'error' as const }
    const [instanceResponse, usersResponse, domainsResponse] = await Promise.all([
      fetch('https://api.clerk.com/v1/instance', options), fetch('https://api.clerk.com/v1/users?limit=2', options), fetch('https://api.clerk.com/v1/domains', options),
    ])
    if (![instanceResponse, usersResponse, domainsResponse].every((response) => response.ok)) throw new Error('No se pudo consultar Clerk')
    const instance = await instanceResponse.json()
    const usersBody = await usersResponse.json()
    const domainsBody = await domainsResponse.json()
    const users = Array.isArray(usersBody) ? usersBody : usersBody.data
    const domains = Array.isArray(domainsBody) ? domainsBody : domainsBody.data
    if (instance.environment_type !== 'development' || !Array.isArray(users) || users.length !== 1) throw new Error('Se requiere una cuenta de desarrollo')
    const issuer = new URL(domains.find((domain: { is_satellite: boolean }) => !domain.is_satellite).frontend_api_url).origin
    const params = new URLSearchParams({ status: 'active', limit: '2', user_id: users[0].id })
    const sessionsResponse = await fetch(`https://api.clerk.com/v1/sessions?${params}`, options)
    if (!sessionsResponse.ok) throw new Error('No se pudo consultar la sesión')
    const sessionBody = await sessionsResponse.json()
    const sessions = Array.isArray(sessionBody) ? sessionBody : sessionBody.data
    if (!Array.isArray(sessions) || sessions.length < 1 || !/^sess_[A-Za-z0-9]+$/.test(sessions[0].id)) throw new Error('No hay sesión activa')
    const tokenResponse = await fetch(`https://api.clerk.com/v1/sessions/${sessions[0].id}/tokens`, { ...options, method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: '{}' })
    if (!tokenResponse.ok) throw new Error('No se pudo emitir un token de prueba')
    const { jwt } = await tokenResponse.json()
    vi.stubEnv('ACCOUNT_API_ENABLED', 'true')
    vi.stubEnv('CLERK_ISSUER', issuer)
    vi.stubEnv('ACCOUNT_ALLOWED_ORIGINS', 'https://app.example.test')
    vi.stubEnv('CLERK_ALLOW_NATIVE_NO_AZP', 'true')
    const response = await serveAccount(new Request('https://api.example.test/api/v1/account', { headers: { authorization: `Bearer ${jwt}` } }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ userId: users[0].id })
    vi.stubEnv('ADMIN_API_ENABLED', 'true')
    const admin = await serveAdminInvitations(new Request('https://api.example.test/api/v1/admin/invitations', { method: 'POST', headers: { authorization: `Bearer ${jwt}` }, body: '{}' }))
    expect(admin.status).toBe(400)
  }, 30_000)
})
