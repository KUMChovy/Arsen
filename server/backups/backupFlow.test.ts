import 'fake-indexeddb/auto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createRemoteContractBackup, getLocalRevision, restoreRemoteContractBackup } from '../../src/db/contractBackup'
import { db } from '../../src/db/schema'
import { ensureDemoData } from '../../src/db/seedDemoRoutine'
import { authorizeAssetUpload } from './authorizeAssetUpload'
import { authorizeBackupDownload } from './authorizeDownload'
import { authorizeManifestUpload } from './authorizeManifestUpload'
import { backupObjectPath, createPrivateBlobReader } from './blobReader'
import { confirmBackup } from './confirm'
import { listBackups } from './list'
import { prepareBackup } from './prepare'
import { reserveBackupComponents } from './reserveComponents'
import { verifyArchive } from './verifyArchive'
import { encodePendingBackup } from '../../src/domains/account/pendingBackup'

describe('personal backup flow with simulated storage', () => {
  let pg: PGlite
  const device = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
  const id = '8166d21c-bac3-497b-9d22-8492474c982b'
  beforeAll(async () => {
    db.close(); await db.delete(); await db.open(); await ensureDemoData()
    pg = new PGlite()
    for (const path of ['001_accounts.sql', '003_backups.sql', '004_backup_components.sql', '006_backup_retention.sql']) await pg.exec(await readFile(`server/migrations/${path}`, 'utf8'))
    await pg.exec("INSERT INTO arsen_profiles (user_id) VALUES ('a'), ('b')")
    await pg.query('INSERT INTO arsen_devices (id,user_id) VALUES ($1,$2)', [device, 'a'])
  }, 30_000)
  afterAll(async () => { db.close(); await pg?.close() })
  it('prepares, verifies, confirms, lists and restores one account’s snapshot', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    await db.exerciseAssets.add({ id: 'image', name: 'imagen', mimeType: 'image/png', dataUrl: 'data:image/png;base64,AQIDBA==', createdAt: now, updatedAt: now })
    const routine = (await db.routines.toArray())[0]!
    const snapshot = await createRemoteContractBackup()
    const manifest = new TextEncoder().encode(snapshot.manifest)
    const bytes = snapshot.binaries[0]!.bytes
    const total = manifest.byteLength + bytes.byteLength
    const envelope = await encodePendingBackup(snapshot, { deviceId: device, backupId: id, baseBackupId: null, healthConsent: false, maxBytes: 2 * 1024 * 1024 })
    expect(JSON.parse(new TextDecoder().decode(envelope))).toMatchObject({ manifest: snapshot.manifest, sizeBytes: total, revision: snapshot.revision, binaries: [{ id: 'image', base64: 'AQIDBA==' }] })
    const auth = (userId: string) => ({ verify: async () => userId, role: async () => 'user' as const })
    const query = (sql: string, params: unknown[]) => pg.query<Record<string, unknown>>(sql, params)
    const transaction = <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => pg.transaction((tx) => fn((sql, params) => tx.query(sql, params)))
    const post = (body?: unknown) => new Request('https://api.example.test/backups', { method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
    const metadata = { id, contractVersion: 1, localRevision: snapshot.revision, baseBackupId: null, manifestSha256: snapshot.manifestSha256, sizeBytes: total, includesHealth: false, healthConsent: false }
    expect((await prepareBackup(post({ deviceId: device, backup: metadata }), { auth: auth('a'), transaction })).status).toBe(201)
    const store = new Map<string, Uint8Array>()
    const get = async (path: string) => {
      const object = store.get(path)
      return object ? { size: object.byteLength, stream: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(object); controller.close() } }) } : null
    }
    const read = createPrivateBlobReader('a', id, get)
    const sign = async () => 'https://storage.example.test/signed'
    expect((await authorizeManifestUpload(post(), { backupId: id, sizeBytes: manifest.byteLength }, { auth: auth('a'), transaction, sign })).status).toBe(200)
    store.set(backupObjectPath('a', id, 'manifest'), manifest)
    expect((await reserveBackupComponents(post(), { backupId: id, components: [{ id: 'image', sizeBytes: bytes.byteLength }] }, { auth: auth('a'), transaction, readManifest: async () => read('manifest', undefined, manifest.byteLength), maxBackupBytes: total })).status).toBe(200)
    expect((await authorizeAssetUpload(post(), { backupId: id, id: 'image' }, { auth: auth('a'), transaction, sign, maxBackupBytes: total })).status).toBe(200)
    store.set(backupObjectPath('a', id, 'asset', 'image'), bytes)
    expect((await confirmBackup(post(), id, { auth: auth('a'), transaction, verifyObjects: (backup) => verifyArchive(backup, read) })).status).toBe(200)
    const listing = await listBackups(new Request('https://api.example.test/backups', { headers: { authorization: 'Bearer token' } }), { auth: auth('a'), query })
    expect(listing.status === 200 && listing.backups.map((item) => item.id)).toEqual([id])
    expect((await authorizeBackupDownload(post(), { backupId: id, kind: 'manifest' }, { auth: auth('b'), transaction, sign })).status).toBe(404)
    expect((await authorizeBackupDownload(post(), { backupId: id, kind: 'asset', id: 'image' }, { auth: auth('a'), transaction, sign })).status).toBe(200)
    const downloadedManifest = await read('manifest', undefined, manifest.byteLength)
    const downloadedImage = await read('asset', 'image', bytes.byteLength)
    await db.routines.update(routine.id, { name: 'Local sin respaldar' })
    await restoreRemoteContractBackup({ ...snapshot, manifest: new TextDecoder().decode(downloadedManifest!), binaries: [{ id: 'image', bytes: downloadedImage! }] }, await getLocalRevision())
    expect((await db.routines.get(routine.id))?.name).toBe(routine.name)
    expect((await db.exerciseAssets.get('image'))?.dataUrl).toBe('data:image/png;base64,AQIDBA==')
  })
})
