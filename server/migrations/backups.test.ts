import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('backup database constraints', () => {
  let db: PGlite
  const deviceA = '1d966ad4-e6c3-494f-8e64-77431fe7bd53'
  const deviceB = 'dbf79658-076d-49aa-a63e-8a447a79300b'
  const backup = 'c5ab1457-8664-4a5d-945a-918c24423ed7'
  const insert = 'INSERT INTO arsen_backups (id, user_id, device_id, contract_version, local_revision, manifest_sha256, size_bytes) VALUES ($1, $2, $3, 1, 1, $4, 100)'
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/001_accounts.sql', 'utf8'))
    await db.exec(await readFile('server/migrations/003_backups.sql', 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id) VALUES ('a'), ('b');")
    await db.query('INSERT INTO arsen_devices (id, user_id) VALUES ($1, $2), ($3, $4)', [deviceA, 'a', deviceB, 'b'])
  }, 30_000)
  afterAll(async () => { await db?.close() })

  it('rejects a backup attributed to another account’s device', async () => {
    await expect(db.query(insert, [backup, 'a', deviceB, 'a'.repeat(64)])).rejects.toThrow()
    expect((await db.query('SELECT id FROM arsen_backups')).rows).toEqual([])
  })

  it('prevents duplicate content and requires a confirmation timestamp', async () => {
    await db.query(insert, [backup, 'a', deviceA, 'a'.repeat(64)])
    await expect(db.query(insert, ['e57a959c-b400-4814-8fd4-0986412000dd', 'a', deviceA, 'a'.repeat(64)])).rejects.toThrow()
    await expect(db.query("UPDATE arsen_backups SET status = 'confirmed' WHERE id = $1", [backup])).rejects.toThrow()
  })

  it('rejects invalid hashes, revisions and sizes', async () => {
    await expect(db.query(insert, ['c5ab1457-8664-4a5d-945a-918c24423ed8', 'b', deviceB, 'invalid'])).rejects.toThrow()
    await expect(db.query('UPDATE arsen_backups SET local_revision = -1 WHERE id = $1', [backup])).rejects.toThrow()
    await expect(db.query('UPDATE arsen_backups SET size_bytes = 0 WHERE id = $1', [backup])).rejects.toThrow()
  })

  it('does not permit a backup to reference another account’s base version', async () => {
    const other = '9ee290a0-50d2-4e2a-84c2-7b9463669120'
    await db.query(insert, [other, 'b', deviceB, 'b'.repeat(64)])
    await expect(db.query('UPDATE arsen_backups SET base_backup_id = $1 WHERE id = $2', [other, backup])).rejects.toThrow()
  })
})
