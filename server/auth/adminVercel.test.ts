import { afterEach, describe, expect, it, vi } from 'vitest'
import { serveAdminInvitations } from './adminVercel'

describe('administrative deployment gate', () => {
  afterEach(() => vi.unstubAllEnvs())
  const request = () => new Request('https://api.example.test/api/v1/admin/invitations', { method: 'POST', body: '{}' })
  it('remains unavailable unless explicitly enabled and fully configured', async () => {
    vi.stubEnv('ADMIN_API_ENABLED', '')
    expect((await serveAdminInvitations(request())).status).toBe(503)
    vi.stubEnv('ADMIN_API_ENABLED', 'true')
    vi.stubEnv('DATABASE_URL', '')
    expect((await serveAdminInvitations(request())).status).toBe(503)
  })
  it('does not permit unauthenticated requests when configured', async () => {
    vi.stubEnv('ADMIN_API_ENABLED', 'true')
    vi.stubEnv('DATABASE_URL', 'postgresql://user:password@localhost/db')
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example')
    vi.stubEnv('CLERK_ISSUER', 'https://clerk.example.test')
    vi.stubEnv('ACCOUNT_ALLOWED_ORIGINS', 'https://admin.example.test')
    expect((await serveAdminInvitations(request())).status).toBe(401)
    expect((await serveAdminInvitations(new Request('https://api.example.test/api/v1/admin/accounts'))).status).toBe(401)
  })
})
