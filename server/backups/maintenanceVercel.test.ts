import { afterEach, describe, expect, it, vi } from 'vitest'
import { serveCleanup } from './maintenanceVercel'

describe('cleanup deployment gate', () => {
  afterEach(() => vi.unstubAllEnvs())
  const request = () => new Request('https://api.example.test/api/cron/cleanup')
  it('stays unavailable by default and with incomplete settings', async () => {
    vi.stubEnv('BACKUP_MAINTENANCE_ENABLED', '')
    expect((await serveCleanup(request())).status).toBe(503)
    vi.stubEnv('BACKUP_MAINTENANCE_ENABLED', 'true')
    vi.stubEnv('DATABASE_URL', '')
    expect((await serveCleanup(request())).status).toBe(503)
  })
  it('denies missing authorization without contacting storage', async () => {
    vi.stubEnv('BACKUP_MAINTENANCE_ENABLED', 'true')
    vi.stubEnv('DATABASE_URL', 'postgresql://user:password@localhost/db')
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'example')
    vi.stubEnv('CRON_SECRET', 's'.repeat(40))
    expect((await serveCleanup(request())).status).toBe(401)
  })
})
