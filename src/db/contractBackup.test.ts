import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from './schema'
import { ensureDemoData } from './seedDemoRoutine'
import { createContractBackup, getContractBackupStatus, markContractBackupSaved, restoreContractBackup } from './contractBackup'
import { deleteRoutine } from '../domains/routine/services'
import { getProgressOverview } from '../domains/progress/repository'
import { registerMainSetForExercise, updateHistoricalSet } from '../domains/workout/services'

describe('versioned contract backup', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open(); await ensureDemoData() })
  afterEach(() => db.close())

  it('serializes deterministically and restores data, health and separately stored image bytes', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    const exercise = (await db.routineExercises.toArray())[0]!
    await db.exerciseAssets.add({ id: 'image', name: 'imagen', mimeType: 'image/png', dataUrl: 'data:image/png;base64,AQIDBA==', createdAt: now, updatedAt: now })
    await db.routineExercises.update(exercise.id, { customAssetId: 'image' })
    const metrics = { activeCaloriesKcal: null, heartRateAvgBpm: null, heartRateMaxBpm: null, heartRateMinBpm: null, oxygenSaturationAvgPercent: null, steps: 10 }
    await db.workoutSessions.add({ id: 'session', routineId: exercise.routineId, dayId: exercise.dayId, date: '2026-08-01', notes: '', displayUnit: 'kg', status: 'completed', createdAt: now, updatedAt: now, health: { day: { rangeStart: now, rangeEnd: now, metrics }, syncedAt: now, sourceDate: '2026-08-01' }, healthHistory: [{ day: { rangeStart: '2026-07-31T00:00:00.000Z', rangeEnd: '2026-07-31T20:00:00.000Z', metrics: { ...metrics, steps: 5 } }, syncedAt: now, sourceDate: '2026-07-31' }] })
    const first = await createContractBackup()
    const second = await createContractBackup()
    expect(first.manifest).toBe(second.manifest)
    expect(first.manifestSha256).toBe(second.manifestSha256)
    expect(first.manifest).not.toContain('AQIDBA==')
    expect([...first.binaries[0]!.bytes]).toEqual([1, 2, 3, 4])
    await db.routines.clear()
    await restoreContractBackup(first)
    expect(await db.routines.count()).toBe(1)
    expect((await db.exerciseAssets.get('image'))?.dataUrl).toBe('data:image/png;base64,AQIDBA==')
    expect((await db.workoutSessions.get('session'))?.health?.day.metrics.steps).toBe(10)
    expect((await db.workoutSessions.get('session'))?.healthHistory?.[0]?.day.metrics.steps).toBe(5)
    db.close()
    await db.open()
    expect((await db.workoutSessions.get('session'))?.health?.day.metrics.steps).toBe(10)
  })

  it('rejects altered binary content before changing existing data', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    await db.exerciseAssets.add({ id: 'image', name: 'imagen', mimeType: 'image/png', dataUrl: 'data:image/png;base64,AQIDBA==', createdAt: now, updatedAt: now })
    const backup = await createContractBackup()
    backup.binaries[0]!.bytes[0] = 9
    const before = await db.routines.toArray()
    await expect(restoreContractBackup(backup)).rejects.toThrow()
    expect(await db.routines.toArray()).toEqual(before)
  })

  it('preserves edited historical progress after deleting its routine and restoring the backup', async () => {
    const exercise = (await db.routineExercises.toArray())[0]!
    const recorded = await registerMainSetForExercise({ date: '2026-08-01', dayId: exercise.dayId, routineId: exercise.routineId, displayUnit: 'kg', exercise, weightKg: 30, reps: 8, rir: 1, dropSet: { weightKg: 20, reps: 5, rir: 1 } })
    await updateHistoricalSet({ setLogId: recorded.setLogId, weightKg: 35, reps: 10, rir: 1 })
    await deleteRoutine(exercise.routineId)
    const before = await getProgressOverview({ canonicalName: exercise.canonicalName })
    expect(before.volumeKg).toBe(450)
    const backup = await createContractBackup()
    await db.workoutSessions.clear()
    await restoreContractBackup(backup)
    expect(await getProgressOverview({ canonicalName: exercise.canonicalName })).toEqual(before)
  })

  it('rejects missing image components before changing existing data', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    await db.exerciseAssets.add({ id: 'image', name: 'imagen', mimeType: 'image/png', dataUrl: 'data:image/png;base64,AQIDBA==', createdAt: now, updatedAt: now })
    const backup = await createContractBackup()
    backup.binaries = []
    await expect(restoreContractBackup(backup)).rejects.toThrow()
    expect(await db.routines.count()).toBe(1)
    expect(await db.exerciseAssets.count()).toBe(1)
  })

  it('requires an explicit transition when settings record an older schema version', async () => {
    await db.settings.update('app', { schemaVersion: 5 })
    await expect(createContractBackup()).rejects.toThrow()
    expect((await db.settings.get('app'))?.schemaVersion).toBe(5)
  })

  it('rejects a structurally valid but incomplete dataset before replacing existing data', async () => {
    const backup = await createContractBackup()
    const manifest = JSON.parse(backup.manifest) as { tables: { settings: unknown[] } }
    manifest.tables.settings = []
    backup.manifest = JSON.stringify(manifest)
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(backup.manifest))
    backup.manifestSha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    const before = await db.routines.toArray()
    await expect(restoreContractBackup(backup)).rejects.toThrow()
    expect(await db.routines.toArray()).toEqual(before)
    expect(await db.settings.count()).toBe(1)
  })

  it('rejects a manifest that tries to import device-local backup status', async () => {
    const backup = await createContractBackup()
    const manifest = JSON.parse(backup.manifest) as { tables: { settings: Array<Record<string, unknown>> } }
    manifest.tables.settings[0]!.lastContractBackupSha256 = 'a'.repeat(64)
    backup.manifest = JSON.stringify(manifest)
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(backup.manifest))
    backup.manifestSha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    await expect(restoreContractBackup(backup)).rejects.toThrow()
    expect((await db.settings.get('app'))?.lastContractBackupSha256).toBeUndefined()
  })

  it('rolls back a replacement if writing a table fails', async () => {
    const backup = await createContractBackup()
    await db.routines.update('routine-demo-current', { name: 'Local actual' })
    const spy = vi.spyOn(db.routines, 'bulkAdd').mockRejectedValueOnce(new Error('falló la escritura'))
    try {
      await expect(restoreContractBackup(backup)).rejects.toThrow()
      expect((await db.routines.get('routine-demo-current'))?.name).toBe('Local actual')
      expect(await db.routineDays.count()).toBeGreaterThan(0)
    } finally {
      spy.mockRestore()
    }
  })

  it('detects committed changes since a saved backup without counting rolled-back writes', async () => {
    const backup = await createContractBackup()
    expect(await getContractBackupStatus()).toBe('needed')
    await markContractBackupSaved(backup.manifestSha256)
    expect(await getContractBackupStatus()).toBe('current')
    await expect(db.transaction('rw', db.routines, async () => {
      await db.routines.update('routine-demo-current', { name: 'No guardada' })
      throw new Error('cancelado')
    })).rejects.toThrow()
    expect(await getContractBackupStatus()).toBe('current')
    await db.routines.update('routine-demo-current', { name: 'Editada' })
    expect(await getContractBackupStatus()).toBe('needed')
  })

  it('does not include local backup status in the manifest and detects changes made before marking it saved', async () => {
    const first = await createContractBackup()
    await db.routines.update('routine-demo-current', { name: 'Cambió durante la copia' })
    await markContractBackupSaved(first.manifestSha256)
    expect(await getContractBackupStatus()).toBe('needed')
    const next = await createContractBackup()
    expect(next.manifest).not.toContain('lastContractBackupSha256')
    await markContractBackupSaved(next.manifestSha256)
    expect(await getContractBackupStatus()).toBe('current')
  })
})
