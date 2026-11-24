import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { confirmBackup } from './confirm'

describe('transactional backup retention', () => {
  let db: PGlite
  const device = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  const otherDevice = 'c7dd6eb2-825b-448e-a54e-797112e55c32'
  const next = '8166d21c-bac3-497b-9d22-8492474c982b'
  const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`
  beforeEach(async () => {
    db = new PGlite()
    for (const file of ['001_accounts.sql', '003_backups.sql', '004_backup_components.sql', '006_backup_retention.sql']) await db.exec(await readFile(`server/migrations/${file}`, 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id) VALUES ('a'), ('b')")
    await db.query('INSERT INTO arsen_devices (id,user_id) VALUES ($1,$2),($3,$4)', [device, 'a', otherDevice, 'b'])
    for (let i = 1; i <= 5; i++) await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes,status,confirmed_at) VALUES ($1,'a',$2,1,$3,$4,1,'confirmed',$5)", [id(i), device, i, String(i).repeat(64), `2026-01-0${i}T00:00:00Z`])
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,base_backup_id,contract_version,local_revision,manifest_sha256,size_bytes) VALUES ($1,'a',$2,$3,1,6,$4,1),($5,'a',$2,$6,1,2,$7,1)", [next, device, id(5), 'a'.repeat(64), id(7), id(1), 'b'.repeat(64)])
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes,status,confirmed_at) VALUES ($1,'b',$2,1,1,$3,1,'confirmed',now())", [id(8), otherDevice, 'c'.repeat(64)])
  }, 30_000)
  afterEach(async () => { await db?.close() })
  const request = () => new Request('https://api.test/backups', { method: 'POST', headers: { authorization: 'Bearer token' } })
  const deps = () => ({ auth: { verify: async () => 'a', role: async () => 'user' as const }, transaction: <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => db.transaction((tx) => fn((sql, params) => tx.query(sql, params))), verifyObjects: async () => true })
  it('confirms the new version, keeps five, and queues only the oldest account-owned objects', async () => {
    expect(await confirmBackup(request(), next, deps())).toEqual({ status: 200, id: next })
    expect((await db.query("SELECT id::text FROM arsen_backups WHERE user_id = 'a' AND status = 'confirmed' ORDER BY confirmed_at DESC")).rows).toHaveLength(5)
    expect((await db.query('SELECT backup_id::text, user_id FROM arsen_backup_cleanup')).rows).toEqual([{ backup_id: id(1), user_id: 'a' }])
    expect((await db.query('SELECT user_id, base_backup_id FROM arsen_backups WHERE id = $1', [id(7)])).rows).toEqual([{ user_id: 'a', base_backup_id: null }])
    expect((await db.query("SELECT id::text FROM arsen_backups WHERE user_id = 'b'")).rows).toHaveLength(1)
  })
  it('rolls back confirmation and retains the old backup if queue insertion fails', async () => {
    await db.exec("CREATE FUNCTION reject_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'queue failed'; END $$; CREATE TRIGGER reject_cleanup BEFORE INSERT ON arsen_backup_cleanup FOR EACH ROW EXECUTE FUNCTION reject_cleanup();")
    await expect(confirmBackup(request(), next, deps())).rejects.toThrow()
    expect((await db.query('SELECT status FROM arsen_backups WHERE id = $1', [next])).rows).toEqual([{ status: 'pending' }])
    expect((await db.query('SELECT id FROM arsen_backups WHERE id = $1', [id(1)])).rows).toHaveLength(1)
  })
  it('uses the confirmation time after waiting inside the transaction', async () => {
    let calls = 0
    let started = 0
    const transaction = <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => db.transaction(async (tx) => {
      calls++
      if (calls === 2) {
        const result = await tx.query<{ started: string }>('SELECT transaction_timestamp()::text AS started')
        started = Date.parse(result.rows[0]!.started)
        await tx.query('SELECT pg_sleep(0.1)')
      }
      return fn((sql, params) => tx.query(sql, params))
    })
    expect(await confirmBackup(request(), next, { ...deps(), transaction })).toEqual({ status: 200, id: next })
    const result = await db.query<{ confirmed_at: string }>('SELECT confirmed_at::text FROM arsen_backups WHERE id = $1', [next])
    expect(Date.parse(result.rows[0]!.confirmed_at) - started).toBeGreaterThanOrEqual(50)
  })
})
