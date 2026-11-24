import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { redeemInvitation } from './redeemInvitation'

describe('invitation activation', () => {
  let db: PGlite
  const token = 'A'.repeat(43)
  const hash = createHash('sha256').update(token).digest('hex')
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/001_accounts.sql', 'utf8'))
    await db.query("INSERT INTO arsen_invitations (id, email, token_sha256, expires_at) VALUES ('cdeedb17-0c4c-4eb5-a9fc-a567a5b377f8', 'user@example.test', $1, now() + interval '1 day')", [hash])
  }, 30_000)
  afterAll(async () => { await db?.close() })

  it('does not activate a wrong email, an unverified email, or an invalid token', async () => {
    const query = (sql: string, params: string[]) => db.query<{ user_id: string }>(sql, params)
    await expect(redeemInvitation(query, { userId: 'b', verifiedEmail: 'other@example.test' }, token)).resolves.toBe(false)
    await expect(redeemInvitation(query, { userId: 'c', verifiedEmail: null }, token)).resolves.toBe(false)
    await expect(redeemInvitation(query, { userId: 'a', verifiedEmail: 'user@example.test' }, 'bad')).resolves.toBe(false)
    expect((await db.query('SELECT user_id FROM arsen_profiles')).rows).toEqual([])
  })

  it('activates only the matching user and consumes the invitation once', async () => {
    const query = (sql: string, params: string[]) => db.query<{ user_id: string }>(sql, params)
    await expect(redeemInvitation(query, { userId: 'a', verifiedEmail: 'USER@example.test' }, token)).resolves.toBe(true)
    await expect(redeemInvitation(query, { userId: 'a', verifiedEmail: 'user@example.test' }, token)).resolves.toBe(false)
    expect((await db.query('SELECT user_id, role FROM arsen_profiles')).rows).toEqual([{ user_id: 'a', role: 'user' }])
    expect((await db.query('SELECT accepted_by FROM arsen_invitations')).rows).toEqual([{ accepted_by: 'a' }])
  })

  it('does not create a profile from an expired invitation', async () => {
    const expired = 'B'.repeat(43)
    const expiredHash = createHash('sha256').update(expired).digest('hex')
    await db.query("INSERT INTO arsen_invitations (id, email, token_sha256, expires_at) VALUES ('cc9ce665-f2bb-4ed8-98f8-461117af835e', 'user@example.test', $1, now() - interval '1 minute')", [expiredHash])
    const query = (sql: string, params: string[]) => db.query<{ user_id: string }>(sql, params)
    await expect(redeemInvitation(query, { userId: 'c', verifiedEmail: 'user@example.test' }, expired)).resolves.toBe(false)
    expect((await db.query("SELECT user_id FROM arsen_profiles WHERE user_id = 'c'")).rows).toEqual([])
  })

  it('cannot activate the same invitation twice under simultaneous attempts', async () => {
    const concurrent = 'C'.repeat(43)
    const concurrentHash = createHash('sha256').update(concurrent).digest('hex')
    await db.query("INSERT INTO arsen_invitations (id, email, token_sha256, expires_at) VALUES ('ea566122-e5c3-46cf-96ab-6b938a5d8dcb', 'user@example.test', $1, now() + interval '1 day')", [concurrentHash])
    const query = (sql: string, params: string[]) => db.query<{ user_id: string }>(sql, params)
    const identity = { userId: 'c', verifiedEmail: 'user@example.test' }
    const results = await Promise.all([redeemInvitation(query, identity, concurrent), redeemInvitation(query, identity, concurrent)])
    expect(results.filter(Boolean)).toHaveLength(1)
  })
})
