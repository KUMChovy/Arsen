import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listAdminAccounts } from './adminAccounts'

describe('administrative account summaries', () => {
  let pg: PGlite
  const device = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  beforeAll(async () => {
    pg = new PGlite()
    for (const name of ['001_accounts.sql', '003_backups.sql']) await pg.exec(await readFile(`server/migrations/${name}`, 'utf8'))
    await pg.exec("INSERT INTO arsen_profiles (user_id, role) VALUES ('user_admin', 'admin'), ('user_athlete', 'user')")
    await pg.query("INSERT INTO arsen_devices (id, user_id) VALUES ($1, 'user_athlete')", [device])
    await pg.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes,status,confirmed_at) VALUES ($1,'user_athlete',$2,1,1,$3,100,'confirmed','2026-01-01')", ['8166d21c-bac3-497b-9d22-8492474c982b', device, 'a'.repeat(64)])
    await pg.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes) VALUES ($1,'user_athlete',$2,1,2,$3,200)", ['c535e624-6166-4cc2-8858-17991596a999', device, 'b'.repeat(64)])
  }, 30_000)
  afterAll(async () => { await pg?.close() })
  const request = (method = 'GET', signed = true) => new Request('https://api.example.test', { method, headers: signed ? { authorization: 'Bearer test' } : {} })
  const deps = (role: 'user' | 'admin') => ({ auth: { verify: async () => 'user_admin', role: async () => role }, query: (sql: string, params: string[]) => pg.query<Record<string, unknown>>(sql, params) })

  it('requires an authenticated administrator and validates cursor', async () => {
    expect((await listAdminAccounts(request('POST'), null, deps('admin'))).status).toBe(405)
    expect((await listAdminAccounts(request('GET', false), null, deps('admin'))).status).toBe(401)
    expect((await listAdminAccounts(request(), null, deps('user'))).status).toBe(403)
    expect((await listAdminAccounts(request(), '../bad', deps('admin'))).status).toBe(400)
  })
  it('returns only bounded metadata and excludes unconfirmed backups', async () => {
    const result = await listAdminAccounts(request(), 'user_admin', deps('admin'))
    expect(result).toEqual({ status: 200, accounts: [{ userId: 'user_athlete', role: 'user', createdAt: expect.any(String), deviceCount: 1, backupCount: 1, lastBackupAt: '2026-01-01T00:00:00.000Z' }], nextCursor: null })
    expect(JSON.stringify(result)).not.toMatch(/manifest|sha256|email|health/i)
  })
  it('paginates without skipping the next account', async () => {
    await pg.exec("INSERT INTO arsen_profiles (user_id) SELECT 'user_x' || lpad(n::text, 3, '0') FROM generate_series(1, 55) n")
    const first = await listAdminAccounts(request(), 'user_admin', deps('admin'))
    if (first.status !== 200) throw new Error('No se pudo leer la página')
    expect(first.accounts).toHaveLength(50)
    expect(first.nextCursor).toBe(first.accounts[49]?.userId)
    const second = await listAdminAccounts(request(), first.nextCursor, deps('admin'))
    if (second.status !== 200) throw new Error('No se pudo leer la segunda página')
    expect(second.accounts).toHaveLength(6)
    expect(new Set([...first.accounts, ...second.accounts].map((account) => account.userId)).size).toBe(56)
    expect(second.nextCursor).toBeNull()
  })
})
