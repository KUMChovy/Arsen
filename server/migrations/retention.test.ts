import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('backup retention schema', () => {
  let db: PGlite
  const device = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  const older = '8166d21c-bac3-497b-9d22-8492474c982b'
  const newer = 'c535e624-6166-4cc2-8858-17991596a999'
  beforeAll(async () => {
    db = new PGlite()
    for (const file of ['001_accounts.sql', '003_backups.sql', '004_backup_components.sql', '006_backup_retention.sql']) await db.exec(await readFile(`server/migrations/${file}`, 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id) VALUES ('a')")
    await db.query("INSERT INTO arsen_devices (id,user_id) VALUES ($1,'a')", [device])
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes,status,confirmed_at) VALUES ($1,'a',$2,1,1,$3,1,'confirmed',now())", [older, device, 'a'.repeat(64)])
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,base_backup_id,contract_version,local_revision,manifest_sha256,size_bytes) VALUES ($1,'a',$2,$3,1,2,$4,1)", [newer, device, older, 'b'.repeat(64)])
  }, 30_000)
  afterAll(async () => { await db?.close() })
  it('preserves the owner of a dependent backup when the old base is removed', async () => {
    await db.query('DELETE FROM arsen_backups WHERE id = $1', [older])
    expect((await db.query('SELECT user_id, base_backup_id FROM arsen_backups WHERE id = $1', [newer])).rows).toEqual([{ user_id: 'a', base_backup_id: null }])
  })
})
