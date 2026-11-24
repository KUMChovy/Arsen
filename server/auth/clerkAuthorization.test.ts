import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { authorize } from './authorize'
import { createClerkSessionReader } from './clerkSession'
import { createClerkVerifier } from './clerkVerifier'
import { lookupRole } from './roles'

describe('Clerk authorization with database roles', () => {
  let db: PGlite
  let token: string
  let jwks: ReturnType<typeof createLocalJWKSet>
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/001_accounts.sql', 'utf8'))
    await db.query("INSERT INTO arsen_profiles (user_id, role) VALUES ('user_a', 'user')")
    const { privateKey, publicKey } = await generateKeyPair('RS256', { extractable: true })
    const key = await exportJWK(publicKey)
    key.kid = 'test'
    jwks = createLocalJWKSet({ keys: [key] })
    token = await new SignJWT({ sid: 'sess_a', azp: 'https://app.example.test' }).setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuer('https://clerk.example.test').setSubject('user_a').setNotBefore('0s').setExpirationTime('5m').sign(privateKey)
  }, 30_000)
  afterAll(async () => { await db?.close() })
  it('allows an active account, forbids admin operations and rejects revoked sessions', async () => {
    let status = 'active'
    const getSession = createClerkSessionReader('sk_test_example', async () => new Response(JSON.stringify({ id: 'sess_a', user_id: 'user_a', status })))
    const auth = {
      verify: createClerkVerifier({ issuer: 'https://clerk.example.test', authorizedParties: ['https://app.example.test'], jwks, getSession }),
      role: (userId: string) => lookupRole((sql, params) => db.query<{ role: string }>(sql, params), userId),
    }
    const request = new Request('https://api.example.test', { headers: { authorization: `Bearer ${token}` } })
    await expect(authorize(request, auth)).resolves.toEqual({ status: 200, userId: 'user_a' })
    await expect(authorize(request, auth, 'admin')).resolves.toEqual({ status: 403 })
    status = 'revoked'
    await expect(authorize(request, auth)).resolves.toEqual({ status: 401 })
  })
})
