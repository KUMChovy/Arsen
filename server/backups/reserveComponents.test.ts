import 'fake-indexeddb/auto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRemoteContractBackup } from '../../src/db/contractBackup'
import { db as localDb } from '../../src/db/schema'
import { ensureDemoData } from '../../src/db/seedDemoRoutine'
import { reserveBackupComponents } from './reserveComponents'

describe('backup component reservation', () => {
  let pg: PGlite
  let manifest: Uint8Array
  const device = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  const backupId = '8166d21c-bac3-497b-9d22-8492474c982b'
  beforeAll(async () => {
    localDb.close(); await localDb.delete(); await localDb.open(); await ensureDemoData()
    const now = '2026-08-01T00:00:00.000Z'
    await localDb.exerciseAssets.bulkAdd([
      { id: 'image-a', name: 'a', mimeType: 'image/png', dataUrl: 'data:image/png;base64,AQI=', createdAt: now, updatedAt: now },
      { id: 'image-b', name: 'b', mimeType: 'image/png', dataUrl: 'data:image/png;base64,AwQ=', createdAt: now, updatedAt: now },
    ])
    const backup = await createRemoteContractBackup()
    manifest = new TextEncoder().encode(backup.manifest)
    pg = new PGlite()
    for (const path of ['001_accounts.sql', '003_backups.sql', '004_backup_components.sql']) await pg.exec(await readFile(`server/migrations/${path}`, 'utf8'))
    await pg.exec("INSERT INTO arsen_profiles (user_id) VALUES ('a'), ('b')")
    await pg.query('INSERT INTO arsen_devices (id,user_id) VALUES ($1,$2)', [device, 'a'])
    await pg.query("INSERT INTO arsen_backups (id,user_id,device_id,contract_version,local_revision,manifest_sha256,size_bytes) VALUES ($1,'a',$2,1,5,$3,$4)", [backupId, device, backup.manifestSha256, manifest.byteLength + 4])
  }, 30_000)
  afterAll(async () => { localDb.close(); await pg?.close() })
  const request = (token?: string) => new Request('https://api.example.test/reserve', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {} })
  const deps = (userId = 'a', bytes = () => manifest) => ({
    auth: { verify: async () => userId, role: async () => 'user' as const },
    transaction: <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => pg.transaction((tx) => fn((sql, params) => tx.query(sql, params))),
    readManifest: async () => bytes(), maxBackupBytes: 1_000_000,
  })
  const components = [{ id: 'image-a', sizeBytes: 2 }, { id: 'image-b', sizeBytes: 2 }]
  it('rejects foreign, incomplete, duplicate and altered manifests without reserving components', async () => {
    expect(await reserveBackupComponents(request(), { backupId, components }, deps())).toEqual({ status: 401 })
    expect(await reserveBackupComponents(request('token'), { backupId, components }, deps('b'))).toEqual({ status: 404 })
    expect(await reserveBackupComponents(request('token'), { backupId, components: [components[0], components[0]] }, deps())).toEqual({ status: 400 })
    expect(await reserveBackupComponents(request('token'), { backupId, components: [{ id: 'other', sizeBytes: 2 }, components[1]] }, deps())).toEqual({ status: 400 })
    expect(await reserveBackupComponents(request('token'), { backupId, components }, deps('a', () => Uint8Array.of(1)))).toEqual({ status: 400 })
    expect((await pg.query('SELECT component_key FROM arsen_backup_components')).rows).toEqual([])
  })
  it('rolls back the manifest marker and all components if an insert fails', async () => {
    let inserts = 0
    const transaction = <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => pg.transaction((tx) => fn((sql, params) => {
      if (sql.startsWith('INSERT INTO arsen_backup_components') && ++inserts === 2) throw new Error('simulated failure')
      return tx.query(sql, params)
    }))
    await expect(reserveBackupComponents(request('token'), { backupId, components }, { ...deps(), transaction })).rejects.toThrow('simulated failure')
    expect((await pg.query('SELECT component_key FROM arsen_backup_components')).rows).toEqual([])
    expect((await pg.query('SELECT manifest_size_bytes FROM arsen_backups WHERE id = $1', [backupId])).rows[0]).toEqual({ manifest_size_bytes: null })
  })
  it('reserves exactly the declared components and rejects conflicting retries', async () => {
    expect(await reserveBackupComponents(request('token'), { backupId, components }, deps())).toEqual({ status: 200 })
    expect(await reserveBackupComponents(request('token'), { backupId, components }, deps())).toEqual({ status: 200 })
    expect(await reserveBackupComponents(request('token'), { backupId, components: [{ id: 'image-a', sizeBytes: 1 }, { id: 'image-b', sizeBytes: 3 }] }, deps())).toEqual({ status: 409 })
    expect((await pg.query('SELECT component_key FROM arsen_backup_components')).rows).toHaveLength(2)
  })
})
