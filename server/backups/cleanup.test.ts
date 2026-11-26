import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { backupObjectPath } from './blobReader'
import { cleanupOneBackup } from './cleanup'

describe('delayed backup cleanup', () => {
  let db: PGlite
  const backupId = '8166d21c-bac3-497b-9d22-8492474c982b'
  const device = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  const path = backupObjectPath('a', backupId, 'manifest')
  beforeEach(async () => {
    db = new PGlite()
    for (const file of ['001_accounts.sql', '003_backups.sql', '006_backup_retention.sql']) await db.exec(await readFile(`server/migrations/${file}`, 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id) VALUES ('a')")
    await db.query("INSERT INTO arsen_devices (id,user_id) VALUES ($1,'a')", [device])
    await db.query("INSERT INTO arsen_backup_cleanup (backup_id,user_id,not_before) VALUES ($1,'a',now() - interval '1 minute')", [backupId])
  }, 30_000)
  afterEach(async () => { await db?.close() })
  const transaction = <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => db.transaction((tx) => fn((sql, params) => tx.query(sql, params)))
  it('deletes only derived paths and keeps the queue until a subsequent empty listing', async () => {
    let paths = [path]
    const list = vi.fn(async () => paths)
    const remove = vi.fn(async () => { paths = [] })
    expect(await cleanupOneBackup({ transaction, list, remove })).toEqual({ status: 'pending', deleted: 1 })
    expect(remove).toHaveBeenCalledWith([path])
    expect((await db.query('SELECT backup_id FROM arsen_backup_cleanup')).rows).toHaveLength(1)
    expect(await cleanupOneBackup({ transaction, list, remove })).toEqual({ status: 'complete', deleted: 0 })
    expect((await db.query('SELECT backup_id FROM arsen_backup_cleanup')).rows).toEqual([])
  })
  it('never deletes foreign paths or objects of a recreated backup', async () => {
    const remove = vi.fn(async () => {})
    await expect(cleanupOneBackup({ transaction, list: async () => ['other/private'], remove })).rejects.toThrow()
    expect(remove).not.toHaveBeenCalled()
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes) VALUES ($1,'a',$2,1,1,$3,1)", [backupId, device, 'a'.repeat(64)])
    expect(await cleanupOneBackup({ transaction, list: async () => [path], remove })).toEqual({ status: 'blocked', deleted: 0 })
    expect(remove).not.toHaveBeenCalled()
  })
  it('retains the queue when storage deletion fails', async () => {
    await expect(cleanupOneBackup({ transaction, list: async () => [path], remove: async () => { throw new Error('storage offline') } })).rejects.toThrow()
    expect((await db.query('SELECT backup_id FROM arsen_backup_cleanup')).rows).toHaveLength(1)
  })
  it('retains a referenced backup but lets the next queued backup progress', async () => {
    const nextId = 'c535e624-6166-4cc2-8858-17991596a999'
    const nextPath = backupObjectPath('a', nextId, 'manifest')
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes) VALUES ($1,'a',$2,1,1,$3,1)", [backupId, device, 'a'.repeat(64)])
    await db.query("INSERT INTO arsen_backup_cleanup (backup_id,user_id,not_before) VALUES ($1,'a',now()-interval '30 seconds')", [nextId])
    const remove = vi.fn(async () => {})
    expect(await cleanupOneBackup({ transaction, list: async () => [nextPath], remove })).toEqual({ status: 'blocked', deleted: 0 })
    expect(await cleanupOneBackup({ transaction, list: async () => [nextPath], remove })).toEqual({ status: 'pending', deleted: 1 })
    expect(remove).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledWith([nextPath])
    expect((await db.query('SELECT backup_id FROM arsen_backup_cleanup WHERE backup_id = $1', [backupId])).rows).toHaveLength(1)
    expect((await db.query('SELECT id FROM arsen_backups WHERE id = $1', [backupId])).rows).toHaveLength(1)
  })
})
