import { afterEach, describe, expect, it, vi } from 'vitest'
import { safeBackupFailure, serveBackups } from './vercel'

describe('backup deployment gate', () => {
  afterEach(() => vi.unstubAllEnvs())
  const request = () => new Request('https://api.example.test/api/v1/backups')
  it('remains unavailable without explicit enablement and complete configuration', async () => {
    vi.stubEnv('BACKUP_API_ENABLED', '')
    expect((await serveBackups(request())).status).toBe(503)
    vi.stubEnv('BACKUP_API_ENABLED', 'true')
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')
    expect((await serveBackups(request())).status).toBe(503)
  })
  it('refuses invalid backup limits and unsafe issuers before contacting services', async () => {
    vi.stubEnv('BACKUP_API_ENABLED', 'true')
    vi.stubEnv('DATABASE_URL', 'postgresql://user:password@localhost/db')
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'example')
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example')
    vi.stubEnv('CLERK_ISSUER', 'https://clerk.example.test')
    vi.stubEnv('ACCOUNT_ALLOWED_ORIGINS', 'https://app.example.test')
    for (const limit of ['', '0', '1e100', 'not-a-number']) {
      vi.stubEnv('BACKUP_MAX_BYTES', limit)
      expect((await serveBackups(request())).status).toBe(503)
    }
    vi.stubEnv('BACKUP_MAX_BYTES', '1000000')
    vi.stubEnv('CLERK_ISSUER', 'http://unsafe.example.test')
    expect((await serveBackups(request())).status).toBe(503)
  })
  it('requires authentication even when the endpoint is configured', async () => {
    vi.stubEnv('BACKUP_API_ENABLED', 'true')
    vi.stubEnv('DATABASE_URL', 'postgresql://user:password@localhost/db')
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'example')
    vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_example')
    vi.stubEnv('CLERK_ISSUER', 'https://clerk.example.test')
    vi.stubEnv('ACCOUNT_ALLOWED_ORIGINS', 'https://app.example.test')
    vi.stubEnv('BACKUP_MAX_BYTES', '1000000')
    expect((await serveBackups(request())).status).toBe(401)
  })
  it('logs only fixed diagnostic categories, never exception content', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    safeBackupFailure('blob-read', new Error('sensitive backup data and token'))
    expect(log).toHaveBeenCalledWith('arsen-backup', 'blob-read', 'other')
    expect(JSON.stringify(log.mock.calls)).not.toContain('sensitive')
    log.mockRestore()
  })
})
