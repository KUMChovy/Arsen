import { describe, expect, it, vi } from 'vitest'
import { createBackupHandler } from './handler'

describe('private backup HTTP transport', () => {
  const call = vi.fn(async () => ({ status: 200, value: 'ok' }))
  const operations = { list: call, prepare: call, manifestUpload: call, reserve: call, assetUpload: call, confirm: call, download: call }
  const handler = createBackupHandler(operations, ['https://app.example.test'])
  it('dispatches only supported routes and prevents caching', async () => {
    const response = await handler(new Request('https://api.example.test/api/v1/backups', { headers: { origin: 'https://app.example.test' } }))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example.test')
    expect((await handler(new Request('https://api.example.test/api/v1/unknown'))).status).toBe(404)
  })
  it('rejects unknown origins and oversized JSON before invoking operations', async () => {
    call.mockClear()
    expect((await handler(new Request('https://api.example.test/api/v1/backups', { headers: { origin: 'https://evil.example.test' } }))).status).toBe(403)
    const request = new Request('https://api.example.test/api/v1/backups/reserve', { method: 'POST', body: JSON.stringify({ value: 'x'.repeat(2 * 1024 * 1024 + 1) }) })
    expect((await handler(request)).status).toBe(400)
    expect(call).not.toHaveBeenCalled()
  })
  it('does not reveal internal errors or allow caching them', async () => {
    const broken = createBackupHandler({ ...operations, list: async () => { throw new Error('sensitive internal detail') } }, [])
    const response = await broken(new Request('https://api.example.test/api/v1/backups'))
    expect(response.status).toBe(503)
    expect(await response.text()).toBe('')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
  it('serves latest and individual confirmed backups through the authenticated list', async () => {
    const id = '8166d21c-bac3-497b-9d22-8492474c982b'
    const list = vi.fn(async (request: Request) => request.headers.has('authorization')
      ? { status: 200 as const, backups: [{ id }] }
      : { status: 401 as const })
    const subject = createBackupHandler({ ...operations, list }, [])
    const get = (path: string, authorized = true) => subject(new Request(`https://api.example.test${path}`, { headers: authorized ? { authorization: 'Bearer token' } : {} }))
    expect((await get('/api/v1/backups/latest', false)).status).toBe(401)
    const latest = await get('/api/v1/backups/latest')
    expect(await latest.json()).toEqual({ backup: { id } })
    expect(await (await get(`/api/v1/backups/${id}`)).json()).toEqual({ backup: { id } })
    expect((await get('/api/v1/backups/c535e624-6166-4cc2-8858-17991596a999')).status).toBe(404)
    expect((await get('/api/v1/backups/invalid')).status).toBe(404)
    expect((await subject(new Request('https://api.example.test/api/v1/backups/latest', { method: 'POST' }))).status).toBe(405)
    const empty = createBackupHandler({ ...operations, list: async () => ({ status: 200, backups: [] }) }, [])
    expect((await empty(new Request('https://api.example.test/api/v1/backups/latest'))).status).toBe(404)
  })
})
