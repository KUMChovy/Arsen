import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { expireOnePendingBackup } from './expirePending'

describe('abandoned pending backups', () => {
  let db: PGlite
  const device = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  const old = '8166d21c-bac3-497b-9d22-8492474c982b'
  const recent = 'c535e624-6166-4cc2-8858-17991596a999'
  const confirmed = '57d30b34-b8b4-4564-a4df-80ee6175d50a'
  beforeEach(async () => {
    db = new PGlite()
    for (const file of ['001_accounts.sql', '003_backups.sql', '006_backup_retention.sql']) await db.exec(await readFile(`server/migrations/${file}`, 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id) VALUES ('a')")
    await db.query("INSERT INTO arsen_devices (id,user_id) VALUES ($1,'a')", [device])
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes,created_at) VALUES ($1,'a',$2,1,1,$3,1,now()-interval '8 days'),($4,'a',$2,1,2,$5,1,now())", [old, device, 'a'.repeat(64), recent, 'b'.repeat(64)])
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes,status,created_at,confirmed_at) VALUES ($1,'a',$2,1,3,$3,1,'confirmed',now()-interval '10 days',now()-interval '9 days')", [confirmed, device, 'c'.repeat(64)])
  }, 30_000)
  afterEach(async () => { await db?.close() })
  const transaction = <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => db.transaction((tx) => fn((sql, params) => tx.query(sql, params)))
  it('queues only an old pending version and retains confirmed and recent data', async () => {
    expect(await expireOnePendingBackup({ transaction })).toEqual({ status: 'expired' })
    expect((await db.query('SELECT id::text FROM arsen_backups ORDER BY id')).rows).toHaveLength(2)
    expect((await db.query('SELECT backup_id::text, user_id FROM arsen_backup_cleanup')).rows).toEqual([{ backup_id: old, user_id: 'a' }])
    expect(await expireOnePendingBackup({ transaction })).toEqual({ status: 'idle' })
  })
  it('keeps pending metadata when recording the cleanup job fails', async () => {
    await db.exec("CREATE FUNCTION reject_expiry_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'queue failed'; END $$; CREATE TRIGGER reject_expiry_cleanup BEFORE INSERT ON arsen_backup_cleanup FOR EACH ROW EXECUTE FUNCTION reject_expiry_cleanup();")
    await expect(expireOnePendingBackup({ transaction })).rejects.toThrow()
    expect((await db.query('SELECT id FROM arsen_backups WHERE id = $1', [old])).rows).toHaveLength(1)
  })
})
