import 'fake-indexeddb/auto'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRemoteContractBackup } from '../../src/db/contractBackup'
import { db } from '../../src/db/schema'
import { ensureDemoData } from '../../src/db/seedDemoRoutine'
import { verifyArchive } from './verifyArchive'

describe('remote archive verification', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open(); await ensureDemoData() })
  afterEach(() => db.close())
  it('checks every declared component and total byte count', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    await db.exerciseAssets.add({ id: 'image', name: 'imagen', mimeType: 'image/png', dataUrl: 'data:image/png;base64,AQIDBA==', createdAt: now, updatedAt: now })
    const backup = await createRemoteContractBackup()
    const manifest = new TextEncoder().encode(backup.manifest)
    const objects = new Map([['manifest', manifest], ['image', backup.binaries[0]!.bytes]])
    const read = async (kind: 'manifest' | 'asset', id?: string) => objects.get(kind === 'manifest' ? 'manifest' : id ?? '') ?? null
    const metadata = { manifestSha256: backup.manifestSha256, sizeBytes: manifest.byteLength + 4, contractVersion: 1, includesHealth: false }
    expect(await verifyArchive(metadata, read)).toBe(true)
    objects.set('image', Uint8Array.from([1, 2, 3, 5]))
    expect(await verifyArchive(metadata, read)).toBe(false)
    objects.delete('image')
    expect(await verifyArchive(metadata, read)).toBe(false)
    objects.set('image', Uint8Array.from([1, 2, 3, 4]))
    expect(await verifyArchive({ ...metadata, sizeBytes: metadata.sizeBytes + 1 }, read)).toBe(false)
    expect(await verifyArchive({ ...metadata, includesHealth: true }, read)).toBe(false)
    expect(await verifyArchive({ ...metadata, contractVersion: 2 }, read)).toBe(false)
    expect(createHash('sha256').update(manifest).digest('hex')).toBe(metadata.manifestSha256)
  })
})
