import { afterEach, describe, expect, it, vi } from 'vitest'
import { serveAccount } from './accountVercel'

describe('private account deployment gate', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('stays unavailable without explicit enablement or complete configuration', async () => {
    vi.stubEnv('ACCOUNT_API_ENABLED', '')
    expect((await serveAccount(new Request('https://api.example.test/api/v1/account'))).status).toBe(503)
    vi.stubEnv('ACCOUNT_API_ENABLED', 'true')
    vi.stubEnv('DATABASE_URL', '')
    expect((await serveAccount(new Request('https://api.example.test/api/v1/account'))).status).toBe(503)
  })
  it('rejects an unsafe issuer before making network calls', async () => {
    vi.stubEnv('ACCOUNT_API_ENABLED', 'true')
    vi.stubEnv('DATABASE_URL', 'postgresql://user:password@localhost/db')
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example')
    vi.stubEnv('CLERK_ISSUER', 'http://not-secure.example.test')
    vi.stubEnv('ACCOUNT_ALLOWED_ORIGINS', 'https://app.example.test')
    expect((await serveAccount(new Request('https://api.example.test/api/v1/account'))).status).toBe(503)
  })
  it('rejects unauthenticated requests even when enabled and configured', async () => {
    vi.stubEnv('ACCOUNT_API_ENABLED', 'true')
    vi.stubEnv('DATABASE_URL', 'postgresql://user:password@localhost/db')
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example')
    vi.stubEnv('CLERK_ISSUER', 'https://clerk.example.test')
    vi.stubEnv('ACCOUNT_ALLOWED_ORIGINS', 'https://app.example.test')
    const response = await serveAccount(new Request('https://api.example.test/api/v1/account'))
    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('fails closed on a wildcard or non-HTTPS allowed origin', async () => {
    vi.stubEnv('ACCOUNT_API_ENABLED', 'true')
    vi.stubEnv('DATABASE_URL', 'postgresql://user:password@localhost/db')
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example')
    vi.stubEnv('CLERK_ISSUER', 'https://clerk.example.test')
    for (const origin of ['*', 'http://unsafe.example.test']) {
      vi.stubEnv('ACCOUNT_ALLOWED_ORIGINS', origin)
      expect((await serveAccount(new Request('https://api.example.test/api/v1/account'))).status).toBe(503)
    }
  })
})
