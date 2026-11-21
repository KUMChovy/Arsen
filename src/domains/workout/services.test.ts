import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import type { RoutineExercise } from '../routine/types'
import { addDropSet, completeSessionForDay, deleteMainSet, deleteHistoricalExercise, duplicateSessionAsDraft, ensureExerciseLog, registerMainSetForExercise, registerWarmupForExercise, skipRoutineExerciseForDay, updateDropSet, updateExerciseNotesForDay, updateHistoricalSession, updateHistoricalSet, updateSessionExercisePlan, updateSetWithDrops } from './services'

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

  it('does not persist any part of a set when its drop set is invalid', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)

    await expect(registerMainSetForExercise({
      date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise,
      reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 70,
      dropSet: { reps: 0, rir: 1, weightKg: 40 },
    })).rejects.toThrow()

    expect(await db.setLogs.count()).toBe(0)
    expect(await db.workoutSessions.count()).toBe(0)
    expect(await db.exerciseLogs.count()).toBe(0)
    expect((await db.routineExercises.get(exercise.id))?.currentWeightKg).toBe(60)
  })

  it('rejects a negative RIR in a drop set without saving the main set', async () => {
    const exercise = routineExercise()
    await expect(registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60, dropSet: { reps: 5, rir: -1, weightKg: 40 } })).rejects.toThrow()
    expect(await db.setLogs.count()).toBe(0)
  })

  it('clears the skip record when a skipped exercise receives a main set', async () => {
    const exercise = routineExercise()
    const common = { date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg' as const, exercise, routineId: exercise.routineId }
    await skipRoutineExerciseForDay(common)
    const registered = await registerMainSetForExercise({ ...common, reps: 8, rir: 1, weightKg: 60 })
    expect(await db.skipLogs.where('sessionId').equals(registered.sessionId).count()).toBe(0)
    expect((await db.exerciseLogs.get(registered.exerciseLogId))?.state).toBe('in_progress')
  })

  it('does not create duplicate skip records for repeated omission', async () => {
    const exercise = routineExercise()
    const common = { date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg' as const, exercise, routineId: exercise.routineId }
    const sessionId = await skipRoutineExerciseForDay(common)
    await skipRoutineExerciseForDay(common)
    expect(await db.skipLogs.where('sessionId').equals(sessionId).count()).toBe(1)
  })

  it('persists exercise notes without changing the routine instructions', async () => {
    const exercise = routineExercise({ technicalNotes: 'Controla el descenso' })
    await db.routineExercises.put(exercise)
    await updateExerciseNotesForDay({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, notes: 'Buena técnica', routineId: exercise.routineId })
    expect((await db.exerciseLogs.toArray())[0]?.notes).toBe('Buena técnica')
    expect((await db.routineExercises.get(exercise.id))?.technicalNotes).toBe('Controla el descenso')
  })

  it('records warmups without advancing the exercise or changing its reference weight', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)
    const result = await registerWarmupForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 10, rir: 3, routineId: exercise.routineId, weightKg: 30 })
    expect(await db.setLogs.get(result.setLogId)).toMatchObject({ kind: 'warmup', reps: 10, weightKg: 30 })
    expect((await db.exerciseLogs.get(result.exerciseLogId))?.state).toBe('pending')
    expect((await db.routineExercises.get(exercise.id))?.currentWeightKg).toBe(60)
    expect((await db.workoutSessions.get(result.sessionId))?.startedAt).toBeNull()
  })

  it('preserves the skipped state when a warmup is corrected', async () => {
    const exercise = routineExercise()
    const common = { date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg' as const, exercise, routineId: exercise.routineId }
    const warmup = await registerWarmupForExercise({ ...common, reps: 10, rir: 3, weightKg: 30 })
    await skipRoutineExerciseForDay(common)
    await updateHistoricalSet({ setLogId: warmup.setLogId, reps: 8, rir: 3, weightKg: 30 })
    expect((await db.exerciseLogs.get(warmup.exerciseLogId))?.state).toBe('skipped')
  })

  it('keeps a manually completed session completed when a set is corrected', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)
    const result = await registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    await completeSessionForDay({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', routineId: exercise.routineId })
    await updateHistoricalSet({ setLogId: result.setLogId, reps: 9, rir: 1, weightKg: 60 })
    expect((await db.workoutSessions.get(result.sessionId))?.status).toBe('completed')
  })

  it('does not reopen a legacy completed session whose completion origin is unknown', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)
    const result = await registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    await db.workoutSessions.update(result.sessionId, { status: 'completed', completedAt: '2026-08-11T12:00:00.000Z' })
    await updateHistoricalSet({ setLogId: result.setLogId, reps: 9, rir: 1, weightKg: 60 })
    expect((await db.workoutSessions.get(result.sessionId))?.status).toBe('completed')
  })

  it('stores a reordered session plan without changing the routine', async () => {
    const first = routineExercise()
    const second = routineExercise({ id: 'exercise-2', order: 1, name: 'Remo' })
    await db.routineExercises.bulkPut([first, second])
    const sessionId = await updateSessionExercisePlan({ date: '2026-08-11', dayId: first.dayId, displayUnit: 'kg', exercises: [second, first], routineId: first.routineId })
    expect((await db.workoutSessions.get(sessionId))?.sessionExercises?.map((exercise) => exercise.id)).toEqual(['exercise-2', 'exercise-1'])
    expect((await db.routineExercises.orderBy('[dayId+order]').toArray()).map((exercise) => exercise.id)).toEqual(['exercise-1', 'exercise-2'])
  })

  it('records an occasional exercise without creating or changing a routine exercise', async () => {
    const original = routineExercise()
    const extra = routineExercise({ id: 'session-extra', name: 'Remo', canonicalName: 'remo' })
    await db.routineExercises.put(original)
    const common = { date: '2026-08-11', dayId: original.dayId, displayUnit: 'kg' as const, routineId: original.routineId }
    await updateSessionExercisePlan({ ...common, exercises: [original, extra] })
    const result = await registerMainSetForExercise({ ...common, exercise: extra, reps: 10, rir: 2, weightKg: 30 })
    expect(await db.routineExercises.count()).toBe(1)
    expect((await db.routineExercises.get(original.id))?.currentWeightKg).toBe(60)
    expect((await db.exerciseLogs.get(result.exerciseLogId))?.snapshot.name).toBe('Remo')
  })

  it('uses the session plan when deciding whether all exercises are completed', async () => {
    const first = routineExercise({ targetSets: 1 })
    const omittedFromPlan = routineExercise({ id: 'exercise-2', order: 1 })
    await db.routineExercises.bulkPut([first, omittedFromPlan])
    const sessionId = await updateSessionExercisePlan({ date: '2026-08-11', dayId: first.dayId, displayUnit: 'kg', exercises: [first], routineId: first.routineId })
    await registerMainSetForExercise({ date: '2026-08-11', dayId: first.dayId, displayUnit: 'kg', exercise: first, reps: 8, rir: 1, routineId: first.routineId, weightKg: 60 })
    expect((await db.workoutSessions.get(sessionId))?.status).toBe('completed')
  })

  it('allows adding a session exercise after automatic completion without changing a manual completion', async () => {
    const first = routineExercise({ targetSets: 1 })
    const extra = routineExercise({ id: 'session-exercise-2', name: 'Remo' })
    await db.routineExercises.put(first)
    const result = await registerMainSetForExercise({ date: '2026-08-11', dayId: first.dayId, displayUnit: 'kg', exercise: first, reps: 8, rir: 1, routineId: first.routineId, weightKg: 60 })
    expect((await db.workoutSessions.get(result.sessionId))?.status).toBe('completed')
    await updateSessionExercisePlan({ date: '2026-08-11', dayId: first.dayId, displayUnit: 'kg', exercises: [first, extra], routineId: first.routineId })
    expect((await db.workoutSessions.get(result.sessionId))?.status).toBe('draft')
    await completeSessionForDay({ date: '2026-08-11', dayId: first.dayId, displayUnit: 'kg', routineId: first.routineId })
    await expect(updateSessionExercisePlan({ date: '2026-08-11', dayId: first.dayId, displayUnit: 'kg', exercises: [first], routineId: first.routineId })).rejects.toThrow()
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

  it('rejects an invalid drop set edit without changing its stored values', async () => {
    const exercise = routineExercise()
    const registered = await registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    const dropId = await addDropSet({ displayUnit: 'kg', setLogId: registered.setLogId, reps: 5, rir: 1, weightKg: 40 })
    await expect(updateDropSet(dropId, { reps: 5, rir: -1, weightKg: 40 })).rejects.toThrow()
    expect((await db.dropSetLogs.get(dropId))?.rir).toBe(1)
  })

  it('rejects invalid historical set values without changing the record', async () => {
    const exercise = routineExercise()
    const registered = await registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    await expect(updateHistoricalSet({ setLogId: registered.setLogId, reps: 8, rir: -1, weightKg: 60 })).rejects.toThrow()
    expect((await db.setLogs.get(registered.setLogId))?.rir).toBe(1)
  })

  it('keeps all previous set data if a drop edit is invalid', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)
    const registered = await registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    await expect(updateSetWithDrops(registered.setLogId, { main: { reps: 9, rir: 1, weightKg: 65 }, deletedDropSetIds: [], drops: [{ id: null, reps: 0, rir: 1, weightKg: 40 }] })).rejects.toThrow()
    expect(await db.setLogs.get(registered.setLogId)).toMatchObject({ reps: 8, weightKg: 60 })
    expect(await db.dropSetLogs.count()).toBe(0)
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
