import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listAdminBackups } from './adminBackups'

describe('administrative backup metadata', () => {
  let pg: PGlite
  const device = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  const backupId = '8166d21c-bac3-497b-9d22-8492474c982b'
  beforeAll(async () => {
    pg = new PGlite()
    for (const name of ['001_accounts.sql', '003_backups.sql']) await pg.exec(await readFile(`server/migrations/${name}`, 'utf8'))
    await pg.exec("INSERT INTO arsen_profiles (user_id,role) VALUES ('user_admin','admin'),('user_athlete','user'),('user_other','user')")
    await pg.query("INSERT INTO arsen_devices (id,user_id) VALUES ($1,'user_athlete')", [device])
    await pg.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes,status,confirmed_at) VALUES ($1,'user_athlete',$2,1,4,$3,100,'confirmed','2026-01-01')", [backupId, device, 'a'.repeat(64)])
    await pg.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes) VALUES ($1,'user_athlete',$2,1,5,$3,200)", ['c535e624-6166-4cc2-8858-17991596a999', device, 'b'.repeat(64)])
  }, 30_000)
  afterAll(async () => { await pg?.close() })
  const request = (method = 'GET', signed = true) => new Request('https://api.example.test', { method, headers: signed ? { authorization: 'Bearer test' } : {} })
  const deps = (role: 'admin' | 'user') => ({ auth: { verify: async () => 'user_admin', role: async () => role }, query: (sql: string, params: string[]) => pg.query<Record<string, unknown>>(sql, params) })

  it('requires an administrator and a valid user id', async () => {
    expect((await listAdminBackups(request('POST'), 'user_athlete', deps('admin'))).status).toBe(405)
    expect((await listAdminBackups(request('GET', false), 'user_athlete', deps('admin'))).status).toBe(401)
    expect((await listAdminBackups(request(), 'user_athlete', deps('user'))).status).toBe(403)
    expect((await listAdminBackups(request(), '../invalid', deps('admin'))).status).toBe(400)
  })
  it('returns only confirmed metadata belonging to the selected account', async () => {
    const result = await listAdminBackups(request(), 'user_athlete', deps('admin'))
    expect(result).toEqual({ status: 200, backups: [{ id: backupId, deviceId: device, localRevision: 4, contractVersion: 1, sizeBytes: 100, includesHealth: false, confirmedAt: '2026-01-01T00:00:00.000Z' }] })
    expect(JSON.stringify(result)).not.toMatch(/manifest|sha256|token|url/i)
    expect(await listAdminBackups(request(), 'user_other', deps('admin'))).toEqual({ status: 200, backups: [] })
    expect(await listAdminBackups(request(), 'user_missing', deps('admin'))).toEqual({ status: 200, backups: [] })
  })
})
