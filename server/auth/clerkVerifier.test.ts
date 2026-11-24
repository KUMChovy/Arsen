import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'
import { createClerkVerifier } from './clerkVerifier'

describe('Clerk session verification', () => {
  let sign: (claims?: Record<string, unknown>) => Promise<string>
  let jwks: ReturnType<typeof createLocalJWKSet>
  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true })
    const key = await exportJWK(publicKey)
    key.kid = 'test-key'
    jwks = createLocalJWKSet({ keys: [key] })
    sign = (claims = {}) => new SignJWT({ sid: 'sess_a', azp: 'https://app.example.test', ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' }).setIssuer('https://clerk.example.test')
      .setSubject('user_a').setNotBefore('0s').setExpirationTime('5m').sign(privateKey)
  })
  const verifier = (session = { id: 'sess_a', userId: 'user_a', status: 'active' }, allowMissingAzp = false) => createClerkVerifier({
    issuer: 'https://clerk.example.test', authorizedParties: ['https://app.example.test'], allowMissingAzp, jwks,
    getSession: async () => session,
  })
  it('accepts a signed token only while the matching Clerk session is active', async () => {
    await expect(verifier()(await sign())).resolves.toBe('user_a')
    for (const session of [{ id: 'sess_a', userId: 'user_a', status: 'revoked' }, { id: 'sess_a', userId: 'user_b', status: 'active' }, { id: 'sess_b', userId: 'user_a', status: 'active' }]) {
      await expect(verifier(session)(await sign())).rejects.toThrow()
    }
  })
  it('rejects missing session IDs, pending session tasks and unapproved origins', async () => {
    for (const claims of [{ sid: '' }, { sts: 'pending' }, { azp: 'https://evil.example.test' }, { azp: undefined }]) {
      await expect(verifier()(await sign(claims))).rejects.toThrow()
    }
    await expect(verifier(undefined, true)(await sign({ azp: undefined }))).resolves.toBe('user_a')
  })
  it('denies access when Clerk cannot check the session', async () => {
    const verify = createClerkVerifier({ issuer: 'https://clerk.example.test', authorizedParties: ['https://app.example.test'], jwks, getSession: async () => { throw new Error('offline') } })
    await expect(verify(await sign())).rejects.toThrow()
  })
  it('rejects tokens from another issuer, expired tokens and missing nbf', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true })
    const key = await exportJWK(publicKey)
    key.kid = 'other-test-key'
    const verify = createClerkVerifier({ issuer: 'https://clerk.example.test', authorizedParties: ['https://app.example.test'], jwks: createLocalJWKSet({ keys: [key] }), getSession: async () => ({ id: 'sess_a', userId: 'user_a', status: 'active' }) })
    const make = (issuer: string, expires: string, includeNbf: boolean) => {
      const token = new SignJWT({ sid: 'sess_a', azp: 'https://app.example.test' }).setProtectedHeader({ alg: 'RS256', kid: 'other-test-key' }).setIssuer(issuer).setSubject('user_a').setExpirationTime(expires)
      return (includeNbf ? token.setNotBefore('0s') : token).sign(privateKey)
    }
    for (const token of [await make('https://wrong.example.test', '5m', true), await make('https://clerk.example.test', '-1m', true), await make('https://clerk.example.test', '5m', false)]) {
      await expect(verify(token)).rejects.toThrow()
    }
  })
})
