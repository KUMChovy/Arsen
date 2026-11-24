import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { authorizeManifestUpload } from './authorizeManifestUpload'

describe('manifest upload authorization', () => {
  let db: PGlite
  const device = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  const backupId = '8166d21c-bac3-497b-9d22-8492474c982b'
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/001_accounts.sql', 'utf8'))
    await db.exec(await readFile('server/migrations/003_backups.sql', 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id) VALUES ('a'), ('b')")
    await db.query('INSERT INTO arsen_devices (id,user_id) VALUES ($1,$2)', [device, 'a'])
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes) VALUES ($1,'a',$2,1,5,$3,100)", [backupId, device, 'a'.repeat(64)])
  }, 30_000)
  afterAll(async () => { await db?.close() })
  const request = (token?: string) => new Request('https://api.example.test/uploads', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} })
  const sign = vi.fn(async () => 'https://storage.example.test/signed')
  const deps = (userId = 'a') => ({ auth: { verify: async () => userId, role: async () => 'user' as const }, transaction: <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => db.transaction((tx) => fn((sql, params) => tx.query(sql, params))), sign })
  it('denies unauthenticated, invalid and foreign uploads before signing', async () => {
    expect(await authorizeManifestUpload(request(), { backupId, sizeBytes: 50 }, deps())).toEqual({ status: 401 })
    expect(await authorizeManifestUpload(request('token'), { backupId, sizeBytes: 101 }, deps())).toEqual({ status: 400 })
    expect(await authorizeManifestUpload(request('token'), { backupId, sizeBytes: 50 }, deps('b'))).toEqual({ status: 404 })
    expect(sign).not.toHaveBeenCalled()
  })
  it('does not sign a health-containing backup without current consent', async () => {
    await db.query('UPDATE arsen_backups SET includes_health = true WHERE id = $1', [backupId])
    expect(await authorizeManifestUpload(request('token'), { backupId, sizeBytes: 50 }, deps())).toEqual({ status: 403 })
    expect(sign).not.toHaveBeenCalled()
    await db.query('UPDATE arsen_backups SET includes_health = false WHERE id = $1', [backupId])
  })
  it('keeps authorization inside the transaction until signing completes', async () => {
    let inside = false
    const transaction = <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => db.transaction(async (tx) => {
      inside = true
      try { return await fn((sql, params) => tx.query(sql, params)) } finally { inside = false }
    })
    const guarded = { ...deps(), transaction, sign: async () => { expect(inside).toBe(true); return 'https://storage.example.test/signed' } }
    expect(await authorizeManifestUpload(request('token'), { backupId, sizeBytes: 50 }, guarded)).toEqual({ status: 200, url: 'https://storage.example.test/signed' })
  })
  it('signs only a pending backup belonging to the verified user', async () => {
    expect(await authorizeManifestUpload(request('token'), { backupId, sizeBytes: 50 }, deps())).toEqual({ status: 200, url: 'https://storage.example.test/signed' })
    expect(sign).toHaveBeenCalledWith({ userId: 'a', backupId, kind: 'manifest', maxBytes: 50, serverLimitBytes: 4 * 1024 * 1024 })
    await db.query("UPDATE arsen_backups SET status = 'confirmed', confirmed_at = now() WHERE id = $1", [backupId])
    expect(await authorizeManifestUpload(request('token'), { backupId, sizeBytes: 50 }, deps())).toEqual({ status: 409 })
  })
})
