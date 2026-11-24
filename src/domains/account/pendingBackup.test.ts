import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { encodePendingBackup } from './pendingBackup'

const hash = (data: string | Uint8Array) => createHash('sha256').update(data).digest('hex')
const deviceId = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
const backupId = '8166d21c-bac3-497b-9d22-8492474c982b'
const bytes = Uint8Array.of(1, 2, 3, 4)
const manifest = JSON.stringify({ version: 1, tables: { settings: [{ id: 'app', storagePersisted: null }], workoutSessions: [] }, assets: [{ id: 'imagen', sha256: hash(bytes) }], health: [] })
const snapshot = { manifest, manifestSha256: hash(manifest), binaries: [{ id: 'imagen', bytes }], revision: 8 }
const options = { backupId, deviceId, baseBackupId: null, healthConsent: false, maxBytes: 4096 }

describe('pending native backup', () => {
  it('encodes stable metadata and binary bytes without credentials', async () => {
    const first = await encodePendingBackup(snapshot, options)
    const second = await encodePendingBackup(snapshot, options)
    expect(first).toEqual(second)
    const parsed = JSON.parse(new TextDecoder().decode(first))
    expect(parsed).toMatchObject({ version: 1, backupId, deviceId, baseBackupId: null, revision: 8, manifestSha256: hash(manifest), includesHealth: false, healthConsent: false, sizeBytes: new TextEncoder().encode(manifest).length + bytes.length, binaries: [{ id: 'imagen', base64: 'AQIDBA==' }] })
    expect(JSON.stringify(parsed)).not.toMatch(/password|token|secret/i)
  })
  it('rejects altered manifests, images, duplicate IDs and oversized envelopes', async () => {
    await expect(encodePendingBackup({ ...snapshot, manifestSha256: 'a'.repeat(64) }, options)).rejects.toThrow()
    await expect(encodePendingBackup({ ...snapshot, binaries: [{ id: 'imagen', bytes: Uint8Array.of(9) }] }, options)).rejects.toThrow()
    await expect(encodePendingBackup({ ...snapshot, binaries: [...snapshot.binaries, ...snapshot.binaries] }, options)).rejects.toThrow()
    await expect(encodePendingBackup(snapshot, { ...options, maxBytes: 10 })).rejects.toThrow()
    await expect(encodePendingBackup(snapshot, { ...options, backupId: 'not-a-uuid' })).rejects.toThrow()
  })
  it('captures component bytes before asynchronous hashing begins', async () => {
    const mutable = Uint8Array.of(1, 2, 3, 4)
    const pending = encodePendingBackup({ ...snapshot, binaries: [{ id: 'imagen', bytes: mutable }] }, options)
    mutable[0] = 9
    const parsed = JSON.parse(new TextDecoder().decode(await pending))
    expect(parsed.binaries[0].base64).toBe('AQIDBA==')
  })
  it('rejects embedded health or device-specific settings before persistence', async () => {
    const bad = JSON.parse(manifest)
    bad.tables.workoutSessions = [{ id: 'session', health: { steps: 10 } }]
    const health = JSON.stringify(bad)
    await expect(encodePendingBackup({ ...snapshot, manifest: health, manifestSha256: hash(health) }, options)).rejects.toThrow()
    bad.tables.workoutSessions = []
    bad.tables.settings[0].notificationPermission = 'granted'
    const device = JSON.stringify(bad)
    await expect(encodePendingBackup({ ...snapshot, manifest: device, manifestSha256: hash(device) }, options)).rejects.toThrow()
  })
})
