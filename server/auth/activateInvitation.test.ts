import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { activateClerkInvitation, activateInvitation } from './activateInvitation'

describe('activation with a verified Clerk identity', () => {
  let db: PGlite
  const invitation = 'A'.repeat(43)
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/001_accounts.sql', 'utf8'))
    await db.query("INSERT INTO arsen_invitations (id, email, token_sha256, expires_at) VALUES ('cdeedb17-0c4c-4eb5-a9fc-a567a5b377f8', 'owner@example.test', $1, now() + interval '1 day')", [createHash('sha256').update(invitation).digest('hex')])
  }, 30_000)
  afterAll(async () => { await db?.close() })
  const dependencies = (identity: { userId: string; verifiedEmail: string | null }) => ({
    verify: async () => 'user_a', getUser: async () => identity,
    query: (sql: string, params: string[]) => db.query<{ user_id: string }>(sql, params),
  })
  it('refuses a mismatched identity or unverified email without consuming the invitation', async () => {
    await expect(activateInvitation('session', invitation, dependencies({ userId: 'user_b', verifiedEmail: 'owner@example.test' }))).resolves.toBe(false)
    await expect(activateInvitation('session', invitation, dependencies({ userId: 'user_a', verifiedEmail: null }))).resolves.toBe(false)
    expect((await db.query('SELECT user_id FROM arsen_profiles')).rows).toEqual([])
  })
  it('leaves the invitation untouched if authentication or Clerk is unavailable', async () => {
    const deps = dependencies({ userId: 'user_a', verifiedEmail: 'owner@example.test' })
    await expect(activateInvitation('bad', invitation, { ...deps, verify: async () => { throw new Error('invalid session') } })).rejects.toThrow()
    await expect(activateInvitation('session', invitation, { ...deps, getUser: async () => { throw new Error('Clerk unavailable') } })).rejects.toThrow()
    expect((await db.query('SELECT accepted_at FROM arsen_invitations')).rows).toEqual([{ accepted_at: null }])
  })
  it('activates exactly the authenticated verified account', async () => {
    const deps = dependencies({ userId: 'user_a', verifiedEmail: 'owner@example.test' })
    await expect(activateInvitation('session', invitation, deps)).resolves.toBe(true)
    await expect(activateInvitation('session', invitation, deps)).resolves.toBe(false)
    expect((await db.query('SELECT user_id, role FROM arsen_profiles')).rows).toEqual([{ user_id: 'user_a', role: 'user' }])
  })
  it('uses the invitation ID returned by Clerk without asking the client for a second token', async () => {
    const id = 'ea566122-e5c3-46cf-96ab-6b938a5d8dcb'
    await db.query('INSERT INTO arsen_invitations (id,email,token_sha256,expires_at) VALUES ($1,$2,$3,now() + interval \'1 day\')', [id, 'other@example.test', 'b'.repeat(64)])
    const query = (sql: string, params: string[]) => db.query<{ user_id: string }>(sql, params)
    const makeDeps = (verifiedEmail: string | null, invitationId: string | null) => ({ verify: async () => 'user_b', getUser: async () => ({ userId: 'user_b', verifiedEmail, invitationId }), query })
    await expect(activateClerkInvitation('session', makeDeps('wrong@example.test', id))).resolves.toBe(false)
    await expect(activateClerkInvitation('session', makeDeps(null, id))).resolves.toBe(false)
    await expect(activateClerkInvitation('session', makeDeps('other@example.test', null))).resolves.toBe(false)
    await expect(activateClerkInvitation('session', makeDeps('other@example.test', id))).resolves.toBe(true)
    await expect(activateClerkInvitation('session', makeDeps('other@example.test', id))).resolves.toBe(true)
    expect((await db.query("SELECT role FROM arsen_profiles WHERE user_id = 'user_b'")).rows).toEqual([{ role: 'user' }])
  })
  it('does not activate an expired invitation and serializes simultaneous attempts', async () => {
    const expired = 'fb4dc963-0762-4fd6-9704-8e6cabf5f4ee'
    const current = '96626e48-dc43-43ce-98fb-7a0bf337e662'
    await db.query("INSERT INTO arsen_invitations (id,email,token_sha256,expires_at) VALUES ($1,'third@example.test',$2,now() - interval '1 minute'), ($3,'third@example.test',$4,now() + interval '1 day')", [expired, 'c'.repeat(64), current, 'd'.repeat(64)])
    const query = (sql: string, params: string[]) => db.query<{ user_id: string }>(sql, params)
    const deps = (invitationId: string) => ({ verify: async () => 'user_c', getUser: async () => ({ userId: 'user_c', verifiedEmail: 'third@example.test', invitationId }), query })
    await expect(activateClerkInvitation('session', deps(expired))).resolves.toBe(false)
    const results = await Promise.all([activateClerkInvitation('session', deps(current)), activateClerkInvitation('session', deps(current))])
    expect(results).toEqual([true, true])
    expect((await db.query("SELECT user_id FROM arsen_profiles WHERE user_id = 'user_c'")).rows).toHaveLength(1)
  })
})
