import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { registerMainSetForExercise } from '../workout/services'
import type { Routine, RoutineDay, RoutineExercise } from '../routine/types'
import { getProgressExerciseDetail, getProgressExerciseOptions, getProgressHistory, getProgressSummary } from './repository'

describe('progress repository queries', () => {
  beforeEach(async () => resetDb())
  afterEach(async () => resetDb())

  it('summarizes all sessions without requiring a day and compares equal periods', async () => {
    const routine = makeRoutine('routine-a', 'Rutina A')
    const day = makeDay('day-a', routine.id, 'Día A')
    const exercise = makeExercise('exercise-a', routine.id, day.id)
    await db.routines.put(routine)
    await db.routineDays.put(day)
    await db.routineExercises.put(exercise)

    await registerMainSetForExercise({ date: '2026-07-01', dayId: day.id, displayUnit: 'kg', exercise, reps: 8, rir: 2, routineId: routine.id, weightKg: 60 })
    await registerMainSetForExercise({ date: '2026-08-01', dayId: day.id, displayUnit: 'kg', exercise, reps: 8, rir: 2, routineId: routine.id, weightKg: 65 })

    await expect(getProgressSummary({ period: '4w' })).resolves.toMatchObject({
      averageVolumeKg: 520,
      previousAverageVolumeKg: 480,
      previousSessionCount: 1,
      sessionCount: 1,
      totalSets: 1,
      volumeKg: 520,
    })
    await expect(getProgressSummary({ period: '4w' })).resolves.toMatchObject({
      previousSessions: [expect.objectContaining({ date: '2026-07-01', volumeKg: 480 })],
    })
  })

  it('keeps exercises globally discoverable after their routine and day are deleted', async () => {
    const routine = makeRoutine('routine-deleted', 'Rutina eliminada')
    const day = makeDay('day-deleted', routine.id, 'Día eliminado')
    const exercise = makeExercise('exercise-deleted', routine.id, day.id, 'Remo histórico', 'remo-historico')
    await db.routines.put(routine)
    await db.routineDays.put(day)
    await db.routineExercises.put(exercise)
    await registerMainSetForExercise({ date: '2026-08-10', dayId: day.id, displayUnit: 'kg', exercise, reps: 6, rir: 1, routineId: routine.id, weightKg: 70 })
    await db.routines.delete(routine.id)
    await db.routineDays.delete(day.id)

    await expect(getProgressExerciseOptions()).resolves.toEqual([
      expect.objectContaining({ canonicalName: 'remo-historico', lastTrainedDate: '2026-08-10', name: 'Remo histórico', sessions: 1 }),
    ])
  })

  it('applies optional period, routine, day and exercise filters to chronological history', async () => {
    const routineA = makeRoutine('routine-a', 'Rutina A')
    const routineB = makeRoutine('routine-b', 'Rutina B')
    const dayA = makeDay('day-a', routineA.id, 'Día A')
    const dayB = makeDay('day-b', routineB.id, 'Día B')
    const exerciseA = makeExercise('exercise-a', routineA.id, dayA.id, 'Press banca', 'press-banca')
    const exerciseB = makeExercise('exercise-b', routineB.id, dayB.id, 'Sentadilla', 'sentadilla')
    await db.routines.bulkPut([routineA, routineB])
    await db.routineDays.bulkPut([dayA, dayB])
    await db.routineExercises.bulkPut([exerciseA, exerciseB])
    await registerMainSetForExercise({ date: '2026-08-01', dayId: dayA.id, displayUnit: 'kg', exercise: exerciseA, reps: 8, rir: 2, routineId: routineA.id, weightKg: 60 })
    await registerMainSetForExercise({ date: '2026-08-02', dayId: dayB.id, displayUnit: 'kg', exercise: exerciseB, reps: 5, rir: 1, routineId: routineB.id, weightKg: 90 })

    await expect(getProgressHistory({ routineId: routineA.id, dayId: dayA.id, canonicalName: 'press-banca' })).resolves.toEqual([
      expect.objectContaining({ date: '2026-08-01', dayName: 'Día A', routineName: 'Rutina A' }),
    ])
  })

  it('builds one canonical exercise timeline across routine sessions', async () => {
    const routine = makeRoutine('routine-a', 'Rutina A')
    const day = makeDay('day-a', routine.id, 'Día A')
    const exercise = makeExercise('exercise-a', routine.id, day.id)
    await db.routines.put(routine)
    await db.routineDays.put(day)
    await db.routineExercises.put(exercise)
    await registerMainSetForExercise({ date: '2026-08-01', dayId: day.id, displayUnit: 'kg', exercise, reps: 8, rir: 2, routineId: routine.id, weightKg: 60 })
    await registerMainSetForExercise({ date: '2026-08-08', dayId: day.id, displayUnit: 'kg', exercise, reps: 6, rir: 1, routineId: routine.id, weightKg: 70 })

    await expect(getProgressExerciseDetail('press-inclinado', { period: 'all' })).resolves.toMatchObject({
      lastSessionDate: '2026-08-08',
      maxWeightKg: 70,
      name: 'Press inclinado',
      sessionCount: 2,
      sessions: [
        expect.objectContaining({ date: '2026-08-01', volumeKg: 480 }),
        expect.objectContaining({ date: '2026-08-08', volumeKg: 420 }),
      ],
    })
  })
})

async function resetDb() {
  db.close()
  await db.delete()
  await db.open()
}

function makeRoutine(id: string, name: string): Routine {
  return { createdAt: '2026-01-01T00:00:00.000Z', id, isActive: false, name, updatedAt: '2026-01-01T00:00:00.000Z' }
}

function makeDay(id: string, routineId: string, name: string): RoutineDay {
  return { createdAt: '2026-01-01T00:00:00.000Z', description: '', id, name, order: 0, routineId, updatedAt: '2026-01-01T00:00:00.000Z', weekday: null }
}

function makeExercise(id: string, routineId: string, dayId: string, name = 'Press inclinado', canonicalName = 'press-inclinado'): RoutineExercise {
  return {
    assetKind: null,
    barWeightKg: 0,
    bundledAssetId: null,
    canonicalName,
    createdAt: '2026-01-01T00:00:00.000Z',
    currentWeightKg: 0,
    customAssetId: null,
    dayId,
    equipment: 'Barra',
    id,
    loadMode: 'single',
    mainMuscle: 'Pecho',
    name,
    order: 0,
    recommendedRir: 2,
    repsMin: 6,
    repsMax: 12,
    rest: '90 s',
    restSeconds: 90,
    routineId,
    sourceExerciseId: null,
    targetSets: 3,
    technicalNotes: '',
    updatedAt: '2026-01-01T00:00:00.000Z',
    warmupProtocol: 'none',
    warmupSets: 0,
  }
}
