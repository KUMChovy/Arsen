import { describe, expect, it, vi } from 'vitest'
import { createApiRouter, createRewriteGateway } from './apiRouter'

describe('Vercel API router', () => {
  it('routes known paths to their existing handlers without widening access', async () => {
    const operation = (name: string) => vi.fn(async () => new Response(name))
    const handlers = { account: operation('account'), backups: operation('backups'), admin: operation('admin'), adminCatalog: operation('adminCatalog'), catalog: operation('catalog'), cleanup: operation('cleanup') }
    const route = createApiRouter(handlers)
    for (const [path, name] of [['/api/v1/account/devices', 'account'], ['/api/v1/backups/latest', 'backups'], ['/api/v1/admin/accounts/user_a/backups', 'admin'], ['/api/v1/admin/catalog/publish', 'adminCatalog'], ['/api/v1/catalog/version', 'catalog'], ['/api/cron/cleanup', 'cleanup']] as const) {
      expect(await (await route(new Request(`https://example.test${path}`))).text()).toBe(name)
    }
    const unknown = await route(new Request('https://example.test/api/v1/admin/catalogue'))
    expect(unknown.status).toBe(404)
    expect(unknown.headers.get('cache-control')).toBe('no-store')
  })
  it('passes the rewritten pathname and original request body to the controller', async () => {
    const route = vi.fn(async (request: Request) => new Response(`${new URL(request.url).pathname}:${await request.text()}`))
    const gateway = createRewriteGateway(route)
    const response = await gateway(new Request('https://example.test/api/gateway?__arsen_path=v1%2Fbackups%2Fconfirm', { method: 'POST', body: 'payload' }))
    expect(await response.text()).toBe('/api/v1/backups/confirm:payload')
    expect((await gateway(new Request('https://example.test/api/gateway?__arsen_path=..%2Fadmin'))).status).toBe(404)
  })
})
