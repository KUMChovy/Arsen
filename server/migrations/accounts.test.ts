import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('account database constraints', () => {
  let db: PGlite
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/001_accounts.sql', 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id, role) VALUES ('user-a', 'user');")
  }, 30_000)
  afterAll(async () => { await db?.close() })

  it('accepts an external identity while rejecting empty identifiers and unrecognized roles', async () => {
    await expect(db.query("INSERT INTO arsen_profiles (user_id, role) VALUES ('', 'user')")).rejects.toThrow()
    await expect(db.query("INSERT INTO arsen_profiles (user_id, role) VALUES ('user-b', 'owner')")).rejects.toThrow()
    await db.query("INSERT INTO arsen_profiles (user_id, role) VALUES ('user-b', 'user')")
  })

  it('enforces unique invitation hashes and valid acceptance ownership', async () => {
    const hash = 'a'.repeat(64)
    await db.query("INSERT INTO arsen_invitations (id, email, token_sha256, expires_at) VALUES ($1, $2, $3, now() + interval '1 day')", ['0c39bd4d-f194-47d2-a849-021c05d4961e', 'a@example.test', hash])
    await expect(db.query("INSERT INTO arsen_invitations (id, email, token_sha256, expires_at) VALUES ($1, $2, $3, now() + interval '1 day')", ['6832cf8b-48c4-4314-b499-e2aa20f9099f', 'b@example.test', hash])).rejects.toThrow()
    await expect(db.query("UPDATE arsen_invitations SET accepted_by = 'missing', accepted_at = now() WHERE token_sha256 = $1", [hash])).rejects.toThrow()
    await expect(db.query('UPDATE arsen_invitations SET accepted_at = now() WHERE token_sha256 = $1', [hash])).rejects.toThrow()
    await expect(db.query("INSERT INTO arsen_invitations (id, email, token_sha256, expires_at) VALUES ($1, $2, $3, now())", ['261998b9-faf0-4994-a01f-45d4b26e9982', 'a@example.test', 'not-a-hash'])).rejects.toThrow()
  })

  it('keeps linked device identifiers unique and requires an existing profile', async () => {
    const id = 'eb701771-1b28-40a8-974a-b68976d817c0'
    await db.query('INSERT INTO arsen_devices (id, user_id) VALUES ($1, $2)', [id, 'user-a'])
    await expect(db.query('INSERT INTO arsen_devices (id, user_id) VALUES ($1, $2)', [id, 'user-a'])).rejects.toThrow()
    await expect(db.query('INSERT INTO arsen_devices (id, user_id) VALUES ($1, $2)', ['fd554f19-3bc3-4212-bf93-c3eac72938a1', 'missing'])).rejects.toThrow()
  })
})
