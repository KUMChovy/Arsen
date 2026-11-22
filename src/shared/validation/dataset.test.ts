import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { ensureDemoData } from '../../db/seedDemoRoutine'
import { datasetSchema } from './dataset'

describe('dataset validation', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open(); await ensureDemoData() })
  afterEach(() => db.close())

  async function tables() {
    return {
      settings: await db.settings.toArray(), deloadCycles: await db.deloadCycles.toArray(), routines: await db.routines.toArray(),
      routineDays: await db.routineDays.toArray(), routineExercises: await db.routineExercises.toArray(), exerciseCatalog: await db.exerciseCatalog.toArray(),
      exerciseAssets: await db.exerciseAssets.toArray(), weeklyVolumeTargets: await db.weeklyVolumeTargets.toArray(), workoutSessions: await db.workoutSessions.toArray(),
      exerciseLogs: await db.exerciseLogs.toArray(), setLogs: await db.setLogs.toArray(), dropSetLogs: await db.dropSetLogs.toArray(), skipLogs: await db.skipLogs.toArray(),
    }
  }

  it('accepts a complete new dataset and rejects a missing routine relationship', async () => {
    const data = await tables()
    expect(datasetSchema.safeParse(data).success).toBe(true)
    data.routineDays[0]!.routineId = 'missing'
    expect(datasetSchema.safeParse(data).success).toBe(false)
  })

  it('rejects duplicate identifiers and orphan series', async () => {
    const data = await tables()
    data.routines.push(data.routines[0]!)
    expect(datasetSchema.safeParse(data).success).toBe(false)
    data.routines.pop()
    data.setLogs.push({ id: 'set', exerciseLogId: 'missing', kind: 'main', order: 0, weightKg: 10, reps: 5, rir: 1, displayUnit: 'kg', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' })
    expect(datasetSchema.safeParse(data).success).toBe(false)
  })

  it('rejects conflicting active routine settings', async () => {
    const data = await tables()
    data.settings[0]!.activeRoutineId = null
    expect(datasetSchema.safeParse(data).success).toBe(false)
  })

  it('preserves completed history whose routine and exercise were removed', async () => {
    const data = await tables()
    const exercise = data.routineExercises[0]!
    const now = '2026-08-01T00:00:00.000Z'
    data.workoutSessions.push({ id: 'old', routineId: 'deleted', dayId: 'deleted', routineName: 'Anterior', dayName: 'Día', date: '2026-08-01', notes: '', displayUnit: 'kg', status: 'completed', createdAt: now, updatedAt: now })
    data.exerciseLogs.push({ id: 'log', sessionId: 'old', routineExerciseId: 'deleted-exercise', state: 'done', notes: '', snapshot: { name: exercise.name, canonicalName: exercise.canonicalName, mainMuscle: exercise.mainMuscle, equipment: exercise.equipment, targetSets: exercise.targetSets, repsMin: exercise.repsMin, repsMax: exercise.repsMax, recommendedRir: exercise.recommendedRir, restSeconds: exercise.restSeconds }, createdAt: now, updatedAt: now })
    expect(datasetSchema.safeParse(data).success).toBe(true)
  })

  it('rejects a deload cycle that ends before it starts', async () => {
    const data = await tables()
    const now = '2026-08-01T00:00:00.000Z'
    data.deloadCycles.push({ id: 'cycle', status: 'completed', suggestedAt: null, scheduledStartDate: null, startedAt: '2026-08-02', completedAt: '2026-08-01', skippedAt: null, createdAt: now, updatedAt: now })
    expect(datasetSchema.safeParse(data).success).toBe(false)
  })

  it('rejects two different days with the same order in one routine', async () => {
    const data = await tables()
    data.routineDays[1]!.order = data.routineDays[0]!.order
    expect(datasetSchema.safeParse(data).success).toBe(false)
  })

  it('rejects a session whose health summary refers to an exercise from another session', async () => {
    const data = await tables()
    const exercise = data.routineExercises[0]!
    const now = '2026-08-01T00:00:00.000Z'
    const metrics = { activeCaloriesKcal: null, heartRateAvgBpm: null, heartRateMaxBpm: null, heartRateMinBpm: null, oxygenSaturationAvgPercent: null, steps: null }
    const window = { rangeStart: now, rangeEnd: now, metrics }
    const base = { routineId: exercise.routineId, dayId: exercise.dayId, notes: '', displayUnit: 'kg' as const, status: 'completed' as const, createdAt: now, updatedAt: now }
    data.workoutSessions.push({ ...base, id: 'first', date: '2026-08-01', health: { syncedAt: now, day: window, exercises: [{ ...window, canonicalName: 'press', exerciseLogId: 'log', exerciseName: 'Press', routineExerciseId: exercise.id, setCount: 1 }] } })
    data.workoutSessions.push({ ...base, id: 'second', date: '2026-08-02' })
    data.exerciseLogs.push({ id: 'log', sessionId: 'second', routineExerciseId: exercise.id, state: 'done', notes: '', snapshot: { name: exercise.name, canonicalName: exercise.canonicalName, mainMuscle: exercise.mainMuscle, equipment: exercise.equipment, targetSets: exercise.targetSets, repsMin: exercise.repsMin, repsMax: exercise.repsMax, recommendedRir: exercise.recommendedRir, restSeconds: exercise.restSeconds }, createdAt: now, updatedAt: now })
    expect(datasetSchema.safeParse(data).success).toBe(false)
  })
})
