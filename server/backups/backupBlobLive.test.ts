import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { del } from '@vercel/blob'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it, vi } from 'vitest'

// An independent in-memory IndexedDB factory cannot access the application's database.
vi.mock('../../src/db/schema', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/db/schema')>()
  const { IDBFactory, IDBKeyRange } = await import('fake-indexeddb')
  const { CONTRACT_TABLE_NAMES } = await import('../../src/db/revisionTracking')
  const db = new actual.ArsenDatabase(`arsen-live-test-${randomUUID()}`, { indexedDB: new IDBFactory(), IDBKeyRange })
  return { ...actual, db, dataTables: () => db.tables.filter((table) => (CONTRACT_TABLE_NAMES as readonly string[]).includes(table.name)) }
})

import { createRemoteContractBackup, getLocalRevision, restoreRemoteContractBackup } from '../../src/db/contractBackup'
import { db } from '../../src/db/schema'
import { ensureDemoData } from '../../src/db/seedDemoRoutine'
import { authorizeAssetUpload } from './authorizeAssetUpload'
import { authorizeBackupDownload } from './authorizeDownload'
import { authorizeManifestUpload } from './authorizeManifestUpload'
import { backupObjectPath } from './blobReader'
import { confirmBackup } from './confirm'
import { prepareBackup } from './prepare'
import { reserveBackupComponents } from './reserveComponents'
import { signPrivateBackupUpload } from './signUpload'
import { signPrivateBackupDownload } from './signDownload'
import { verifyArchive } from './verifyArchive'
import { createVercelBackupReader } from './vercelBlobReader'

describe.skipIf(process.env.RUN_BLOB_LIVE_CHECK !== '1')('isolated backup flow with private Blob', () => {
  it('restores an isolated snapshot and image verified against real private objects', async () => {
    expect(db.name).toMatch(/^arsen-live-test-/)
    const pg = new PGlite()
    const userId = `arsen-live-flow-${randomUUID()}`
    const deviceId = randomUUID()
    const backupId = randomUUID()
    const paths = [backupObjectPath(userId, backupId, 'manifest'), backupObjectPath(userId, backupId, 'asset', 'image')]
    const attemptedPaths: string[] = []
    try {
      await db.open(); await ensureDemoData()
      for (const name of ['001_accounts.sql', '003_backups.sql', '004_backup_components.sql', '006_backup_retention.sql']) await pg.exec(await readFile(`server/migrations/${name}`, 'utf8'))
      await pg.query('INSERT INTO arsen_profiles (user_id) VALUES ($1)', [userId])
      const otherUserId = `arsen-live-other-${randomUUID()}`
      await pg.query('INSERT INTO arsen_profiles (user_id) VALUES ($1)', [otherUserId])
      await pg.query('INSERT INTO arsen_devices (id,user_id) VALUES ($1,$2)', [deviceId, userId])
      const now = '2026-08-01T00:00:00.000Z'
      await db.exerciseAssets.add({ id: 'image', name: 'imagen', mimeType: 'image/png', dataUrl: 'data:image/png;base64,AQIDBA==', createdAt: now, updatedAt: now })
      const routine = (await db.routines.toArray())[0]!
      const snapshot = await createRemoteContractBackup()
      const manifest = new TextEncoder().encode(snapshot.manifest)
      const image = snapshot.binaries[0]!.bytes
      const total = manifest.byteLength + image.byteLength
      const auth = { verify: async () => userId, role: async () => 'user' as const }
      const transaction = <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => pg.transaction((tx) => fn((sql, params) => tx.query(sql, params)))
      const post = (body?: unknown) => new Request('https://api.example.test/backups', { method: 'POST', headers: { authorization: 'Bearer token', 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
      const backup = { id: backupId, contractVersion: 1, localRevision: snapshot.revision, baseBackupId: null, manifestSha256: snapshot.manifestSha256, sizeBytes: total, includesHealth: false, healthConsent: false }
      expect((await prepareBackup(post({ deviceId, backup }), { auth, transaction })).status).toBe(201)
      const sign = (input: Parameters<typeof signPrivateBackupUpload>[0]) => signPrivateBackupUpload(input)
      const manifestAuth = await authorizeManifestUpload(post(), { backupId, sizeBytes: manifest.byteLength }, { auth, transaction, sign })
      expect(manifestAuth.status).toBe(200)
      if (manifestAuth.status !== 200) throw new Error('No se autorizó el manifiesto')
      attemptedPaths.push(paths[0]!)
      expect((await fetch(manifestAuth.url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: manifest, signal: AbortSignal.timeout(15_000) })).ok).toBe(true)
      const read = createVercelBackupReader(userId, backupId)
      expect((await reserveBackupComponents(post(), { backupId, components: [{ id: 'image', sizeBytes: image.byteLength }] }, { auth, transaction, readManifest: async () => read('manifest', undefined, manifest.byteLength), maxBackupBytes: total })).status).toBe(200)
      const imageAuth = await authorizeAssetUpload(post(), { backupId, id: 'image' }, { auth, transaction, sign, maxBackupBytes: total })
      expect(imageAuth.status).toBe(200)
      if (imageAuth.status !== 200) throw new Error('No se autorizó la imagen')
      attemptedPaths.push(paths[1]!)
      expect((await fetch(imageAuth.url, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: Uint8Array.from(image).buffer, signal: AbortSignal.timeout(15_000) })).ok).toBe(true)
      expect((await confirmBackup(post(), backupId, { auth, transaction, verifyObjects: (value) => verifyArchive(value, read) })).status).toBe(200)
      const otherAuth = { ...auth, verify: async () => otherUserId }
      expect((await authorizeBackupDownload(post(), { backupId, kind: 'manifest' }, { auth: otherAuth, transaction, sign: signPrivateBackupDownload })).status).toBe(404)
      const manifestDownload = await authorizeBackupDownload(post(), { backupId, kind: 'manifest' }, { auth, transaction, sign: signPrivateBackupDownload })
      const imageDownload = await authorizeBackupDownload(post(), { backupId, kind: 'asset', id: 'image' }, { auth, transaction, sign: signPrivateBackupDownload })
      expect(manifestDownload.status).toBe(200)
      expect(imageDownload.status).toBe(200)
      if (manifestDownload.status !== 200 || imageDownload.status !== 200) throw new Error('No se autorizó la descarga')
      const manifestResponse = await fetch(manifestDownload.url, { signal: AbortSignal.timeout(15_000) })
      const imageResponse = await fetch(imageDownload.url, { signal: AbortSignal.timeout(15_000) })
      expect(manifestResponse.ok && imageResponse.ok).toBe(true)
      const downloadedManifest = new Uint8Array(await manifestResponse.arrayBuffer())
      const downloadedImage = new Uint8Array(await imageResponse.arrayBuffer())
      await db.routines.update(routine.id, { name: 'Modificación de prueba' })
      await restoreRemoteContractBackup({ ...snapshot, manifest: new TextDecoder().decode(downloadedManifest!), binaries: [{ id: 'image', bytes: downloadedImage! }] }, await getLocalRevision())
      expect((await db.routines.get(routine.id))?.name).toBe(routine.name)
      expect((await db.exerciseAssets.get('image'))?.dataUrl).toBe('data:image/png;base64,AQIDBA==')
    } finally {
      try { if (attemptedPaths.length) await del(attemptedPaths, { abortSignal: AbortSignal.timeout(15_000) }) }
      finally { db.close(); await pg.close() }
    }
  }, 120_000)
})
