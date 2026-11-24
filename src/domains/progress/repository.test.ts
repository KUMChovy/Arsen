import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import { deleteWorkoutSession, registerMainSetForExercise, registerWarmupForExercise, updateExerciseNotesForDay } from '../workout/services'
import type { Routine, RoutineDay, RoutineExercise } from '../routine/types'
import { getHistory, getPersonalRecords, getProgressDataset, getProgressEditOptions, getProgressExerciseDetail, getProgressExerciseOptions, getProgressHistory, getProgressSummary, getSessionDetail } from './repository'

describe('progress repository queries', () => {
  beforeEach(async () => resetDb())
  afterEach(async () => resetDb())

  it('reads routine and day data from one consistent snapshot', async () => {
    await db.routines.put(makeRoutine('routine', 'Antes'))
    await db.routineDays.put(makeDay('day', 'routine', 'Antes'))
    const original = db.routines.toArray.bind(db.routines)
    let pending: Promise<unknown> | undefined
    const spy = vi.spyOn(db.routines, 'toArray').mockImplementationOnce(() => Dexie.Promise.resolve((async () => {
      pending = Dexie.ignoreTransaction(() => db.transaction('rw', [db.routines, db.routineDays], async () => {
        await db.routines.update('routine', { name: 'Después' })
        await db.routineDays.update('day', { name: 'Después' })
      }))
      const race = Promise.race([pending, new Promise<void>((resolve) => setTimeout(resolve, 40))])
      await (Dexie.currentTransaction ? Dexie.waitFor(race) : race)
      return original()
    })()))
    try {
      const data = await getProgressDataset()
      await pending
      expect(data.routines[0]?.name).toBe(data.days[0]?.name)
    } finally {
      spy.mockRestore()
    }
  })

  it('reads session details consistently while the session is deleted', async () => {
    const routine = makeRoutine('routine', 'Rutina')
    const day = makeDay('day', routine.id, 'Día')
    const exercise = makeExercise('exercise', routine.id, day.id)
    await db.routines.put(routine)
    await db.routineDays.put(day)
    const { sessionId } = await registerMainSetForExercise({ date: '2026-08-01', dayId: day.id, displayUnit: 'kg', exercise, reps: 8, rir: 2, routineId: routine.id, weightKg: 60 })
    const original = db.workoutSessions.get.bind(db.workoutSessions)
    let pending: Promise<unknown> | undefined
    const spy = vi.spyOn(db.workoutSessions, 'get').mockImplementationOnce((key) => Dexie.Promise.resolve((async () => {
      const result = await original(key)
      pending = Dexie.ignoreTransaction(() => deleteWorkoutSession(sessionId))
      const race = Promise.race([pending, new Promise<void>((resolve) => setTimeout(resolve, 40))])
      await (Dexie.currentTransaction ? Dexie.waitFor(race) : race)
      return result
    })()))
    try {
      const detail = await getSessionDetail(sessionId)
      await pending
      expect(detail?.exercises[0]?.sets).toHaveLength(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('reads edit options from one snapshot while routines are renamed', async () => {
    await db.routines.put(makeRoutine('routine', 'Antes'))
    await db.routineDays.put(makeDay('day', 'routine', 'Antes'))
    const original = db.routineDays.toArray.bind(db.routineDays)
    let pending: Promise<unknown> | undefined
    const spy = vi.spyOn(db.routineDays, 'toArray').mockImplementationOnce(() => Dexie.Promise.resolve((async () => {
      pending = Dexie.ignoreTransaction(() => db.transaction('rw', [db.routines, db.routineDays], async () => {
        await db.routines.update('routine', { name: 'Después' })
        await db.routineDays.update('day', { name: 'Después' })
      }))
      const race = Promise.race([pending, new Promise<void>((resolve) => setTimeout(resolve, 40))])
      await (Dexie.currentTransaction ? Dexie.waitFor(race) : race)
      return original()
    })()))
    try {
      const options = await getProgressEditOptions()
      await pending
      expect(options.routines[0]?.name).toBe(options.days[0]?.name)
    } finally {
      spy.mockRestore()
    }
  })

  it('shows the original routine and day names after they are renamed or deleted', async () => {
    const routine = makeRoutine('routine-history', 'Original')
    const day = makeDay('day-history', routine.id, 'Día original')
    const exercise = makeExercise('exercise-history', routine.id, day.id)
    await db.routines.put(routine)
    await db.routineDays.put(day)
    await db.routineExercises.put(exercise)
    const { sessionId } = await registerMainSetForExercise({ date: '2026-08-01', dayId: day.id, displayUnit: 'kg', exercise, reps: 8, rir: 2, routineId: routine.id, weightKg: 60 })
    await db.routines.update(routine.id, { name: 'Cambiada' })
    await db.routineDays.delete(day.id)
    expect(await getSessionDetail(sessionId)).toMatchObject({ routineName: 'Original', dayName: 'Día original' })
    expect((await getHistory()).sessions).toEqual(expect.arrayContaining([expect.objectContaining({ routineName: 'Original', dayName: 'Día original' })]))
    expect(await getProgressHistory()).toEqual(expect.arrayContaining([expect.objectContaining({ routineName: 'Original', dayName: 'Día original' })]))
  })

  it('returns warmups separately from main sets in the session detail', async () => {
    const routine = makeRoutine('routine-warmup', 'Rutina')
    const day = makeDay('day-warmup', routine.id, 'Día')
    const exercise = makeExercise('exercise-warmup', routine.id, day.id)
    await db.routines.put(routine)
    await db.routineDays.put(day)
    const result = await registerWarmupForExercise({ date: '2026-08-01', dayId: day.id, displayUnit: 'kg', exercise, reps: 10, rir: 4, routineId: routine.id, weightKg: 30 })
    expect(await getSessionDetail(result.sessionId)).toMatchObject({ exercises: [{ sets: [], warmupSets: [{ weightKg: 30, reps: 10 }] }] })
  })

  it('returns a session exercise note without replacing its routine instructions', async () => {
    const routine = makeRoutine('routine-note', 'Rutina')
    const day = makeDay('day-note', routine.id, 'Día')
    const exercise = makeExercise('exercise-note', routine.id, day.id)
    await db.routines.put(routine)
    await db.routineDays.put(day)
    const logId = await updateExerciseNotesForDay({ date: '2026-08-01', dayId: day.id, displayUnit: 'kg', exercise, notes: 'Buena técnica', routineId: routine.id })
    const log = await db.exerciseLogs.get(logId)
    expect(await getSessionDetail(log!.sessionId)).toMatchObject({ exercises: [{ notes: 'Buena técnica' }] })
  })

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

  it('returns the complete searchable history with independent same-day sessions and drafts', async () => {
    const routineA = makeRoutine('routine-history-a', 'Rutina A')
    const routineB = makeRoutine('routine-history-b', 'Rutina B')
    const dayA = makeDay('day-history-a', routineA.id, 'Día A')
    const dayB = makeDay('day-history-b', routineB.id, 'Día B')
    const exerciseA = makeExercise('exercise-history-a', routineA.id, dayA.id, 'Press Bíceps', 'press-biceps')
    const exerciseB = makeExercise('exercise-history-b', routineB.id, dayB.id, 'Sentadilla', 'sentadilla')
    await db.routines.bulkPut([routineA, routineB])
    await db.routineDays.bulkPut([dayA, dayB])
    await db.routineExercises.bulkPut([exerciseA, exerciseB])

    const first = await registerMainSetForExercise({ date: '2026-08-15', dayId: dayA.id, displayUnit: 'kg', exercise: exerciseA, reps: 8, rir: 2, routineId: routineA.id, weightKg: 60 })
    const second = await registerMainSetForExercise({ date: '2026-08-15', dayId: dayB.id, displayUnit: 'kg', exercise: exerciseB, reps: 5, rir: 1, routineId: routineB.id, weightKg: 90 })
    await db.workoutSessions.update(first.sessionId, { completedAt: '2026-08-15T12:00:00.000Z', status: 'completed' })
    await db.workoutSessions.update(second.sessionId, { completedAt: '2026-08-15T12:00:00.000Z', status: 'completed' })
    await db.workoutSessions.put({
      createdAt: '2026-08-16T12:00:00.000Z',
      date: '2026-08-16',
      dayId: dayA.id,
      displayUnit: 'kg',
      id: 'draft-history',
      lastExerciseAt: null,
      notes: 'Pendiente',
      routineId: routineA.id,
      startedAt: null,
      status: 'draft',
      updatedAt: '2026-08-16T12:00:00.000Z',
    })

    const history = await getHistory()
    expect(history.summary).toMatchObject({ sessions: 3, distinctTrainingDays: 1 })
    expect(history.sessions).toEqual(expect.arrayContaining([
      expect.objectContaining({ sessionId: 'draft-history', status: 'draft', mainSetCount: 0 }),
      expect.objectContaining({ sessionId: second.sessionId, date: '2026-08-15' }),
      expect.objectContaining({ sessionId: first.sessionId, date: '2026-08-15' }),
    ]))
    await expect(getHistory({ search: 'BICEPS' })).resolves.toMatchObject({
      sessions: [expect.objectContaining({ sessionId: first.sessionId })],
    })
  })

  it('returns verified personal records from completed sessions only', async () => {
    const routine = makeRoutine('routine-records', 'Rutina records')
    const day = makeDay('day-records', routine.id, 'Día A')
    const exercise = makeExercise('exercise-records', routine.id, day.id, 'Press record', 'press-record')
    await db.routines.put(routine)
    await db.routineDays.put(day)
    await db.routineExercises.put(exercise)
    const completed = await registerMainSetForExercise({ date: '2026-08-10', dayId: day.id, displayUnit: 'kg', exercise, reps: 5, rir: 1, routineId: routine.id, weightKg: 80 })
    await db.workoutSessions.update(completed.sessionId, { status: 'completed' })
    await expect(getPersonalRecords()).resolves.toEqual([expect.objectContaining({ canonicalName: 'press-record', date: '2026-08-10', weightKg: 80 })])
  })

  it('keeps session detail readable after routine and day rows are deleted', async () => {
    const routine = makeRoutine('routine-detail-deleted', 'Rutina histórica')
    const day = makeDay('day-detail-deleted', routine.id, 'Día histórico')
    const exercise = makeExercise('exercise-detail-deleted', routine.id, day.id, 'Press antiguo', 'press-antiguo')
    await db.routines.put(routine)
    await db.routineDays.put(day)
    await db.routineExercises.put(exercise)
    const registered = await registerMainSetForExercise({ date: '2026-08-17', dayId: day.id, displayUnit: 'kg', exercise, reps: 10, rir: 2, routineId: routine.id, weightKg: 50 })
    await db.routines.delete(routine.id)
    await db.routineDays.delete(day.id)

    await expect(getSessionDetail(registered.sessionId)).resolves.toMatchObject({
      id: registered.sessionId,
      routineName: 'Rutina histórica',
      dayName: 'Día histórico',
      exercises: [expect.objectContaining({ exerciseName: 'Press antiguo' })],
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
