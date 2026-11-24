import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { authorize } from './authorize'
import { lookupRole } from './roles'
import { createTokenVerifier } from './verifyToken'

describe('role lookup', () => {
  let db: PGlite
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/001_accounts.sql', 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id, role) VALUES ('admin-a', 'admin'), ('user-b', 'user');")
  }, 30_000)
  afterAll(async () => { await db?.close() })

  it('returns only the role associated with the verified subject', async () => {
    const query = (sql: string, params: string[]) => db.query<{ role: string }>(sql, params)
    await expect(lookupRole(query, 'admin-a')).resolves.toBe('admin')
    await expect(lookupRole(query, 'user-b')).resolves.toBe('user')
    await expect(lookupRole(query, "user-b' OR true --")).resolves.toBeNull()
    await expect(lookupRole(query, 'unknown')).resolves.toBeNull()
  })

  it('enforces the stored role after cryptographic verification', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true })
    const key = { ...await exportJWK(publicKey), kid: 'key' }
    const verify = createTokenVerifier({ issuer: 'https://auth.test', audience: 'api', jwks: createLocalJWKSet({ keys: [key] }) })
    const token = await new SignJWT({ role: 'admin' }).setProtectedHeader({ alg: 'ES256', kid: 'key' })
      .setIssuer('https://auth.test').setAudience('api').setSubject('user-b').setExpirationTime('5m').sign(privateKey)
    const request = new Request('https://api.test', { headers: { authorization: `Bearer ${token}` } })
    const role = (userId: string) => lookupRole((sql, params) => db.query<{ role: string }>(sql, params), userId)
    await expect(authorize(request, { verify, role }, 'admin')).resolves.toEqual({ status: 403 })
    await expect(authorize(request, { verify, role })).resolves.toEqual({ status: 200, userId: 'user-b' })
  })
})
