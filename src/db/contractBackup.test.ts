import 'fake-indexeddb/auto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArsenDatabase, dataTables, db } from './schema'
import { ensureDemoData } from './seedDemoRoutine'
import { createContractBackup, createRemoteContractBackup, getContractBackupStatus, getLocalRevision, markContractBackupSaved, restoreContractBackup, restoreRemoteContractBackup } from './contractBackup'
import { createCatalogExercise, deleteRoutine } from '../domains/routine/services'
import { applyRemoteCatalog } from '../domains/routine/remoteCatalogCache'
import { getProgressOverview } from '../domains/progress/repository'
import { registerMainSetForExercise, updateHistoricalSet } from '../domains/workout/services'
import { importFullBackup } from '../domains/settings/services'
import { datasetSchema } from '../shared/validation/dataset'

describe('versioned contract backup', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open(); await ensureDemoData() })
  afterEach(() => db.close())

  it('imports the generated demo history and prepares a contract backup', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'arsen-demo-'))
    try {
      const output = join(directory, 'backup.json')
      execFileSync(process.execPath, ['scripts/generate-demo-history.mjs', '--start', '2026-08-01', '--end', '2026-08-08', '--out', output])
      const content = readFileSync(output, 'utf8')
      const validation = datasetSchema.safeParse(JSON.parse(content).tables)
      expect(validation.success, validation.success ? undefined : JSON.stringify(validation.error.issues)).toBe(true)
      await importFullBackup({ text: async () => content } as File, 'merge')
      expect(await db.workoutSessions.count()).toBeGreaterThan(0)
      await expect(createContractBackup()).resolves.toHaveProperty('manifestSha256')
      await importFullBackup({ text: async () => content } as File, 'replace')
      expect(await db.workoutSessions.count()).toBeGreaterThan(0)
      await expect(createContractBackup()).resolves.toHaveProperty('manifestSha256')
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('rejects an invalid merge atomically without leaving an orphan day', async () => {
    const before = await db.routineDays.toArray()
    const revision = await getLocalRevision()
    const existing = before[0]!
    const incoming = { ...existing, id: 'orphan-day', routineId: 'missing-routine' }
    await expect(importFullBackup({ text: async () => JSON.stringify({ schemaVersion: 8, exportedAt: '2026-08-01T00:00:00.000Z', tables: { routineDays: [incoming] } }) } as File, 'merge')).rejects.toThrow()
    expect(await db.routineDays.toArray()).toEqual(before)
    expect(await getLocalRevision()).toBe(revision)
  })

  it('rejects replacing data with settings from a different schema version', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'arsen-version-'))
    try {
      const output = join(directory, 'backup.json')
      execFileSync(process.execPath, ['scripts/generate-demo-history.mjs', '--start', '2026-08-01', '--end', '2026-08-08', '--out', output])
      const data = JSON.parse(readFileSync(output, 'utf8')) as { tables: { settings: Array<{ schemaVersion: number }> } }
      data.tables.settings[0]!.schemaVersion = 6
      const before = await db.settings.get('app')
      await expect(importFullBackup({ text: async () => JSON.stringify(data) } as File, 'replace')).rejects.toThrow()
      expect(await db.settings.get('app')).toEqual(before)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('rejects a backup that declares an incompatible file schema version', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'arsen-file-version-'))
    try {
      const output = join(directory, 'backup.json')
      execFileSync(process.execPath, ['scripts/generate-demo-history.mjs', '--start', '2026-08-01', '--end', '2026-08-08', '--out', output])
      const data = JSON.parse(readFileSync(output, 'utf8')) as { schemaVersion: number }
      data.schemaVersion = 999
      const before = await db.settings.get('app')
      await expect(importFullBackup({ text: async () => JSON.stringify(data) } as File, 'replace')).rejects.toThrow()
      expect(await db.settings.get('app')).toEqual(before)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('rejects invalid input rather than normalizing it during replacement', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'arsen-invalid-'))
    try {
      const output = join(directory, 'backup.json')
      execFileSync(process.execPath, ['scripts/generate-demo-history.mjs', '--start', '2026-08-01', '--end', '2026-08-08', '--out', output])
      const data = JSON.parse(readFileSync(output, 'utf8')) as { tables: { routineExercises: Array<{ barWeightKg: number }> } }
      data.tables.routineExercises[0]!.barWeightKg = -1
      const before = await db.routineExercises.toArray()
      await expect(importFullBackup({ text: async () => JSON.stringify(data) } as File, 'replace')).rejects.toThrow()
      expect(await db.routineExercises.toArray()).toEqual(before)
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('rejects invalid catalog data rather than normalizing it during merge', async () => {
    const item = (await db.exerciseCatalog.toArray())[0]!
    const invalid = { ...item, id: 'invalid-catalog-item', barWeightKg: -1 }
    await expect(importFullBackup({ text: async () => JSON.stringify({ schemaVersion: 8, exportedAt: '2026-08-01T00:00:00.000Z', tables: { exerciseCatalog: [invalid] } }) } as File, 'merge')).rejects.toThrow()
    expect(await db.exerciseCatalog.get(invalid.id)).toBeUndefined()
  })

  it('rejects duplicate identifiers within a merged backup without changing local data', async () => {
    const source = (await db.routines.toArray())[0]!
    const duplicate = { ...source, id: 'duplicated-routine', isActive: false }
    const before = await db.routines.toArray()
    await expect(importFullBackup({ text: async () => JSON.stringify({ schemaVersion: 8, exportedAt: '2026-08-01T00:00:00.000Z', tables: { routines: [duplicate, duplicate] } }) } as File, 'merge')).rejects.toThrow()
    expect(await db.routines.toArray()).toEqual(before)
  })

  it('merges a distinct routine without replacing the locally active routine', async () => {
    const localSettings = (await db.settings.get('app'))!
    const source = (await db.routines.toArray())[0]!
    const incoming = { ...source, id: 'imported-routine', name: 'Importada', isActive: true }
    await importFullBackup({ text: async () => JSON.stringify({ schemaVersion: 8, exportedAt: '2026-08-01T00:00:00.000Z', tables: { routines: [incoming] } }) } as File, 'merge')
    expect(await db.routines.get('imported-routine')).toMatchObject({ isActive: false })
    expect((await db.settings.get('app'))?.activeRoutineId).toBe(localSettings.activeRoutineId)
    await expect(createContractBackup()).resolves.toHaveProperty('manifestSha256')
  })

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
    expect(JSON.parse(first.manifest).tables).not.toHaveProperty('localMetadata')
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

  it('preserves a global image reference without backing up global image bytes', async () => {
    const hash = 'a'.repeat(64)
    await applyRemoteCatalog({ version: 1, exercises: [{
      id: 'sinful-shell-nuevo', name: 'Ejercicio nuevo', canonicalName: 'ejercicio-nuevo', mainMuscle: 'Pecho',
      aliases: [], technicalNotes: 'Indicaciones.',
      image: { url: 'https://assets.example.test/a.png', sha256: hash, sizeBytes: 100, mimeType: 'image/png' },
    }] }, async () => true)
    const id = await createCatalogExercise({ mode: 'create-from-sinful-shell', sinfulShellId: 'sinful-shell-nuevo' })
    const backup = await createContractBackup()
    expect(backup.manifest).toContain(`global-image-v1:${hash}:100:png`)
    expect(backup.binaries).toHaveLength(0)
    await db.exerciseCatalog.delete(id)
    await restoreContractBackup(backup)
    expect((await db.exerciseCatalog.get(id))?.assetKind).toBe(`global-image-v1:${hash}:100:png`)
  })

  it('can exclude health summaries without changing local sessions or other backup data', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    const exercise = (await db.routineExercises.toArray())[0]!
    const metrics = { activeCaloriesKcal: null, heartRateAvgBpm: null, heartRateMaxBpm: null, heartRateMinBpm: null, oxygenSaturationAvgPercent: null, steps: 10 }
    const health = { day: { rangeStart: now, rangeEnd: now, metrics }, syncedAt: now, sourceDate: '2026-08-01' }
    await db.workoutSessions.add({ id: 'health-session', routineId: exercise.routineId, dayId: exercise.dayId, date: '2026-08-01', notes: '', displayUnit: 'kg', status: 'completed', createdAt: now, updatedAt: now, health, healthHistory: [health] })

    const backup = await createContractBackup({ includeHealth: false })
    const manifest = JSON.parse(backup.manifest)
    expect(manifest.health).toEqual([])
    expect(manifest.tables.workoutSessions).toHaveLength(1)
    expect(manifest.tables.workoutSessions[0]).not.toHaveProperty('health')
    expect(manifest.tables.workoutSessions[0]).not.toHaveProperty('healthHistory')
    expect((await db.workoutSessions.get('health-session'))?.health).toEqual(health)
    expect(JSON.parse((await createContractBackup()).manifest).health).toHaveLength(1)
  })

  it('excludes health and device-specific settings from cloud snapshots by default', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    const exercise = (await db.routineExercises.toArray())[0]!
    await db.settings.update('app', { healthIntegrationEnabled: true, healthIntegrationFirstConnectedAt: now, notificationPermission: 'granted', storagePersisted: true, lastDeloadNotificationDate: '2026-08-01' })
    const metrics = { activeCaloriesKcal: null, heartRateAvgBpm: null, heartRateMaxBpm: null, heartRateMinBpm: null, oxygenSaturationAvgPercent: null, steps: 10 }
    await db.workoutSessions.add({ id: 'cloud-session', routineId: exercise.routineId, dayId: exercise.dayId, date: '2026-08-01', notes: '', displayUnit: 'kg', status: 'completed', createdAt: now, updatedAt: now, health: { day: { rangeStart: now, rangeEnd: now, metrics }, syncedAt: now, sourceDate: '2026-08-01' } })
    const backup = await createRemoteContractBackup()
    const manifest = JSON.parse(backup.manifest)
    expect(manifest.health).toEqual([])
    expect(manifest.tables.settings[0]).not.toHaveProperty('notificationPermission')
    expect(manifest.tables.settings[0]).not.toHaveProperty('healthIntegrationEnabled')
    expect(manifest.tables.settings[0]).not.toHaveProperty('healthIntegrationFirstConnectedAt')
    expect(manifest.tables.settings[0]).not.toHaveProperty('lastDeloadNotificationDate')
    expect(manifest.tables.settings[0].storagePersisted).toBeNull()
    expect((await db.settings.get('app'))?.notificationPermission).toBe('granted')
    expect(JSON.parse((await createRemoteContractBackup({ healthConsent: true })).manifest).health).toHaveLength(1)
  })

  it('restores cloud data while preserving this device’s permissions and integration settings', async () => {
    const backup = await createRemoteContractBackup()
    await db.settings.update('app', { notificationPermission: 'denied', healthIntegrationEnabled: true, storagePersisted: true })
    await db.routines.update('routine-demo-current', { name: 'Cambio local' })
    await restoreRemoteContractBackup(backup, await getLocalRevision())
    expect(await db.settings.get('app')).toMatchObject({ notificationPermission: 'denied', healthIntegrationEnabled: true, storagePersisted: true })
    expect((await db.routines.get('routine-demo-current'))?.name).not.toBe('Cambio local')
    await expect(createContractBackup()).resolves.toHaveProperty('manifestSha256')
  })

  it('rejects a cloud manifest containing device-specific permission state without changing local data', async () => {
    const backup = await createRemoteContractBackup()
    const manifest = JSON.parse(backup.manifest)
    manifest.tables.settings[0].notificationPermission = 'granted'
    backup.manifest = JSON.stringify(manifest)
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(backup.manifest))
    backup.manifestSha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
    const before = await db.settings.get('app')
    await expect(restoreRemoteContractBackup(backup, await getLocalRevision())).rejects.toThrow()
    expect(await db.settings.get('app')).toEqual(before)
  })

  it('rejects cloud restoration when local data changed after the preview', async () => {
    const backup = await createRemoteContractBackup()
    const previewRevision = await getLocalRevision()
    await db.routines.update('routine-demo-current', { name: 'Dato posterior' })
    await expect(restoreRemoteContractBackup(backup, previewRevision)).rejects.toThrow()
    expect((await db.routines.get('routine-demo-current'))?.name).toBe('Dato posterior')
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

  it('tracks one committed revision per write transaction, excluding reads and backup markers', async () => {
    const initial = await getLocalRevision()
    const backup = await createContractBackup()
    expect(backup.revision).toBe(initial)
    await markContractBackupSaved(backup.manifestSha256)
    await db.routines.toArray()
    expect(await getLocalRevision()).toBe(initial)
    await db.transaction('rw', [db.routines, db.routineDays], async () => {
      await db.routines.update('routine-demo-current', { name: 'Actualizada' })
      const day = (await db.routineDays.toArray())[0]!
      await db.routineDays.update(day.id, { name: 'Actualizado' })
    })
    expect(await getLocalRevision()).toBe(initial + 1)
    await expect(db.transaction('rw', db.routines, async () => {
      await db.routines.update('routine-demo-current', { name: 'Revertida' })
      throw new Error('cancelado')
    })).rejects.toThrow()
    expect(await getLocalRevision()).toBe(initial + 1)
    db.close()
    await db.open()
    expect(await getLocalRevision()).toBe(initial + 1)
  })

  it('serializes concurrent writes into distinct committed revisions', async () => {
    const initial = await getLocalRevision()
    await Promise.all([
      db.routines.update('routine-demo-current', { name: 'Uno' }),
      db.routines.update('routine-demo-current', { name: 'Dos' }),
    ])
    expect(await getLocalRevision()).toBe(initial + 2)
  })

  it('preserves monotonic revisions across independent database connections', async () => {
    const second = new ArsenDatabase()
    try {
      await second.open()
      const initial = await getLocalRevision()
      await Promise.all([
        db.routines.update('routine-demo-current', { name: 'Primera conexión' }),
        second.routines.update('routine-demo-current', { name: 'Segunda conexión' }),
      ])
      expect(await getLocalRevision()).toBe(initial + 2)
    } finally {
      second.close()
    }
  })

  it('tracks direct writes and deletes across every contract table', async () => {
    let revision = await getLocalRevision()
    for (const table of dataTables()) {
      await table.put({ id: 'revision-test-record' })
      expect(await getLocalRevision()).toBe(++revision)
      await table.delete('revision-test-record')
      expect(await getLocalRevision()).toBe(++revision)
    }
  })

  it('rolls back data when persisting the revision fails', async () => {
    const before = await db.routines.get('routine-demo-current')
    const initial = await getLocalRevision()
    const original = IDBObjectStore.prototype.put
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (this.name === 'localMetadata') throw new Error('falló la revisión')
      return key === undefined ? original.call(this, value) : original.call(this, value, key)
    })
    try {
      await expect(db.routines.update('routine-demo-current', { name: 'No debe guardarse' })).rejects.toThrow()
      expect(await db.routines.get('routine-demo-current')).toEqual(before)
      expect(await getLocalRevision()).toBe(initial)
    } finally {
      spy.mockRestore()
    }
  })

  it('aborts the transaction even if a caller catches a revision read failure', async () => {
    const before = await db.routines.get('routine-demo-current')
    const original = IDBObjectStore.prototype.get
    const spy = vi.spyOn(IDBObjectStore.prototype, 'get').mockImplementation(function (this: IDBObjectStore, key) {
      if (this.name === 'localMetadata') throw new Error('falló la lectura de revisión')
      return original.call(this, key)
    })
    try {
      await expect(db.transaction('rw', db.routines, async () => {
        try { await db.routines.update('routine-demo-current', { name: 'No debe guardarse' }) } catch { /* caller recovers */ }
      })).rejects.toThrow()
      expect(await db.routines.get('routine-demo-current')).toEqual(before)
    } finally {
      spy.mockRestore()
    }
  })

  it('rejects a corrupted local revision before preparing a backup', async () => {
    await db.localMetadata.put({ id: 'revision', value: -1 })
    await expect(getLocalRevision()).rejects.toThrow()
    await expect(createContractBackup()).rejects.toThrow()
    expect(await db.routines.count()).toBeGreaterThan(0)
  })

  it('rejects a missing revision when stored user data already exists', async () => {
    await db.localMetadata.delete('revision')
    const before = await db.routines.get('routine-demo-current')
    await expect(getLocalRevision()).rejects.toThrow()
    await expect(createContractBackup()).rejects.toThrow()
    await expect(db.routines.update('routine-demo-current', { name: 'No debe guardarse' })).rejects.toThrow()
    expect(await db.routines.get('routine-demo-current')).toEqual(before)
    expect(await db.routines.count()).toBeGreaterThan(0)
  })

  it('refuses writes rather than overflowing the local revision', async () => {
    const before = await db.routines.get('routine-demo-current')
    await db.localMetadata.put({ id: 'revision', value: Number.MAX_SAFE_INTEGER })
    await expect(db.routines.update('routine-demo-current', { name: 'No debe guardarse' })).rejects.toThrow()
    expect(await db.routines.get('routine-demo-current')).toEqual(before)
    expect(await getLocalRevision()).toBe(Number.MAX_SAFE_INTEGER)
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
