import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { reconfirmBackup } from './reconfirm'

describe('reconfirming an existing backup', () => {
  let db: PGlite
  const old = '8166d21c-bac3-497b-9d22-8492474c982b'
  const latest = 'c535e624-6166-4cc2-8858-17991596a999'
  const device = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  beforeEach(async () => {
    db = new PGlite()
    for (const name of ['001_accounts.sql', '003_backups.sql', '006_backup_retention.sql']) await db.exec(await readFile(`server/migrations/${name}`, 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id) VALUES ('a'), ('b')")
    await db.query('INSERT INTO arsen_devices (id,user_id) VALUES ($1,$2)', [device, 'a'])
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes,status,confirmed_at) VALUES ($1,'a',$3,1,1,$4,100,'confirmed','2026-01-01'),($2,'a',$3,1,2,$5,100,'confirmed','2026-01-02')", [old, latest, device, 'a'.repeat(64), 'b'.repeat(64)])
  }, 30_000)
  afterEach(async () => { await db?.close() })
  const request = () => new Request('https://api.test/backups', { method: 'POST', headers: { authorization: 'Bearer token' } })
  function deps(user = 'a', verify = async () => true) {
    return { auth: { verify: async () => user, role: async () => 'user' as const }, transaction: <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => db.transaction((tx) => fn((sql, params) => tx.query(sql, params))), verifyObjects: verify }
  }
  it('reconfirms the matching historical version without creating a duplicate', async () => {
    expect(await reconfirmBackup(request(), { backupId: old, baseBackupId: latest, manifestSha256: 'a'.repeat(64) }, deps())).toEqual({ status: 200, id: old })
    expect(await reconfirmBackup(request(), { backupId: old, baseBackupId: latest, manifestSha256: 'a'.repeat(64) }, deps())).toEqual({ status: 200, id: old })
    const rows = await db.query<{ id: string }>("SELECT id::text FROM arsen_backups WHERE user_id = 'a' ORDER BY confirmed_at DESC")
    expect(rows.rows.map((row) => row.id)).toEqual([old, latest])
  })
  it('rejects another account, stale bases and damaged objects', async () => {
    expect((await reconfirmBackup(request(), { backupId: old, baseBackupId: latest, manifestSha256: 'a'.repeat(64) }, deps('b'))).status).toBe(404)
    expect((await reconfirmBackup(request(), { backupId: old, baseBackupId: old, manifestSha256: 'a'.repeat(64) }, deps())).status).toBe(409)
    expect((await reconfirmBackup(request(), { backupId: old, baseBackupId: latest, manifestSha256: 'a'.repeat(64) }, deps('a', async () => false))).status).toBe(409)
  })
  it('rejects a changed remote head after integrity verification', async () => {
    const third = '0d788ece-c86a-4af8-9c99-38efb1662f0a'
    const verify = async () => { await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes,status,confirmed_at) VALUES ($1,'a',$2,1,3,$3,100,'confirmed','2026-01-03')", [third, device, 'c'.repeat(64)]); return true }
    const result = await reconfirmBackup(request(), { backupId: old, baseBackupId: latest, manifestSha256: 'a'.repeat(64) }, deps('a', verify))
    expect(result.status).toBe(409)
  })
  it('rechecks health consent after verifying the archive', async () => {
    await db.query("UPDATE arsen_profiles SET health_sync_consent = true WHERE user_id = 'a'", [])
    await db.query('UPDATE arsen_backups SET includes_health = true WHERE id = $1', [old])
    const verify = async () => { await db.query("UPDATE arsen_profiles SET health_sync_consent = false WHERE user_id = 'a'", []); return true }
    expect((await reconfirmBackup(request(), { backupId: old, baseBackupId: latest, manifestSha256: 'a'.repeat(64) }, deps('a', verify))).status).toBe(403)
  })
  it('does not read protected objects without prior health consent or a valid session', async () => {
    await db.query('UPDATE arsen_backups SET includes_health = true WHERE id = $1', [old])
    let reads = 0
    const verify = async () => { reads++; return true }
    expect((await reconfirmBackup(request(), { backupId: old, baseBackupId: latest, manifestSha256: 'a'.repeat(64) }, deps('a', verify))).status).toBe(403)
    expect((await reconfirmBackup(new Request('https://api.test/backups', { method: 'POST' }), { backupId: old, baseBackupId: latest, manifestSha256: 'a'.repeat(64) }, deps('a', verify))).status).toBe(401)
    expect(reads).toBe(0)
  })
})
