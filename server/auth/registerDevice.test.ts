import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { registerDevice } from './registerDevice'

describe('account device ownership', () => {
  let db: PGlite
  const id = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/001_accounts.sql', 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id) VALUES ('a'), ('b')")
  }, 30_000)
  afterAll(async () => { await db?.close() })
  const request = (token?: string) => new Request('https://api.example.test/devices', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} })
  const deps = (userId = 'a') => ({
    auth: { verify: async () => userId, role: async () => 'user' as const },
    query: (sql: string, params: string[]) => db.query<Record<string, unknown>>(sql, params),
  })
  it('rejects missing sessions and invalid or client-supplied owners', async () => {
    expect(await registerDevice(request(), { id }, deps())).toEqual({ status: 401 })
    expect(await registerDevice(request('token'), { id: 'not-a-uuid' }, deps())).toEqual({ status: 400 })
    expect(await registerDevice(request('token'), { id, userId: 'b' }, deps())).toEqual({ status: 400 })
  })
  it('registers once and never reassigns a device to another account', async () => {
    expect(await registerDevice(request('token'), { id }, deps())).toEqual({ status: 200, id })
    expect(await registerDevice(request('token'), { id }, deps())).toEqual({ status: 200, id })
    expect(await registerDevice(request('token'), { id }, deps('b'))).toEqual({ status: 409 })
    expect((await db.query('SELECT user_id FROM arsen_devices WHERE id = $1', [id])).rows).toEqual([{ user_id: 'a' }])
  })
  it('allows only one owner when two accounts register the same device concurrently', async () => {
    const shared = 'c7dd6eb2-825b-448e-a54e-797112e55c32'
    const results = await Promise.all([registerDevice(request('token'), { id: shared }, deps('a')), registerDevice(request('token'), { id: shared }, deps('b'))])
    expect(results.map((result) => result.status).sort()).toEqual([200, 409])
    expect((await db.query('SELECT user_id FROM arsen_devices WHERE id = $1', [shared])).rows).toHaveLength(1)
  })
})
