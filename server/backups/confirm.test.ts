import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { confirmBackup } from './confirm'

describe('backup confirmation', () => {
  let db: PGlite
  const id = '8166d21c-bac3-497b-9d22-8492474c982b'
  const otherId = 'c535e624-6166-4cc2-8858-17991596a999'
  const device = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  beforeEach(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/001_accounts.sql', 'utf8'))
    await db.exec(await readFile('server/migrations/003_backups.sql', 'utf8'))
    await db.exec(await readFile('server/migrations/006_backup_retention.sql', 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id) VALUES ('a'), ('b');")
    await db.query('INSERT INTO arsen_devices (id, user_id) VALUES ($1, $2)', [device, 'a'])
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes,includes_health) VALUES ($1,'a',$2,1,5,$3,100,false)", [id, device, 'a'.repeat(64)])
  }, 30_000)
  afterEach(async () => { await db?.close() })
  const request = () => new Request('https://api.test/backups', { method: 'POST', headers: { authorization: 'Bearer token' } })
  function dependencies(userId = 'a', verify = async () => true) {
    return {
      auth: { verify: async () => userId, role: async () => 'user' as const },
      transaction: <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => db.transaction((tx) => fn((sql, params) => tx.query(sql, params))),
      verifyObjects: verify,
    }
  }
  it('does not expose or confirm another account’s backup', async () => {
    expect(await confirmBackup(request(), id, dependencies('b'))).toEqual({ status: 404 })
    expect((await db.query('SELECT status FROM arsen_backups WHERE id = $1', [id])).rows[0]).toEqual({ status: 'pending' })
  })
  it('rejects incomplete or damaged storage without confirming', async () => {
    expect(await confirmBackup(request(), id, dependencies('a', async () => false))).toEqual({ status: 409 })
    expect((await db.query('SELECT status FROM arsen_backups WHERE id = $1', [id])).rows[0]).toEqual({ status: 'pending' })
  })
  it('does not verify storage for a request without a valid session', async () => {
    let read = false
    const unauthenticated = new Request('https://api.test/backups', { method: 'POST' })
    expect(await confirmBackup(unauthenticated, id, dependencies('a', async () => { read = true; return true }))).toEqual({ status: 401 })
    expect(read).toBe(false)
  })
  it('leaves the backup pending if storage verification fails unexpectedly', async () => {
    await expect(confirmBackup(request(), id, dependencies('a', async () => { throw new Error('storage offline') }))).rejects.toThrow('storage offline')
    expect((await db.query('SELECT status FROM arsen_backups WHERE id = $1', [id])).rows[0]).toEqual({ status: 'pending' })
  })
  it('confirms verified objects once and makes retries idempotent', async () => {
    expect(await confirmBackup(request(), id, dependencies())).toEqual({ status: 200, id })
    expect(await confirmBackup(request(), id, dependencies('a', async () => false))).toEqual({ status: 200, id })
    expect((await db.query('SELECT status FROM arsen_backups WHERE id = $1', [id])).rows[0]).toEqual({ status: 'confirmed' })
  })
  it('rechecks health consent after object verification', async () => {
    await db.query('UPDATE arsen_profiles SET health_sync_consent = true WHERE user_id = $1', ['a'])
    await db.query('UPDATE arsen_backups SET includes_health = true WHERE id = $1', [id])
    const verify = async () => { await db.query('UPDATE arsen_profiles SET health_sync_consent = false WHERE user_id = $1', ['a']); return true }
    expect(await confirmBackup(request(), id, dependencies('a', verify))).toEqual({ status: 403 })
    expect((await db.query('SELECT status FROM arsen_backups WHERE id = $1', [id])).rows[0]).toEqual({ status: 'pending' })
  })
  it('does not read health objects when consent was already withdrawn', async () => {
    await db.query('UPDATE arsen_backups SET includes_health = true WHERE id = $1', [id])
    let read = false
    const verify = async () => { read = true; return true }
    expect(await confirmBackup(request(), id, dependencies('a', verify))).toEqual({ status: 403 })
    expect(read).toBe(false)
  })
  it('rejects a backup whose base changed while its objects were checked', async () => {
    const verify = async () => {
      await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes,status,confirmed_at) VALUES ($1,'a',$2,1,4,$3,100,'confirmed',now())", [otherId, device, 'b'.repeat(64)])
      return true
    }
    expect(await confirmBackup(request(), id, dependencies('a', verify))).toEqual({ status: 409 })
    expect((await db.query('SELECT status FROM arsen_backups WHERE id = $1', [id])).rows[0]).toEqual({ status: 'pending' })
  })
})
