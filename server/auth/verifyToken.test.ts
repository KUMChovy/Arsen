import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'
import { createTokenVerifier } from './verifyToken'

describe('server token verification', () => {
  const issuer = 'https://auth.example.test'
  const audience = 'arsen-api'
  let sign: (claims?: { issuer?: string; audience?: string; expiresIn?: string; subject?: string }) => Promise<string>
  let verify: ReturnType<typeof createTokenVerifier>

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
    const key = await exportJWK(publicKey)
    key.kid = 'test-key'
    const jwks = createLocalJWKSet({ keys: [key] })
    verify = createTokenVerifier({ issuer, audience, jwks })
    sign = async (claims = {}) => new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setIssuer(claims.issuer ?? issuer)
      .setAudience(claims.audience ?? audience)
      .setSubject(claims.subject ?? 'user-a')
      .setIssuedAt()
      .setExpirationTime(claims.expiresIn ?? '5m')
      .sign(privateKey)
  })

  it('returns the subject of a signed token for the configured issuer and audience', async () => {
    await expect(verify(await sign())).resolves.toBe('user-a')
  })

  it('rejects expired, wrong-issuer, wrong-audience, malformed and subjectless tokens', async () => {
    for (const token of [await sign({ expiresIn: '-1m' }), await sign({ issuer: 'https://other.example.test' }), await sign({ audience: 'other' }), await sign({ subject: '' }), 'not-a-token']) {
      await expect(verify(token)).rejects.toThrow()
    }
  })

  it('rejects a token signed by another key even with the same key id', async () => {
    const { privateKey } = await generateKeyPair('ES256')
    const token = await new SignJWT({}).setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setIssuer(issuer).setAudience(audience).setSubject('user-a').setExpirationTime('5m').sign(privateKey)
    await expect(verify(token)).rejects.toThrow()
  })
})
