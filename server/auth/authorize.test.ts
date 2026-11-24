import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'
import { authorize } from './authorize'
import { createTokenVerifier } from './verifyToken'

describe('server authorization', () => {
  let token: string
  let verify: ReturnType<typeof createTokenVerifier>
  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
    const key = { ...await exportJWK(publicKey), kid: 'key' }
    verify = createTokenVerifier({ issuer: 'https://auth.test', audience: 'api', jwks: createLocalJWKSet({ keys: [key] }) })
    token = await new SignJWT({ role: 'admin' }).setProtectedHeader({ alg: 'ES256', kid: 'key' })
      .setIssuer('https://auth.test').setAudience('api').setSubject('user-a').setExpirationTime('5m').sign(privateKey)
  })

  it('denies absent and invalid credentials', async () => {
    const role = async () => 'user' as const
    await expect(authorize(new Request('https://api.test'), { verify, role })).resolves.toEqual({ status: 401 })
    await expect(authorize(new Request('https://api.test', { headers: { authorization: 'Bearer bad' } }), { verify, role })).resolves.toEqual({ status: 401 })
  })

  it('derives identity from the verified token and rejects client-supplied administrator claims', async () => {
    const request = new Request('https://api.test', { headers: { authorization: `Bearer ${token}`, 'x-user-id': 'user-b', 'x-role': 'admin' } })
    const role = async (id: string) => id === 'user-a' ? 'user' as const : 'admin' as const
    await expect(authorize(request, { verify, role })).resolves.toEqual({ status: 200, userId: 'user-a' })
    await expect(authorize(request, { verify, role }, 'admin')).resolves.toEqual({ status: 403 })
  })

  it('allows an administrator only when the trusted role lookup grants it', async () => {
    const request = new Request('https://api.test', { headers: { authorization: `Bearer ${token}` } })
    await expect(authorize(request, { verify, role: async () => 'admin' }, 'admin')).resolves.toEqual({ status: 200, userId: 'user-a' })
    await expect(authorize(request, { verify, role: async () => null })).resolves.toEqual({ status: 403 })
  })
})
