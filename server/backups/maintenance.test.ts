import { describe, expect, it, vi } from 'vitest'
import { createCleanupHandler, runBackupMaintenance } from './maintenance'

describe('private backup cleanup trigger', () => {
  const secret = 's'.repeat(40)
  const run = vi.fn(async () => ({ status: 'idle' as const, deleted: 0 }))
  const request = (token?: string, method = 'GET') => new Request('https://api.example.test/api/cron/cleanup', { method, headers: token ? { authorization: `Bearer ${token}` } : {} })
  it('requires a strong server secret and rejects invalid credentials', async () => {
    expect(() => createCleanupHandler('short', run)).toThrow()
    const handler = createCleanupHandler(secret, run)
    expect((await handler(request())).status).toBe(401)
    expect((await handler(request('wrong'))).status).toBe(401)
    expect((await handler(request(secret, 'POST'))).status).toBe(405)
    expect(run).not.toHaveBeenCalled()
  })
  it('runs maintenance only with the correct token and never caches responses', async () => {
    const response = await createCleanupHandler(secret, run)(request(secret))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ status: 'idle', deleted: 0 })
    expect(run).toHaveBeenCalledOnce()
  })
  it('does not reveal internal errors', async () => {
    const response = await createCleanupHandler(secret, async () => { throw new Error('private detail') })(request(secret))
    expect(response.status).toBe(503)
    expect(await response.text()).toBe('')
  })
})

describe('backup maintenance selection', () => {
  it('expires an old pending version when no completed cleanup is due', async () => {
    const cleanup = vi.fn(async () => ({ status: 'idle' as const, deleted: 0 }))
    const expire = vi.fn(async () => ({ status: 'expired' as const }))
    expect(await runBackupMaintenance(cleanup, expire)).toEqual({ status: 'expired', deleted: 0 })
    expect(expire).toHaveBeenCalledOnce()
  })
  it('prioritizes an existing cleanup batch without expiring another backup', async () => {
    const expire = vi.fn(async () => ({ status: 'expired' as const }))
    expect(await runBackupMaintenance(async () => ({ status: 'pending', deleted: 3 }), expire)).toEqual({ status: 'pending', deleted: 3 })
    expect(expire).not.toHaveBeenCalled()
  })
})
