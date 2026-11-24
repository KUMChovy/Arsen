import { describe, expect, it, vi } from 'vitest'
import { createAccountHandler } from './accountHandler'

describe('private account endpoint', () => {
  const allowed = 'https://app.example.test'
  const handler = createAccountHandler({ verify: async (token) => { if (token !== 'valid') throw new Error('invalid'); return 'user_a' }, role: async () => 'user' }, [allowed])
  const request = (options: { method?: string; token?: string; origin?: string } = {}) => new Request('https://api.example.test/api/v1/account', {
    method: options.method ?? 'GET', headers: { ...(options.token ? { authorization: `Bearer ${options.token}` } : {}), ...(options.origin ? { origin: options.origin } : {}) },
  })
  it('requires an active authorized session and disables caching', async () => {
    expect((await handler(request())).status).toBe(401)
    expect((await handler(request({ token: 'invalid' }))).status).toBe(401)
    const response = await handler(request({ token: 'valid', origin: allowed }))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('access-control-allow-origin')).toBe(allowed)
    expect(await response.json()).toEqual({ userId: 'user_a' })
  })
  it('rejects unapproved origins and handles preflight only for allowed origins', async () => {
    expect((await handler(request({ token: 'valid', origin: 'https://evil.example.test' }))).status).toBe(403)
    expect((await handler(request({ method: 'OPTIONS', origin: allowed }))).status).toBe(204)
    expect((await handler(request({ method: 'POST', token: 'valid' }))).status).toBe(405)
  })
  it('does not reveal accounts without an application profile', async () => {
    const noProfile = createAccountHandler({ verify: async () => 'user_a', role: async () => null }, [allowed])
    expect((await noProfile(request({ token: 'valid' }))).status).toBe(403)
  })
  it('routes activation and bounded device registration without accepting arbitrary paths', async () => {
    const activate = vi.fn(async () => ({ status: 200 }))
    const devices = vi.fn(async (_request: Request, _input: unknown) => ({ status: 200, id: 'device' }))
    const extended = createAccountHandler({ verify: async () => 'user_a', role: async () => 'user' }, [allowed], { activate, devices })
    const activation = await extended(new Request('https://api.example.test/api/v1/account/activate', { method: 'POST', headers: { origin: allowed } }))
    expect(activation.status).toBe(200)
    const body = JSON.stringify({ id: 'device' })
    const device = await extended(new Request('https://api.example.test/api/v1/account/devices', { method: 'POST', headers: { origin: allowed }, body }))
    expect(device.status).toBe(200)
    expect(devices.mock.calls[0]?.[1]).toEqual({ id: 'device' })
    const tooLarge = await extended(new Request('https://api.example.test/api/v1/account/devices', { method: 'POST', body: 'x'.repeat(4097) }))
    expect(tooLarge.status).toBe(400)
    expect((await extended(new Request('https://api.example.test/api/v1/account/unknown'))).status).toBe(404)
  })
})
