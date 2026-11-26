import { describe, expect, it, vi } from 'vitest'
import { createAdminHandler } from './adminHandler'

describe('administrative invitation transport', () => {
  const issue = vi.fn(async () => ({ status: 200, id: 'created' }))
  const handler = createAdminHandler(issue, ['https://admin.example.test'])
  it('rejects unapproved origins and unsupported methods', async () => {
    expect((await handler(new Request('https://api.test/api/v1/admin/invitations', { method: 'POST', headers: { origin: 'https://evil.example.test' } }))).status).toBe(403)
    expect((await handler(new Request('https://api.test/api/v1/admin/invitations'))).status).toBe(405)
  })
  it('passes bounded JSON to the authorized operation without caching the result', async () => {
    const response = await handler(new Request('https://api.test/api/v1/admin/invitations', { method: 'POST', body: JSON.stringify({ id: 'example' }) }))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({ id: 'created' })
    expect((await handler(new Request('https://api.test/api/v1/admin/invitations', { method: 'POST', body: 'x'.repeat(4097) }))).status).toBe(400)
  })
  it('does not expose internal errors', async () => {
    const broken = createAdminHandler(async () => { throw new Error('private detail') }, [])
    const response = await broken(new Request('https://api.test/api/v1/admin/invitations', { method: 'POST', body: '{}' }))
    expect(response.status).toBe(503)
    expect(await response.text()).toBe('')
  })
  it('routes account summaries only via GET without caching', async () => {
    const listAccounts = vi.fn(async () => ({ status: 200, accounts: [], nextCursor: null }))
    const subject = createAdminHandler(issue, ['https://admin.example.test'], { listAccounts })
    const url = 'https://api.test/api/v1/admin/accounts?cursor=user_abc'
    expect((await subject(new Request(url, { method: 'POST' }))).status).toBe(405)
    const result = await subject(new Request(url, { headers: { origin: 'https://admin.example.test' } }))
    expect(result.status).toBe(200)
    expect(result.headers.get('cache-control')).toBe('no-store')
    expect(listAccounts).toHaveBeenCalledWith(expect.any(Request), 'user_abc')
  })
  it('routes account backup metadata only via GET', async () => {
    const listAccounts = vi.fn(async () => ({ status: 200, accounts: [] }))
    const listBackups = vi.fn(async () => ({ status: 200, backups: [] }))
    const subject = createAdminHandler(issue, [], { listAccounts, listBackups })
    const url = 'https://api.test/api/v1/admin/accounts/user_abc/backups'
    expect((await subject(new Request(url, { method: 'POST' }))).status).toBe(405)
    expect((await subject(new Request(url))).status).toBe(200)
    expect(listBackups).toHaveBeenCalledWith(expect.any(Request), 'user_abc')
  })
  it('routes the overview only via GET', async () => {
    const listAccounts = vi.fn(async () => ({ status: 200, accounts: [] }))
    const overview = vi.fn(async () => ({ status: 200, accounts: 2 }))
    const subject = createAdminHandler(issue, [], { listAccounts, overview })
    const url = 'https://api.test/api/v1/admin/overview'
    expect((await subject(new Request(url, { method: 'POST' }))).status).toBe(405)
    expect(await (await subject(new Request(url))).json()).toEqual({ accounts: 2 })
    expect(overview).toHaveBeenCalledTimes(1)
  })
  it('routes manual maintenance only via POST', async () => {
    const maintenance = vi.fn(async () => ({ status: 200, result: 'idle', deleted: 0 }))
    const subject = createAdminHandler(issue, [], { listAccounts: async () => ({ status: 200 }), maintenance })
    const url = 'https://api.test/api/v1/admin/maintenance'
    expect((await subject(new Request(url))).status).toBe(405)
    expect(await (await subject(new Request(url, { method: 'POST' }))).json()).toEqual({ result: 'idle', deleted: 0 })
    expect(maintenance).toHaveBeenCalledOnce()
  })
  it('routes account deletion only through POST with bounded JSON', async () => {
    const deleteAccount = vi.fn(async () => ({ status: 200, result: 'waiting' }))
    const subject = createAdminHandler(issue, [], { listAccounts: async () => ({ status: 200 }), deleteAccount })
    const url = 'https://api.test/api/v1/admin/accounts/delete'
    expect((await subject(new Request(url))).status).toBe(405)
    expect(await (await subject(new Request(url, { method: 'POST', body: JSON.stringify({ userId: 'user_a' }) }))).json()).toEqual({ result: 'waiting' })
    expect(deleteAccount).toHaveBeenCalledWith(expect.any(Request), { userId: 'user_a' })
    expect((await subject(new Request(url, { method: 'POST', body: 'x'.repeat(4097) }))).status).toBe(400)
  })
})
