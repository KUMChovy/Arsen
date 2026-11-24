import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createInvitation } from './createInvitation'

describe('invitation creation', () => {
  let db: PGlite
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/001_accounts.sql', 'utf8'))
  }, 30_000)
  afterAll(async () => { await db?.close() })

  it('stores only a hash, normalizes the address and creates unique invitation tokens', async () => {
    const query = (sql: string, params: string[]) => db.query(sql, params)
    const first = await createInvitation(query, ' USER@Example.Test ')
    const second = await createInvitation(query, 'user@example.test')
    expect(first.token).not.toBe(second.token)
    const rows = (await db.query<{ email: string; token_sha256: string; valid: boolean }>("SELECT email, token_sha256, expires_at > now() AS valid FROM arsen_invitations WHERE id = $1", [first.id])).rows
    expect(rows).toEqual([{ email: 'user@example.test', token_sha256: createHash('sha256').update(first.token).digest('hex'), valid: true }])
    expect(JSON.stringify(rows)).not.toContain(first.token)
  })

  it('rejects invalid email without creating an invitation', async () => {
    const query = (sql: string, params: string[]) => db.query(sql, params)
    const before = (await db.query('SELECT id FROM arsen_invitations')).rows.length
    await expect(createInvitation(query, 'not an email')).rejects.toThrow()
    expect((await db.query('SELECT id FROM arsen_invitations')).rows).toHaveLength(before)
  })
})
