import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { activateAccount } from './activationHandler'

describe('account activation transport', () => {
  let db: PGlite
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/001_accounts.sql', 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id, role) VALUES ('user_admin', 'admin')")
  }, 30_000)
  afterAll(async () => { await db?.close() })
  const request = (token?: string) => new Request('https://api.test', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} })
  const dependencies = (userId: string, verifiedEmail: string | null, identityId = userId) => ({
    verify: async () => userId,
    getUser: async () => ({ userId: identityId, verifiedEmail, invitationId: null }),
    query: (sql: string, params: string[]) => db.query<{ user_id: string }>(sql, params),
  })
  it('requires a verified session and does not query the user for an invalid token', async () => {
    const getUser = vi.fn(async () => ({ userId: 'user_a', verifiedEmail: null, invitationId: null }))
    const deps = { verify: async () => { throw new Error('invalid') }, getUser, query: async () => ({ rows: [] }) }
    expect(await activateAccount(request(), deps)).toEqual({ status: 401 })
    expect(await activateAccount(request('invalid'), deps)).toEqual({ status: 401 })
    expect(getUser).not.toHaveBeenCalled()
  })
  it('activates a verified direct registration once with the user role', async () => {
    const deps = dependencies('user_new', 'new@example.test')
    expect(await activateAccount(request('valid'), deps)).toEqual({ status: 200 })
    expect(await activateAccount(request('valid'), deps)).toEqual({ status: 200 })
    expect((await db.query("SELECT role FROM arsen_profiles WHERE user_id = 'user_new'")).rows).toEqual([{ role: 'user' }])
  })
  it('rejects unverified or mismatched identities without creating profiles', async () => {
    expect(await activateAccount(request('valid'), dependencies('user_unverified', null))).toEqual({ status: 403 })
    expect(await activateAccount(request('valid'), dependencies('user_wrong', 'x@example.test', 'user_other'))).toEqual({ status: 403 })
    expect((await db.query("SELECT user_id FROM arsen_profiles WHERE user_id IN ('user_unverified', 'user_wrong')")).rows).toEqual([])
  })
  it('preserves the role of an existing administrator', async () => {
    expect(await activateAccount(request('valid'), dependencies('user_admin', 'admin@example.test'))).toEqual({ status: 200 })
    expect((await db.query("SELECT role FROM arsen_profiles WHERE user_id = 'user_admin'")).rows).toEqual([{ role: 'admin' }])
  })
})
