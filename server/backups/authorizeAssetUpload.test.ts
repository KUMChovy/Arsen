import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { authorizeAssetUpload } from './authorizeAssetUpload'

describe('backup image upload authorization', () => {
  let db: PGlite
  const device = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  const backupId = '8166d21c-bac3-497b-9d22-8492474c982b'
  beforeAll(async () => {
    db = new PGlite()
    for (const path of ['001_accounts.sql', '003_backups.sql', '004_backup_components.sql']) await db.exec(await readFile(`server/migrations/${path}`, 'utf8'))
    await db.exec("INSERT INTO arsen_profiles (user_id) VALUES ('a'), ('b')")
    await db.query('INSERT INTO arsen_devices (id,user_id) VALUES ($1,$2)', [device, 'a'])
    await db.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes,manifest_size_bytes) VALUES ($1,'a',$2,1,5,$3,100,50)", [backupId, device, 'a'.repeat(64)])
    await db.query("INSERT INTO arsen_backup_components (backup_id,user_id,component_key,sha256,size_bytes) VALUES ($1,'a',$2,$3,50)", [backupId, createHash('sha256').update('image').digest('hex'), 'b'.repeat(64)])
  }, 30_000)
  afterAll(async () => { await db?.close() })
  const request = (token?: string) => new Request('https://api.example.test/uploads', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} })
  const sign = vi.fn(async () => 'https://storage.example.test/signed')
  const deps = (userId = 'a') => ({ auth: { verify: async () => userId, role: async () => 'user' as const }, transaction: <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => db.transaction((tx) => fn((sql, params) => tx.query(sql, params))), sign, maxBackupBytes: 1000 })
  it('rejects foreign and unreserved components without signing', async () => {
    expect(await authorizeAssetUpload(request(), { backupId, id: 'image' }, deps())).toEqual({ status: 401 })
    expect(await authorizeAssetUpload(request('token'), { backupId, id: 'image' }, deps('b'))).toEqual({ status: 404 })
    expect(await authorizeAssetUpload(request('token'), { backupId, id: 'other' }, deps())).toEqual({ status: 404 })
    expect(await authorizeAssetUpload(request('token'), { backupId, id: 'image', sizeBytes: 100 }, deps())).toEqual({ status: 400 })
    expect(sign).not.toHaveBeenCalled()
  })
  it('uses the reserved size and denies health upload when consent is withdrawn', async () => {
    await db.query('UPDATE arsen_backups SET includes_health = true WHERE id = $1', [backupId])
    expect(await authorizeAssetUpload(request('token'), { backupId, id: 'image' }, deps())).toEqual({ status: 403 })
    await db.query('UPDATE arsen_profiles SET health_sync_consent = true WHERE user_id = $1', ['a'])
    expect(await authorizeAssetUpload(request('token'), { backupId, id: 'image' }, deps())).toEqual({ status: 200, url: 'https://storage.example.test/signed' })
    expect(sign).toHaveBeenCalledWith({ userId: 'a', backupId, kind: 'asset', assetId: 'image', maxBytes: 50, serverLimitBytes: 1000 })
  })
  it('holds a transaction throughout signing', async () => {
    let inside = false
    const transaction = <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => db.transaction(async (tx) => {
      inside = true
      try { return await fn((sql, params) => tx.query(sql, params)) } finally { inside = false }
    })
    const guarded = { ...deps(), transaction, sign: async () => { expect(inside).toBe(true); return 'https://storage.example.test/signed' } }
    expect(await authorizeAssetUpload(request('token'), { backupId, id: 'image' }, guarded)).toEqual({ status: 200, url: 'https://storage.example.test/signed' })
  })
})
