import 'fake-indexeddb/auto'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRemoteContractBackup } from '../../src/db/contractBackup'
import { db } from '../../src/db/schema'
import { ensureDemoData } from '../../src/db/seedDemoRoutine'
import { validateRemoteManifest } from './validateManifest'

const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value))
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

describe('remote backup manifest verification', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open(); await ensureDemoData() })
  afterEach(() => db.close())

  it('accepts a valid private snapshot with no health data', async () => {
    const backup = await createRemoteContractBackup()
    const bytes = new TextEncoder().encode(backup.manifest)
    expect(validateRemoteManifest(bytes, backup.manifestSha256, false)).toEqual({ assets: [], healthIncluded: false })
  })

  it('rejects altered data, missing tables and device-specific permissions', async () => {
    const backup = await createRemoteContractBackup()
    const bytes = new TextEncoder().encode(backup.manifest)
    expect(() => validateRemoteManifest(bytes, 'f'.repeat(64), false)).toThrow()
    const missing = JSON.parse(backup.manifest)
    delete missing.tables.routines
    expect(() => validateRemoteManifest(encode(missing), hash(encode(missing)), false)).toThrow()
    const device = JSON.parse(backup.manifest)
    device.tables.settings[0].notificationPermission = 'granted'
    expect(() => validateRemoteManifest(encode(device), hash(encode(device)), false)).toThrow()
    const incompatible = JSON.parse(backup.manifest)
    incompatible.tables.settings[0].schemaVersion = 999
    expect(() => validateRemoteManifest(encode(incompatible), hash(encode(incompatible)), false)).toThrow()
  })

  it('requires each image component to have exactly one metadata record', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    await db.exerciseAssets.add({ id: 'image', name: 'imagen', mimeType: 'image/png', dataUrl: 'data:image/png;base64,AQIDBA==', createdAt: now, updatedAt: now })
    const backup = await createRemoteContractBackup()
    const bytes = encode(JSON.parse(backup.manifest))
    expect(validateRemoteManifest(bytes, hash(bytes), false).assets).toEqual([{ id: 'image', mimeType: 'image/png', sha256: hash(Uint8Array.from([1, 2, 3, 4])) }])
    const missing = JSON.parse(backup.manifest)
    missing.assets = []
    expect(() => validateRemoteManifest(encode(missing), hash(encode(missing)), false)).toThrow()
    const duplicate = JSON.parse(backup.manifest)
    duplicate.assets.push(duplicate.assets[0])
    expect(() => validateRemoteManifest(encode(duplicate), hash(encode(duplicate)), false)).toThrow()
  })

  it('rejects oversized manifests before parsing', () => {
    const bytes = new Uint8Array(4 * 1024 * 1024 + 1)
    expect(() => validateRemoteManifest(bytes, hash(bytes), false)).toThrow()
  })

  it('rejects health data when server consent is absent', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    const exercise = (await db.routineExercises.toArray())[0]!
    const metrics = { activeCaloriesKcal: null, heartRateAvgBpm: null, heartRateMaxBpm: null, heartRateMinBpm: null, oxygenSaturationAvgPercent: null, steps: 10 }
    await db.workoutSessions.add({ id: 'session', routineId: exercise.routineId, dayId: exercise.dayId, date: '2026-08-01', notes: '', displayUnit: 'kg', status: 'completed', createdAt: now, updatedAt: now, health: { day: { rangeStart: now, rangeEnd: now, metrics }, syncedAt: now, sourceDate: '2026-08-01' } })
    const backup = await createRemoteContractBackup({ healthConsent: true })
    const bytes = new TextEncoder().encode(backup.manifest)
    expect(() => validateRemoteManifest(bytes, backup.manifestSha256, false)).toThrow()
    expect(validateRemoteManifest(bytes, backup.manifestSha256, true).healthIncluded).toBe(true)
  })
})
