import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listBackups } from './list'
import { createBackupHandler } from './handler'

describe('private backup list', () => {
  let db: PGlite
  const deviceA = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  const deviceB = 'c7dd6eb2-825b-448e-a54e-797112e55c32'
  const first = '8166d21c-bac3-497b-9d22-8492474c982b'
  const second = 'c535e624-6166-4cc2-8858-17991596a999'
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/001_accounts.sql', 'utf8'))
    await db.exec(await readFile('server/migrations/003_backups.sql', 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id) VALUES ('a'), ('b')")
    await db.query('INSERT INTO arsen_devices (id,user_id) VALUES ($1,$2),($3,$4)', [deviceA, 'a', deviceB, 'b'])
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes,status,confirmed_at) VALUES ($1,'a',$2,1,1,$3,100,'confirmed','2026-01-01'),($4,'b',$5,1,2,$6,200,'confirmed','2026-02-01')", [first, deviceA, 'a'.repeat(64), second, deviceB, 'b'.repeat(64)])
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes) VALUES ($1,'a',$2,1,3,$3,300)", ['57d30b34-b8b4-4564-a4df-80ee6175d50a', deviceA, 'c'.repeat(64)])
  }, 30_000)
  afterAll(async () => { await db?.close() })
  const request = (token?: string) => new Request('https://api.example.test/backups', { headers: token ? { authorization: `Bearer ${token}` } : {} })
  const deps = (userId: string) => ({ auth: { verify: async () => userId, role: async () => 'user' as const }, query: (sql: string, params: string[]) => db.query<Record<string, unknown>>(sql, params) })
  it('does not expose another account or unconfirmed backups', async () => {
    expect(await listBackups(request(), deps('a'))).toEqual({ status: 401 })
    const own = await listBackups(request('token'), deps('a'))
    expect(own.status).toBe(200)
    if (own.status === 200) {
      expect(own.backups).toHaveLength(1)
      expect(own.backups[0]).toMatchObject({ id: first, sizeBytes: 100, localRevision: 1 })
      expect(own.backups[0]).not.toHaveProperty('manifest')
    }
    const other = await listBackups(request('token'), deps('b'))
    if (other.status === 200) expect(other.backups.map((backup) => backup.id)).toEqual([second])
    else throw new Error('No se autorizó la segunda cuenta')
  })
  it('only resolves the signed-in account when reading a backup by id', async () => {
    const noOperation = async () => ({ status: 404 })
    const handler = createBackupHandler({ list: (req) => listBackups(req, deps('a')), prepare: noOperation, manifestUpload: noOperation, reserve: noOperation, assetUpload: noOperation, confirm: noOperation, download: noOperation }, [])
    const get = (id: string, token = true) => handler(new Request(`https://api.example.test/api/v1/backups/${id}`, { headers: token ? { authorization: 'Bearer token' } : {} }))
    expect((await get(first, false)).status).toBe(401)
    expect((await get(second)).status).toBe(404)
    expect((await get('57d30b34-b8b4-4564-a4df-80ee6175d50a')).status).toBe(404)
    const response = await get(first)
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ backup: { id: first } })
  })
  it('returns at most five confirmed backups, newest first', async () => {
    for (let i = 1; i <= 6; i++) {
      await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes,status,confirmed_at) VALUES ($1,'a',$2,1,$3,$4,100,'confirmed',$5)", [`00000000-0000-4000-8000-00000000000${i}`, deviceA, i + 3, String(i).repeat(64), `2026-03-0${i}T00:00:00Z`])
    }
    const result = await listBackups(request('token'), deps('a'))
    if (result.status !== 200) throw new Error('No se autorizó la cuenta')
    expect(result.backups.map((backup) => backup.localRevision)).toEqual([9, 8, 7, 6, 5])
  })
})
