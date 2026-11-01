import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import type { RoutineExercise } from '../routine/types'
import { completeSessionForDay, deleteMainSet, ensureExerciseLog, registerMainSetForExercise } from './services'

async function resetDb() {
  db.close()
  await db.delete()
  await db.open()
}

describe('workout services snapshots', () => {
  beforeEach(resetDb)

  afterEach(async () => {
    vi.useRealTimers()
    db.close()
    await db.delete()
  })

  it('stores Sinful Shell bundled image data in the exercise log snapshot', async () => {
    const exercise = routineExercise({
      bundledAssetId: 'press-inclinado--pecho',
      canonicalName: 'press-inclinado',
      mainMuscle: 'Pecho',
      name: 'Press inclinado',
    })

    const logId = await ensureExerciseLog('session-1', exercise)

    await db.routineExercises.put({
      ...exercise,
      bundledAssetId: 'press-plano--pecho',
      name: 'Press plano editado',
      updatedAt: '2026-08-11T00:00:00.000Z',
    })

    await expect(db.exerciseLogs.get(logId)).resolves.toMatchObject({
      snapshot: {
        bundledAssetId: 'press-inclinado--pecho',
        canonicalName: 'press-inclinado',
        customAssetId: null,
        mainMuscle: 'Pecho',
        name: 'Press inclinado',
      },
    })
  })

  it('captures the first and last registered exercise times and completion time', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-11T16:42:00.000Z'))
    const first = await registerMainSetForExercise({
      date: '2026-08-11',
      dayId: exercise.dayId,
      displayUnit: 'kg',
      exercise,
      reps: 8,
      rir: 1,
      routineId: exercise.routineId,
      weightKg: 60,
    })

    vi.setSystemTime(new Date('2026-08-11T18:30:00.000Z'))
    await registerMainSetForExercise({
      date: '2026-08-11',
      dayId: exercise.dayId,
      displayUnit: 'kg',
      exercise,
      reps: 7,
      rir: 1,
      routineId: exercise.routineId,
      weightKg: 62.5,
    })

    vi.setSystemTime(new Date('2026-08-11T18:40:00.000Z'))
    await completeSessionForDay({
      date: '2026-08-11',
      dayId: exercise.dayId,
      displayUnit: 'kg',
      routineId: exercise.routineId,
    })

    await expect(db.workoutSessions.get(first.sessionId)).resolves.toMatchObject({
      completedAt: '2026-08-11T18:40:00.000Z',
      lastExerciseAt: '2026-08-11T18:30:00.000Z',
      startedAt: '2026-08-11T16:42:00.000Z',
    })
  })

  it('recomputes the health interval after deleting the latest main set', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-08-11T16:42:00.000Z'))
    const first = await registerMainSetForExercise({
      date: '2026-08-11',
      dayId: exercise.dayId,
      displayUnit: 'kg',
      exercise,
      reps: 8,
      rir: 1,
      routineId: exercise.routineId,
      weightKg: 60,
    })

    vi.setSystemTime(new Date('2026-08-11T18:30:00.000Z'))
    const second = await registerMainSetForExercise({
      date: '2026-08-11',
      dayId: exercise.dayId,
      displayUnit: 'kg',
      exercise,
      reps: 7,
      rir: 1,
      routineId: exercise.routineId,
      weightKg: 62.5,
    })

    await deleteMainSet(second.setLogId)

    await expect(db.workoutSessions.get(first.sessionId)).resolves.toMatchObject({
      lastExerciseAt: '2026-08-11T16:42:00.000Z',
      startedAt: '2026-08-11T16:42:00.000Z',
    })
  })
})

function routineExercise(overrides: Partial<RoutineExercise> = {}): RoutineExercise {
  const now = '2026-08-11T00:00:00.000Z'

  return {
    assetKind: null,
    barWeightKg: 20,
    bundledAssetId: null,
    canonicalName: 'press-inclinado',
    createdAt: now,
    currentWeightKg: 60,
    customAssetId: null,
    dayId: 'day-1',
    equipment: 'Barra',
    id: 'exercise-1',
    loadMode: 'single',
    mainMuscle: 'Pecho',
    name: 'Press inclinado',
    order: 0,
    recommendedRir: 2,
    repsMax: 10,
    repsMin: 8,
    rest: '90 seg',
    restSeconds: 90,
    routineId: 'routine-1',
    sourceExerciseId: 'catalog-1',
    targetSets: 3,
    technicalNotes: '',
    updatedAt: now,
    warmupProtocol: 'none',
    warmupSets: 0,
    ...overrides,
  }
}
