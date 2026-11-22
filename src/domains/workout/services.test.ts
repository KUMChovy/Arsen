import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import type { RoutineExercise } from '../routine/types'
import { addDropSet, applySessionTargetsToRoutine, applySessionWeightsToRoutine, completeSessionForDay, deleteMainSet, deleteHistoricalExercise, deleteWorkoutSession, duplicateSessionAsDraft, ensureExerciseLog, getOrCreateSessionForDay, getSessionTargetProposals, getSessionWeightProposals, registerMainSetForExercise, registerWarmupForExercise, saveMainSet, skipExercise, skipRoutineExerciseForDay, updateDropSet, updateExerciseNotesForDay, updateHistoricalSession, updateHistoricalSet, updateSessionExercisePlan, updateSetWithDrops } from './services'

async function resetDb() {
  db.close()
  await db.delete()
  await db.open()
}

describe('workout services snapshots', () => {
  beforeEach(async () => {
    await resetDb()
    const now = '2026-08-11T00:00:00.000Z'
    await db.routines.put({ id: 'routine-1', name: 'Rutina', isActive: true, createdAt: now, updatedAt: now })
    await db.routineDays.put({ id: 'day-1', routineId: 'routine-1', name: 'Día', description: '', weekday: null, order: 0, createdAt: now, updatedAt: now })
  })

  afterEach(async () => {
    vi.useRealTimers()
    db.close()
    await db.delete()
  })

  it('reuses one session when the same day is opened concurrently', async () => {
    const input = { date: '2026-08-11', dayId: 'day-1', displayUnit: 'kg' as const, routineId: 'routine-1' }
    const ids = await Promise.all([getOrCreateSessionForDay(input), getOrCreateSessionForDay(input)])
    expect(ids[0]).toBe(ids[1])
    expect(await db.workoutSessions.count()).toBe(1)
  })

  it('rejects an invalid calendar date before creating a session', async () => {
    await expect(getOrCreateSessionForDay({ date: '2026-02-30', dayId: 'day-1', displayUnit: 'kg', routineId: 'routine-1' })).rejects.toThrow()
    expect(await db.workoutSessions.count()).toBe(0)
  })

  it('rejects an invalid display unit before creating a session', async () => {
    await expect(getOrCreateSessionForDay({ date: '2026-08-11', dayId: 'day-1', displayUnit: 'oz' as 'kg', routineId: 'routine-1' })).rejects.toThrow()
    expect(await db.workoutSessions.count()).toBe(0)
  })

  it('does not create a session for a missing routine and day', async () => {
    await expect(getOrCreateSessionForDay({ date: '2026-08-11', dayId: 'missing-day', displayUnit: 'kg', routineId: 'missing-routine' })).rejects.toThrow()
    expect(await db.workoutSessions.count()).toBe(0)
  })

  it('rejects a main set whose exercise log does not exist', async () => {
    await expect(saveMainSet({ exerciseLogId: 'missing', weightKg: 20, reps: 8, rir: 1, displayUnit: 'kg' })).rejects.toThrow()
    expect(await db.setLogs.count()).toBe(0)
  })

  it('rejects an exercise log when its session is missing', async () => {
    await expect(ensureExerciseLog('missing', routineExercise())).rejects.toThrow()
    expect(await db.exerciseLogs.count()).toBe(0)
  })

  it('does not create an omission for a missing session', async () => {
    await expect(skipExercise('missing', 'exercise')).rejects.toThrow()
    expect(await db.skipLogs.count()).toBe(0)
  })

  it('does not omit an exercise absent from the session', async () => {
    const sessionId = await getOrCreateSessionForDay({ date: '2026-08-11', dayId: 'day-1', displayUnit: 'kg', routineId: 'routine-1' })
    await expect(skipExercise(sessionId, 'missing')).rejects.toThrow()
    expect(await db.skipLogs.count()).toBe(0)
  })

  it('rolls back the session and exercise log if saving an omission fails', async () => {
    const exercise = routineExercise()
    const spy = vi.spyOn(db.skipLogs, 'add').mockRejectedValueOnce(new Error('falló el almacenamiento'))
    try {
      await expect(skipRoutineExerciseForDay({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', routineId: exercise.routineId, exercise })).rejects.toThrow()
      expect(await db.workoutSessions.count()).toBe(0)
      expect(await db.exerciseLogs.count()).toBe(0)
    } finally {
      spy.mockRestore()
    }
  })

  it('rejects an invalid main set without changing existing sets', async () => {
    const exercise = routineExercise()
    const created = await registerMainSetForExercise({ date: '2026-08-10', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    await expect(saveMainSet({ exerciseLogId: created.exerciseLogId, weightKg: -1, reps: 8, rir: 1, displayUnit: 'kg' })).rejects.toThrow()
    expect(await db.setLogs.count()).toBe(1)
  })

  it('appends a main set after an order gap', async () => {
    const exercise = routineExercise()
    const created = await registerMainSetForExercise({ date: '2026-08-10', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    await db.setLogs.update(created.setLogId, { order: 3 })
    const next = await saveMainSet({ exerciseLogId: created.exerciseLogId, weightKg: 20, reps: 8, rir: 1, displayUnit: 'kg' })
    expect(next.order).toBe(4)
  })

  it('assigns distinct orders to concurrent drop sets', async () => {
    const exercise = routineExercise()
    const created = await registerMainSetForExercise({ date: '2026-08-10', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    const input = { setLogId: created.setLogId, weightKg: 20, reps: 8, rir: 1, displayUnit: 'kg' as const }
    await Promise.all([addDropSet(input), addDropSet(input)])
    expect((await db.dropSetLogs.toArray()).map((drop) => drop.order).sort()).toEqual([0, 1])
  })

  it('rejects a drop set with an invalid display unit', async () => {
    const exercise = routineExercise()
    const created = await registerMainSetForExercise({ date: '2026-08-10', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    await expect(addDropSet({ setLogId: created.setLogId, weightKg: 20, reps: 8, rir: 1, displayUnit: 'oz' as 'kg' })).rejects.toThrow()
    expect(await db.dropSetLogs.count()).toBe(0)
  })

  it('does not copy health data to a duplicated session on a different date', async () => {
    const exercise = routineExercise()
    const source = await registerMainSetForExercise({ date: '2026-08-10', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    const now = '2026-08-10T20:00:00.000Z'
    const health = { syncedAt: now, day: { rangeStart: now, rangeEnd: now, metrics: { activeCaloriesKcal: null, heartRateAvgBpm: null, heartRateMaxBpm: null, heartRateMinBpm: null, oxygenSaturationAvgPercent: null, steps: 100 } } }
    await db.workoutSessions.update(source.sessionId, { health, healthHistory: [{ ...health, sourceDate: '2026-08-09' }] })
    const duplicate = await duplicateSessionAsDraft({ sourceSessionId: source.sessionId, targetDate: '2026-08-11' })
    expect((await db.workoutSessions.get(duplicate.sessionId))?.health).toBeUndefined()
    expect((await db.workoutSessions.get(duplicate.sessionId))?.healthHistory).toBeUndefined()
    expect((await db.workoutSessions.get(source.sessionId))?.health?.day.metrics.steps).toBe(100)
  })

  it('allows only one concurrent duplication into the same date and day', async () => {
    const exercise = routineExercise()
    const source = await registerMainSetForExercise({ date: '2026-08-10', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    const results = await Promise.allSettled([
      duplicateSessionAsDraft({ sourceSessionId: source.sessionId, targetDate: '2026-08-11' }),
      duplicateSessionAsDraft({ sourceSessionId: source.sessionId, targetDate: '2026-08-11' }),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await db.workoutSessions.where('[date+dayId]').equals(['2026-08-11', exercise.dayId]).count()).toBe(1)
  })

  it('rejects duplicating a session to an invalid calendar date', async () => {
    const exercise = routineExercise()
    const source = await registerMainSetForExercise({ date: '2026-08-10', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    await expect(duplicateSessionAsDraft({ sourceSessionId: source.sessionId, targetDate: '2026-02-30' })).rejects.toThrow()
    expect(await db.workoutSessions.count()).toBe(1)
  })

  it('captures the planned exercises and context without changing the planned weight when recording a set', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)
    await db.routines.put({ id: exercise.routineId, name: 'Original', isActive: true, createdAt: exercise.createdAt, updatedAt: exercise.updatedAt })
    await db.routineDays.put({ id: exercise.dayId, routineId: exercise.routineId, name: 'Día original', description: '', weekday: null, order: 0, createdAt: exercise.createdAt, updatedAt: exercise.updatedAt })
    const result = await registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 70 })
    await db.routineExercises.update(exercise.id, { targetSets: 9 })
    expect(await db.workoutSessions.get(result.sessionId)).toMatchObject({ routineName: 'Original', dayName: 'Día original', sessionExercises: [{ id: exercise.id, targetSets: 3 }] })
    expect((await db.routineExercises.get(exercise.id))?.currentWeightKg).toBe(60)
  })

  it('applies only confirmed weight proposals and refuses stale proposals', async () => {
    const first = routineExercise()
    const second = routineExercise({ id: 'exercise-2', name: 'Remo', order: 1, currentWeightKg: 30 })
    await db.routineExercises.bulkPut([first, second])
    const common = { date: '2026-08-11', dayId: first.dayId, displayUnit: 'kg' as const, routineId: first.routineId }
    const result = await registerMainSetForExercise({ ...common, exercise: first, reps: 8, rir: 1, weightKg: 70 })
    await registerMainSetForExercise({ ...common, exercise: second, reps: 8, rir: 1, weightKg: 40 })
    await completeSessionForDay(common)
    const proposals = await getSessionWeightProposals(result.sessionId)
    expect(proposals).toHaveLength(2)
    const firstProposal = proposals.find((proposal) => proposal.exerciseId === first.id)!
    await applySessionWeightsToRoutine(result.sessionId, [firstProposal])
    expect((await db.routineExercises.get(first.id))?.currentWeightKg).toBe(70)
    expect((await db.routineExercises.get(second.id))?.currentWeightKg).toBe(30)
    await expect(applySessionWeightsToRoutine(result.sessionId, [firstProposal])).rejects.toThrow()
  })

  it('offers completed main sets and rep ranges independently and applies only the selected target', async () => {
    const exercise = routineExercise({ targetSets: 3, repsMin: 8, repsMax: 10 })
    await db.routineExercises.put(exercise)
    const common = { date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg' as const, routineId: exercise.routineId }
    const result = await registerMainSetForExercise({ ...common, exercise, reps: 6, rir: 1, weightKg: 60 })
    await registerMainSetForExercise({ ...common, exercise, reps: 7, rir: 1, weightKg: 60 })
    await completeSessionForDay(common)
    const proposals = await getSessionTargetProposals(result.sessionId)
    expect(proposals).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: 'sets', previous: '3', proposed: '2' }),
      expect.objectContaining({ field: 'reps', previous: '8–10', proposed: '6–7' }),
    ]))
    const reps = proposals.find((proposal) => proposal.field === 'reps')!
    await applySessionTargetsToRoutine(result.sessionId, [reps])
    expect(await db.routineExercises.get(exercise.id)).toMatchObject({ targetSets: 3, repsMin: 6, repsMax: 7 })
    await expect(applySessionTargetsToRoutine(result.sessionId, [reps])).rejects.toThrow()
  })

  it('does not propose invalid targets from imported sets with invalid repetitions', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)
    const common = { date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg' as const, routineId: exercise.routineId }
    const result = await registerMainSetForExercise({ ...common, exercise, reps: 8, rir: 1, weightKg: 60 })
    await db.setLogs.update(result.setLogId, { reps: 0 })
    await completeSessionForDay(common)
    expect(await getSessionTargetProposals(result.sessionId)).toEqual([])
  })

  it('rejects a session request for an existing day owned by another routine', async () => {
    const exercise = routineExercise()
    await registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    await expect(getOrCreateSessionForDay({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', routineId: 'otra' })).rejects.toThrow()
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

    const sessionId = await getOrCreateSessionForDay({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', routineId: exercise.routineId })
    const logId = await ensureExerciseLog(sessionId, exercise)

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

  it('rejects invalid dates when editing a historical session without changing it', async () => {
    const exercise = routineExercise()
    const sessionId = await getOrCreateSessionForDay({ date: '2026-08-10', dayId: exercise.dayId, displayUnit: 'kg', routineId: exercise.routineId })
    await expect(updateHistoricalSession(sessionId, { date: '2026-02-30', dayId: exercise.dayId, routineId: exercise.routineId })).rejects.toThrow()
    expect((await db.workoutSessions.get(sessionId))?.date).toBe('2026-08-10')
  })

  it('rejects an unknown status when editing a historical session', async () => {
    const exercise = routineExercise()
    const sessionId = await getOrCreateSessionForDay({ date: '2026-08-10', dayId: exercise.dayId, displayUnit: 'kg', routineId: exercise.routineId })
    await expect(updateHistoricalSession(sessionId, { date: '2026-08-10', dayId: exercise.dayId, routineId: exercise.routineId, status: 'unknown' as 'draft' })).rejects.toThrow()
    expect((await db.workoutSessions.get(sessionId))?.status).toBe('draft')
  })

  it('allows editing notes of a historical session after its routine and day were deleted', async () => {
    const exercise = routineExercise()
    const sessionId = await getOrCreateSessionForDay({ date: '2026-08-10', dayId: exercise.dayId, displayUnit: 'kg', routineId: exercise.routineId })
    await db.routineDays.delete(exercise.dayId)
    await db.routines.delete(exercise.routineId)
    await updateHistoricalSession(sessionId, { date: '2026-08-10', dayId: exercise.dayId, routineId: exercise.routineId, notes: 'Nota conservada' })
    expect(await db.workoutSessions.get(sessionId)).toMatchObject({ notes: 'Nota conservada', routineName: 'Rutina', dayName: 'Día' })
  })

  it('prevents concurrent edits from moving two sessions onto the same date and day', async () => {
    const exercise = routineExercise()
    const base = { dayId: exercise.dayId, displayUnit: 'kg' as const, routineId: exercise.routineId }
    const first = await getOrCreateSessionForDay({ ...base, date: '2026-08-10' })
    const second = await getOrCreateSessionForDay({ ...base, date: '2026-08-11' })
    const input = { date: '2026-08-12', dayId: exercise.dayId, routineId: exercise.routineId }
    const results = await Promise.allSettled([updateHistoricalSession(first, input), updateHistoricalSession(second, input)])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await db.workoutSessions.where('[date+dayId]').equals([input.date, input.dayId]).count()).toBe(1)
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

  it('rejects a negative order in a historical set edit', async () => {
    const exercise = routineExercise()
    const registered = await registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    await expect(updateHistoricalSet({ setLogId: registered.setLogId, order: -1, reps: 8, rir: 1, weightKg: 60 })).rejects.toThrow()
    expect((await db.setLogs.get(registered.setLogId))?.order).toBe(0)
  })

  it('rolls back a historical set edit if session state cannot be updated', async () => {
    const exercise = routineExercise({ targetSets: 1 })
    await db.routineExercises.put(exercise)
    const registered = await registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    await db.workoutSessions.update(registered.sessionId, { status: 'draft', manuallyCompleted: false })
    const spy = vi.spyOn(db.workoutSessions, 'update').mockRejectedValueOnce(new Error('falló la actualización'))
    try {
      await expect(updateHistoricalSet({ setLogId: registered.setLogId, reps: 10, rir: 1, weightKg: 70 })).rejects.toThrow()
      expect(await db.setLogs.get(registered.setLogId)).toMatchObject({ reps: 8, weightKg: 60 })
    } finally {
      spy.mockRestore()
    }
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

  it('rolls back a historical exercise deletion if updating the session fails', async () => {
    const exercise = routineExercise()
    const registered = await registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    const dropId = await addDropSet({ setLogId: registered.setLogId, weightKg: 30, reps: 5, rir: 1, displayUnit: 'kg' })
    const spy = vi.spyOn(db.workoutSessions, 'update').mockRejectedValueOnce(new Error('falló la actualización'))
    try {
      await expect(deleteHistoricalExercise(registered.exerciseLogId)).rejects.toThrow()
      expect(await db.exerciseLogs.get(registered.exerciseLogId)).toBeDefined()
      expect(await db.setLogs.get(registered.setLogId)).toBeDefined()
      expect(await db.dropSetLogs.get(dropId)).toBeDefined()
    } finally {
      spy.mockRestore()
    }
  })

  it('rolls back deleting a main set and its drops if the session update fails', async () => {
    const exercise = routineExercise()
    const registered = await registerMainSetForExercise({ date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg', exercise, reps: 8, rir: 1, routineId: exercise.routineId, weightKg: 60 })
    const dropId = await addDropSet({ setLogId: registered.setLogId, weightKg: 30, reps: 5, rir: 1, displayUnit: 'kg' })
    const spy = vi.spyOn(db.workoutSessions, 'update').mockRejectedValueOnce(new Error('falló la actualización'))
    try {
      await expect(deleteMainSet(registered.setLogId)).rejects.toThrow()
      expect(await db.setLogs.get(registered.setLogId)).toBeDefined()
      expect(await db.dropSetLogs.get(dropId)).toBeDefined()
    } finally {
      spy.mockRestore()
    }
  })

  it('does not leave orphan logs when a set is registered concurrently with session deletion', async () => {
    const exercise = routineExercise()
    const input = { date: '2026-08-11', dayId: exercise.dayId, displayUnit: 'kg' as const, routineId: exercise.routineId, reps: 8, rir: 1, weightKg: 60 }
    const first = await registerMainSetForExercise({ ...input, exercise })
    const extra = routineExercise({ id: 'extra' })
    const where = db.exerciseLogs.where.bind(db.exerciseLogs)
    let started = false
    let pendingWrite: Promise<unknown> | undefined
    const spy = vi.spyOn(db.exerciseLogs, 'where').mockImplementation(((index: string) => {
      const clause = where(index)
      if (index === 'sessionId' && !started) {
        const equals = clause.equals.bind(clause)
        clause.equals = ((value) => {
          const collection = equals(value)
          const original = collection.toArray.bind(collection)
          collection.toArray = (() => Dexie.Promise.resolve((async () => {
            const logs = await original()
            started = true
            pendingWrite = Dexie.ignoreTransaction(() => registerMainSetForExercise({ ...input, exercise: extra }))
            const race = Promise.race([pendingWrite, new Promise<void>((resolve) => setTimeout(resolve, 40))])
            await (Dexie.currentTransaction ? Dexie.waitFor(race) : race)
            return logs
          })())) as typeof collection.toArray
          return collection
        }) as typeof clause.equals
      }
      return clause
    }) as typeof db.exerciseLogs.where)
    try {
      await deleteWorkoutSession(first.sessionId)
      await pendingWrite
      const sessions = new Set((await db.workoutSessions.toArray()).map((session) => session.id))
      const logs = await db.exerciseLogs.toArray()
      const logIds = new Set(logs.map((log) => log.id))
      expect(logs.every((log) => sessions.has(log.sessionId))).toBe(true)
      expect((await db.setLogs.toArray()).every((set) => logIds.has(set.exerciseLogId))).toBe(true)
    } finally {
      spy.mockRestore()
    }
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
