import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('backup component constraints', () => {
  let db: PGlite
  const device = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  const backup = '8166d21c-bac3-497b-9d22-8492474c982b'
  beforeAll(async () => {
    db = new PGlite()
    for (const path of ['001_accounts.sql', '003_backups.sql', '004_backup_components.sql']) await db.exec(await readFile(`server/migrations/${path}`, 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id) VALUES ('a'), ('b')")
    await db.query('INSERT INTO arsen_devices (id,user_id) VALUES ($1,$2)', [device, 'a'])
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes) VALUES ($1,'a',$2,1,1,$3,100)", [backup, device, 'a'.repeat(64)])
  }, 30_000)
  afterAll(async () => { await db?.close() })
  it('requires a valid owner, hash, positive size and unique component', async () => {
    const insert = 'INSERT INTO arsen_backup_components (backup_id,user_id,component_key,sha256,size_bytes) VALUES ($1,$2,$3,$4,$5)'
    await expect(db.query(insert, [backup, 'b', 'a'.repeat(64), 'b'.repeat(64), 5])).rejects.toThrow()
    await expect(db.query(insert, [backup, 'a', 'invalid', 'b'.repeat(64), 5])).rejects.toThrow()
    await expect(db.query(insert, [backup, 'a', 'a'.repeat(64), 'b'.repeat(64), 0])).rejects.toThrow()
    await db.query(insert, [backup, 'a', 'a'.repeat(64), 'b'.repeat(64), 5])
    await expect(db.query(insert, [backup, 'a', 'a'.repeat(64), 'b'.repeat(64), 5])).rejects.toThrow()
  })
})
