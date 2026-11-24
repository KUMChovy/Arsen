import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import { downloadJson } from '../../shared/utils/download'
import { exportRoutineJson, importRoutineJson } from './importExport'
import type { ExerciseAsset, Routine, RoutineDay, RoutineExercise } from './types'

vi.mock('../../shared/utils/download', () => ({
  downloadJson: vi.fn(),
}))

const now = '2026-08-02T00:00:00.000Z'

describe('routine import and export', () => {
  beforeEach(async () => {
    await resetDb()
    vi.mocked(downloadJson).mockClear()
  })

  afterEach(resetDb)

  it('round-trips used assets with remapped IDs', async () => {
    const sourceRoutine = routine('routine-source', 'Rutina fuente')
    const sourceDay = day('day-source', sourceRoutine.id)
    const sourceAsset = asset('asset-source', 'press-fuente.png', 'data:image/png;base64,U09VUkNF')
    await db.routines.put(sourceRoutine)
    await db.settings.put({ id: 'app', schemaVersion: 8, activeRoutineId: sourceRoutine.id, preferredUnit: 'kg', deloadNotifications: true, storagePersisted: null, createdAt: now, updatedAt: now })
    await db.routineDays.put(sourceDay)
    await db.routineExercises.bulkPut([
      exercise('exercise-source', sourceRoutine.id, sourceDay.id, sourceAsset.id),
    ])
    await db.exerciseAssets.put(sourceAsset)

    await exportRoutineJson(sourceRoutine.id)

    const call = vi.mocked(downloadJson).mock.calls[0]
    expect(call).toBeDefined()
    if (!call) return
    const exported = call[1] as {
      days: RoutineDay[]
      exerciseAssets: ExerciseAsset[]
      exercises: RoutineExercise[]
      routine: Routine
    }
    expect(exported.exerciseAssets).toEqual([sourceAsset])

    await db.exerciseAssets.put(asset('asset-missing', 'local-no-relacionada.png', 'data:image/png;base64,TE9DQUw='))
    const importedRoutineId = await importRoutineJson(
      new File([JSON.stringify(exported)], 'rutina.json', { type: 'application/json' }),
    )

    const importedExercises = await db.routineExercises.where('routineId').equals(importedRoutineId).sortBy('order')
    const importedAsset = (await db.exerciseAssets.toArray()).find(
      (candidate) => candidate.dataUrl === sourceAsset.dataUrl && candidate.id !== sourceAsset.id,
    )

    expect(importedAsset).toMatchObject({ name: sourceAsset.name })
    expect(importedExercises[0]?.customAssetId).toBe(importedAsset?.id)
    expect(importedExercises[0]?.customAssetId).not.toBe(sourceAsset.id)
    expect(importedExercises).toHaveLength(1)
  })

  it('rejects a missing image component without importing a routine', async () => {
    const source = routine('source', 'Rutina')
    const data = { routine: source, days: [day('day', source.id)], exercises: [exercise('exercise', source.id, 'day', 'missing-image')], exerciseAssets: [], weeklyVolumeTargets: [], exportedAt: now, schemaVersion: 8 }
    await expect(importRoutineJson(new File([JSON.stringify(data)], 'rutina.json'))).rejects.toThrow()
    expect(await db.routines.count()).toBe(0)
  })

  it('does not export a routine that references a missing image', async () => {
    const source = routine('source', 'Rutina')
    await db.routines.put(source)
    await db.routineDays.put(day('day', source.id))
    await db.routineExercises.put(exercise('exercise', source.id, 'day', 'missing-image'))
    await expect(exportRoutineJson(source.id)).rejects.toThrow()
    expect(downloadJson).not.toHaveBeenCalled()
  })

  it('does not create an active routine when application settings are missing', async () => {
    const source = routine('source', 'Rutina')
    const data = { routine: source, days: [day('day', source.id)], exercises: [], exerciseAssets: [], weeklyVolumeTargets: [], exportedAt: now, schemaVersion: 8 }
    await expect(importRoutineJson(new File([JSON.stringify(data)], 'rutina.json'))).rejects.toThrow()
    expect(await db.routines.count()).toBe(0)
  })

  it('rejects an imported routine with duplicate day orders without altering the active routine', async () => {
    const local = routine('local', 'Local')
    await db.routines.put(local)
    await db.settings.put({ id: 'app', schemaVersion: 8, activeRoutineId: local.id, preferredUnit: 'kg', deloadNotifications: true, storagePersisted: null, createdAt: now, updatedAt: now })
    const source = routine('source', 'Rutina')
    const data = { routine: source, days: [day('a', source.id), day('b', source.id)], exercises: [], exerciseAssets: [], weeklyVolumeTargets: [], exportedAt: now, schemaVersion: 8 }
    await expect(importRoutineJson(new File([JSON.stringify(data)], 'rutina.json'))).rejects.toThrow()
    expect(await db.routines.toArray()).toEqual([local])
    expect((await db.settings.get('app'))?.activeRoutineId).toBe(local.id)
  })

  it('rejects invalid routine data without silently normalizing its weight', async () => {
    const local = routine('local', 'Local')
    await db.routines.put(local)
    await db.settings.put({ id: 'app', schemaVersion: 8, activeRoutineId: local.id, preferredUnit: 'kg', deloadNotifications: true, storagePersisted: null, createdAt: now, updatedAt: now })
    const source = routine('source', 'Rutina')
    const invalid = { ...exercise('exercise', source.id, 'day', ''), customAssetId: null, barWeightKg: -1 }
    const data = { routine: source, days: [day('day', source.id)], exercises: [invalid], exerciseAssets: [], weeklyVolumeTargets: [], exportedAt: now, schemaVersion: 8 }
    await expect(importRoutineJson(new File([JSON.stringify(data)], 'rutina.json'))).rejects.toThrow()
    expect(await db.routines.toArray()).toEqual([local])
  })

  it('rejects an exercise owned by a different source routine', async () => {
    const local = routine('local', 'Local')
    await db.routines.put(local)
    await db.settings.put({ id: 'app', schemaVersion: 8, activeRoutineId: local.id, preferredUnit: 'kg', deloadNotifications: true, storagePersisted: null, createdAt: now, updatedAt: now })
    const source = routine('source', 'Rutina')
    const invalid = { ...exercise('exercise', 'different', 'day', ''), customAssetId: null }
    const data = { routine: source, days: [day('day', source.id)], exercises: [invalid], exerciseAssets: [], weeklyVolumeTargets: [], exportedAt: now, schemaVersion: 8 }
    await expect(importRoutineJson(new File([JSON.stringify(data)], 'rutina.json'))).rejects.toThrow()
    expect(await db.routines.toArray()).toEqual([local])
  })

  it('rejects a routine whose exercise refers to a missing day without writing data', async () => {
    const source = routine('source', 'Rutina')
    const data = { routine: source, days: [day('day', source.id)], exercises: [exercise('exercise', source.id, 'missing-day', '')], exerciseAssets: [], weeklyVolumeTargets: [], exportedAt: now, schemaVersion: 8 }
    await expect(importRoutineJson(new File([JSON.stringify(data)], 'rutina.json'))).rejects.toThrow()
    expect(await db.routines.count()).toBe(0)
    expect(await db.routineExercises.count()).toBe(0)
  })
})

async function resetDb() {
  db.close()
  await db.delete()
  await db.open()
}

function routine(id: string, name: string): Routine {
  return { createdAt: now, id, isActive: true, name, updatedAt: now }
}

function day(id: string, routineId: string): RoutineDay {
  return { createdAt: now, description: '', id, name: 'Dia fuente', order: 0, routineId, updatedAt: now, weekday: null }
}

function asset(id: string, name: string, dataUrl: string): ExerciseAsset {
  return { createdAt: now, dataUrl, id, mimeType: 'image/png', name, updatedAt: now }
}

function exercise(id: string, routineId: string, dayId: string, customAssetId: string): RoutineExercise {
  return {
    assetKind: null,
    bundledAssetId: null,
    barWeightKg: 20,
    canonicalName: id,
    createdAt: now,
    currentWeightKg: 60,
    customAssetId,
    dayId,
    equipment: 'Barra',
    id,
    loadMode: 'split',
    mainMuscle: 'Pecho',
    name: id,
    order: id === 'exercise-source' ? 0 : 1,
    recommendedRir: 2,
    repsMax: 10,
    repsMin: 8,
    rest: '120 seg',
    restSeconds: 120,
    routineId,
    sourceExerciseId: null,
    targetSets: 4,
    technicalNotes: '',
    updatedAt: now,
    warmupProtocol: 'none',
    warmupSets: 0,
  }
}
