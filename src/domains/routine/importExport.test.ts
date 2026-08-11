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

  it('round-trips used assets with remapped IDs and clears missing asset references', async () => {
    const sourceRoutine = routine('routine-source', 'Rutina fuente')
    const sourceDay = day('day-source', sourceRoutine.id)
    const sourceAsset = asset('asset-source', 'press-fuente.png', 'data:image/png;base64,U09VUkNF')
    await db.routines.put(sourceRoutine)
    await db.routineDays.put(sourceDay)
    await db.routineExercises.bulkPut([
      exercise('exercise-source', sourceRoutine.id, sourceDay.id, sourceAsset.id),
      exercise('exercise-missing', sourceRoutine.id, sourceDay.id, 'asset-missing'),
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
    expect(importedExercises[1]?.customAssetId).toBeNull()
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
