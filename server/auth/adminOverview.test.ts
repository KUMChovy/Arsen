import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getAdminOverview } from './adminOverview'

describe('administrative overview', () => {
  let pg: PGlite
  const device = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  beforeAll(async () => {
    pg = new PGlite()
    for (const name of ['001_accounts.sql', '002_catalog.sql', '003_backups.sql']) await pg.exec(await readFile(`server/migrations/${name}`, 'utf8'))
    await pg.exec("INSERT INTO arsen_profiles (user_id,role) VALUES ('user_admin','admin'),('user_athlete','user')")
    await pg.query("INSERT INTO arsen_devices (id,user_id) VALUES ($1,'user_athlete')", [device])
    await pg.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes,status,confirmed_at) VALUES ($1,'user_athlete',$2,1,4,$3,100,'confirmed',now())", ['8166d21c-bac3-497b-9d22-8492474c982b', device, 'a'.repeat(64)])
    await pg.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes) VALUES ($1,'user_athlete',$2,1,5,$3,100)", ['c535e624-6166-4cc2-8858-17991596a999', device, 'b'.repeat(64)])
    await pg.exec("INSERT INTO arsen_catalog_items (id,draft,published,archived) VALUES ('active','{}','{}',false),('archived','{}','{}',true),('draft','{}',null,false)")
  }, 30_000)
  afterAll(async () => { await pg?.close() })
  const request = (method = 'GET', signed = true) => new Request('https://api.example.test', { method, headers: signed ? { authorization: 'Bearer test' } : {} })
  const deps = (role: 'admin' | 'user') => ({ auth: { verify: async () => 'user_admin', role: async () => role }, query: (sql: string, params: string[]) => pg.query<Record<string, unknown>>(sql, params) })

  it('requires an authenticated administrator', async () => {
    expect((await getAdminOverview(request('POST'), deps('admin'))).status).toBe(405)
    expect((await getAdminOverview(request('GET', false), deps('admin'))).status).toBe(401)
    expect((await getAdminOverview(request(), deps('user'))).status).toBe(403)
  })
  it('counts only confirmed backups and published, unarchived exercises', async () => {
    expect(await getAdminOverview(request(), deps('admin'))).toEqual({ status: 200, accounts: 2, devices: 1, confirmedBackups: 1, publishedExercises: 1 })
  })
})
