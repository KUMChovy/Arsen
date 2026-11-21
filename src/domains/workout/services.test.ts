import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import type { RoutineExercise } from '../routine/types'
import { addDropSet, completeSessionForDay, deleteMainSet, deleteHistoricalExercise, duplicateSessionAsDraft, ensureExerciseLog, registerMainSetForExercise, updateHistoricalSession, updateHistoricalSet } from './services'

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

  it('updates a historical session atomically and keeps its exercise ownership intact', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)
    await db.routines.put({ createdAt: exercise.createdAt, id: exercise.routineId, isActive: true, name: 'Rutina', updatedAt: exercise.updatedAt })
    await db.routineDays.put({ createdAt: exercise.createdAt, description: '', id: exercise.dayId, name: 'Día', order: 0, routineId: exercise.routineId, updatedAt: exercise.updatedAt, weekday: null })
    const registered = await registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })

    await updateHistoricalSession(registered.sessionId, { date: '2026-08-12', dayId: exercise.dayId, notes: 'Buena sesión', routineId: exercise.routineId, status: 'completed' })

    await expect(db.workoutSessions.get(registered.sessionId)).resolves.toMatchObject({ date: '2026-08-12', dayId: exercise.dayId, notes: 'Buena sesión', status: 'completed' })
    await expect(db.exerciseLogs.where('sessionId').equals(registered.sessionId).count()).resolves.toBe(1)
  })

  it('updates a main set without detaching its drop sets', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)
    const registered = await registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    await addDropSet({ displayUnit: 'kg', reps: 6, rir: 2, setLogId: registered.setLogId, weightKg: 40 })

    await updateHistoricalSet({ order: 0, reps: 10, rir: 1, setLogId: registered.setLogId, weightKg: 62.5 })

    await expect(db.setLogs.get(registered.setLogId)).resolves.toMatchObject({ reps: 10, weightKg: 62.5 })
    await expect(db.dropSetLogs.where('setLogId').equals(registered.setLogId).count()).resolves.toBe(1)
  })

  it('deletes an exercise and all of its related sets, drops and skips', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)
    const registered = await registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    await addDropSet({ displayUnit: 'kg', reps: 6, rir: 2, setLogId: registered.setLogId, weightKg: 40 })

    await deleteHistoricalExercise(registered.exerciseLogId)

    await expect(db.exerciseLogs.get(registered.exerciseLogId)).resolves.toBeUndefined()
    await expect(db.setLogs.where('exerciseLogId').equals(registered.exerciseLogId).count()).resolves.toBe(0)
    await expect(db.dropSetLogs.where('setLogId').equals(registered.setLogId).count()).resolves.toBe(0)
  })

  it('duplicates only the session structure into a new draft with reference values', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)
    const registered = await registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })

    const duplicate = await duplicateSessionAsDraft({ sourceSessionId: registered.sessionId, targetDate: '2026-08-12' })

    await expect(db.workoutSessions.get(duplicate.sessionId)).resolves.toMatchObject({ date: '2026-08-12', dayId: exercise.dayId, routineId: exercise.routineId, status: 'draft' })
    await expect(db.exerciseLogs.where('sessionId').equals(duplicate.sessionId).count()).resolves.toBe(1)
    await expect(db.setLogs.where('exerciseLogId').anyOf(await db.exerciseLogs.where('sessionId').equals(duplicate.sessionId).primaryKeys()).count()).resolves.toBe(0)
    expect(duplicate.references).toEqual([expect.objectContaining({ reps: 8, weightKg: 60 })])
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
