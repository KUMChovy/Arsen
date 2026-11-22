import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from './schema'
import { ensureDemoData } from './seedDemoRoutine'
import { diagnoseIntegrity } from './integrity'
import { catalogEntitySchema, routineDayEntitySchema, routineEntitySchema, routineExerciseEntitySchema, settingsEntitySchema, volumeTargetEntitySchema } from '../shared/validation/entities'

describe('local integrity diagnosis', () => {
  beforeEach(async () => {
    db.close()
    await db.delete()
    await db.open()
    await ensureDemoData()
  })
  afterEach(() => db.close())

  it('accepts the freshly initialized dataset', async () => {
    expect(await diagnoseIntegrity()).toEqual([])
  })

  it('validates the persistent entities created by a new installation', async () => {
    for (const item of await db.settings.toArray()) expect(settingsEntitySchema.safeParse(item).success).toBe(true)
    for (const item of await db.routines.toArray()) expect(routineEntitySchema.safeParse(item).success).toBe(true)
    for (const item of await db.routineDays.toArray()) expect(routineDayEntitySchema.safeParse(item).success).toBe(true)
    for (const item of await db.routineExercises.toArray()) expect(routineExerciseEntitySchema.safeParse(item).success).toBe(true)
    for (const item of await db.exerciseCatalog.toArray()) expect(catalogEntitySchema.safeParse(item).success).toBe(true)
    for (const item of await db.weeklyVolumeTargets.toArray()) expect(volumeTargetEntitySchema.safeParse(item).success).toBe(true)
  })

  it('reports missing parents and invalid values without changing the database', async () => {
    const day = (await db.routineDays.toArray())[0]!
    await db.routineDays.update(day.id, { routineId: 'missing' })
    await db.setLogs.add({ id: 'orphan', exerciseLogId: 'missing', kind: 'main', order: 0, weightKg: -1, displayUnit: 'kg', reps: 5, rir: 1, createdAt: 'invalid', updatedAt: 'invalid' })
    const before = await db.setLogs.toArray()
    const issues = await diagnoseIntegrity()
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'routineDays', id: day.id, code: 'missing-routine', severity: 'error' }),
      expect.objectContaining({ entity: 'setLogs', id: 'orphan', code: 'missing-exercise-log', severity: 'error' }),
      expect.objectContaining({ entity: 'setLogs', id: 'orphan', code: 'invalid-value', severity: 'error' }),
    ]))
    expect(await db.setLogs.toArray()).toEqual(before)
  })

  it('does not label a completed session with snapshots as an orphan after its routine is deleted', async () => {
    const exercise = (await db.routineExercises.toArray())[0]!
    const now = '2026-08-01T00:00:00.000Z'
    await db.workoutSessions.add({ id: 'historic', routineId: 'deleted', dayId: 'deleted-day', routineName: 'Anterior', dayName: 'Día', date: '2026-08-01', notes: '', displayUnit: 'kg', status: 'completed', createdAt: now, updatedAt: now })
    const snapshot = { name: exercise.name, canonicalName: exercise.canonicalName, mainMuscle: exercise.mainMuscle, equipment: exercise.equipment, targetSets: exercise.targetSets, repsMin: exercise.repsMin, repsMax: exercise.repsMax, recommendedRir: exercise.recommendedRir, restSeconds: exercise.restSeconds }
    await db.exerciseLogs.add({ id: 'historic-log', sessionId: 'historic', routineExerciseId: 'deleted-exercise', state: 'done', notes: '', snapshot, createdAt: now, updatedAt: now })
    const issues = await diagnoseIntegrity()
    expect(issues.filter((issue) => issue.id === 'historic' || issue.id === 'historic-log')).toEqual([])
  })

  it('finds mismatched exercise ownership and missing asset references', async () => {
    const exercise = (await db.routineExercises.toArray())[0]!
    await db.routineExercises.update(exercise.id, { routineId: 'other', customAssetId: 'missing' })
    const issues = await diagnoseIntegrity()
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'routineExercises', id: exercise.id, code: 'invalid-day-routine' }),
      expect.objectContaining({ entity: 'routineExercises', id: exercise.id, code: 'missing-asset' }),
    ]))
  })

  it('reports an invalid catalog recipe without changing its value', async () => {
    const item = (await db.exerciseCatalog.toArray())[0]!
    await db.exerciseCatalog.update(item.id, { defaultTargetSets: -1 })
    expect(await diagnoseIntegrity()).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'exerciseCatalog', id: item.id, code: 'invalid-entity' }),
    ]))
    expect((await db.exerciseCatalog.get(item.id))?.defaultTargetSets).toBe(-1)
  })

  it('detects duplicate sessions and invalid session dates', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    const session = { routineId: 'routine-demo-current', dayId: 'day', date: '2026-02-30', notes: '', displayUnit: 'kg' as const, status: 'draft' as const, createdAt: now, updatedAt: now }
    await db.workoutSessions.bulkAdd([{ ...session, id: 'one' }, { ...session, id: 'two' }])
    const issues = await diagnoseIntegrity()
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'workoutSessions', id: 'one', code: 'invalid-date' }),
      expect.objectContaining({ entity: 'workoutSessions', id: 'two', code: 'duplicate-session' }),
    ]))
  })

  it('reports logs and drops with missing parents', async () => {
    const exercise = (await db.routineExercises.toArray())[0]!
    const now = '2026-08-01T00:00:00.000Z'
    await db.exerciseLogs.add({ id: 'log', sessionId: 'missing', routineExerciseId: exercise.id, state: 'done', notes: '', snapshot: exercise, createdAt: now, updatedAt: now })
    await db.dropSetLogs.add({ id: 'drop', setLogId: 'missing', order: 0, weightKg: 20, reps: 5, rir: 1, displayUnit: 'kg', createdAt: now, updatedAt: now })
    const issues = await diagnoseIntegrity()
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'exerciseLogs', id: 'log', code: 'missing-session' }),
      expect.objectContaining({ entity: 'dropSetLogs', id: 'drop', code: 'missing-set' }),
    ]))
  })

  it('detects incompatible drop sets, missing target routines and outdated settings', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    await db.settings.update('app', { schemaVersion: 1 })
    await db.weeklyVolumeTargets.add({ id: 'target', routineId: 'missing', muscle: 'Pecho', sets: 1, range: '', evaluation: '', comment: '' })
    await db.setLogs.add({ id: 'warmup', exerciseLogId: 'missing', kind: 'warmup', order: 0, weightKg: 20, reps: 5, rir: 1, displayUnit: 'kg', createdAt: now, updatedAt: now })
    await db.dropSetLogs.add({ id: 'drop', setLogId: 'warmup', order: 0, weightKg: 10, reps: 5, rir: 1, displayUnit: 'kg', createdAt: now, updatedAt: now })
    const issues = await diagnoseIntegrity()
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'settings', id: 'app', code: 'schema-version' }),
      expect.objectContaining({ entity: 'weeklyVolumeTargets', id: 'target', code: 'missing-routine' }),
      expect.objectContaining({ entity: 'dropSetLogs', id: 'drop', code: 'incompatible-set' }),
    ]))
  })

  it('reports health windows with reversed dates without discarding the summary', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    const health = { syncedAt: now, day: { rangeStart: '2026-08-02T00:00:00.000Z', rangeEnd: now, metrics: { activeCaloriesKcal: null, heartRateAvgBpm: null, heartRateMaxBpm: null, heartRateMinBpm: null, oxygenSaturationAvgPercent: null, steps: null } } }
    await db.workoutSessions.add({ id: 'health', routineId: 'deleted', dayId: 'deleted', routineName: 'Rutina', dayName: 'Día', date: '2026-08-01', notes: '', displayUnit: 'kg', status: 'completed', createdAt: now, updatedAt: now, health })
    expect(await diagnoseIntegrity()).toEqual(expect.arrayContaining([expect.objectContaining({ entity: 'workoutSessions', id: 'health', code: 'invalid-health' })]))
    expect((await db.workoutSessions.get('health'))?.health).toEqual(health)
  })

  it('reports health exercise summaries whose exercise logs belong to a different session', async () => {
    const exercise = (await db.routineExercises.toArray())[0]!
    const now = '2026-08-01T00:00:00.000Z'
    const metrics = { activeCaloriesKcal: null, heartRateAvgBpm: null, heartRateMaxBpm: null, heartRateMinBpm: null, oxygenSaturationAvgPercent: null, steps: null }
    const window = { rangeStart: now, rangeEnd: now, metrics }
    const session = { routineId: 'deleted', dayId: 'deleted', routineName: 'Rutina', dayName: 'Día', date: '2026-08-01', notes: '', displayUnit: 'kg' as const, status: 'completed' as const, createdAt: now, updatedAt: now }
    await db.workoutSessions.bulkAdd([
      { ...session, id: 'one', health: { syncedAt: now, day: window, exercises: [{ ...window, canonicalName: 'press', exerciseLogId: 'log', exerciseName: 'Press', routineExerciseId: exercise.id, setCount: 1 }] } },
      { ...session, id: 'two', date: '2026-08-02' },
    ])
    await db.exerciseLogs.add({ id: 'log', sessionId: 'two', routineExerciseId: exercise.id, state: 'done', notes: '', snapshot: exercise, createdAt: now, updatedAt: now })
    expect(await diagnoseIntegrity()).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'workoutSessions', id: 'one', code: 'invalid-health-reference' }),
    ]))
  })

  it('detects orphan skips, inconsistent deload state and invalid drop values', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    await db.skipLogs.add({ id: 'skip', sessionId: 'missing', routineExerciseId: 'deleted', reason: '', createdAt: now })
    await db.deloadCycles.add({ id: 'cycle', status: 'completed', suggestedAt: null, scheduledStartDate: null, startedAt: null, completedAt: null, skippedAt: null, createdAt: now, updatedAt: now })
    await db.dropSetLogs.add({ id: 'drop-invalid', setLogId: 'missing', order: 0, weightKg: -10, reps: 5, rir: 1, displayUnit: 'kg', createdAt: now, updatedAt: now })
    expect(await diagnoseIntegrity()).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'skipLogs', id: 'skip', code: 'missing-session' }),
      expect.objectContaining({ entity: 'deloadCycles', id: 'cycle', code: 'invalid-state' }),
      expect.objectContaining({ entity: 'dropSetLogs', id: 'drop-invalid', code: 'invalid-value' }),
    ]))
  })

  it('detects impossible and reversed deload dates', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    await db.deloadCycles.bulkAdd([
      { id: 'bad-date', status: 'scheduled', suggestedAt: null, scheduledStartDate: '2026-02-30', startedAt: null, completedAt: null, skippedAt: null, createdAt: now, updatedAt: now },
      { id: 'reversed', status: 'completed', suggestedAt: null, scheduledStartDate: null, startedAt: '2026-08-02', completedAt: '2026-08-01', skippedAt: null, createdAt: now, updatedAt: now },
    ])
    expect(await diagnoseIntegrity()).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'deloadCycles', id: 'bad-date', code: 'invalid-date' }),
      expect.objectContaining({ entity: 'deloadCycles', id: 'reversed', code: 'invalid-date-order' }),
    ]))
  })

  it('reports missing snapshots and mismatched live session relationships', async () => {
    const days = await db.routineDays.toArray()
    const now = '2026-08-01T00:00:00.000Z'
    const base = { date: '2026-08-01', notes: '', displayUnit: 'kg' as const, status: 'completed' as const, createdAt: now, updatedAt: now }
    await db.workoutSessions.bulkAdd([
      { ...base, id: 'missing-context', routineId: 'deleted', dayId: 'deleted' },
      { ...base, id: 'mismatch', routineId: 'different', dayId: days[0]!.id },
    ])
    expect(await diagnoseIntegrity()).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'workoutSessions', id: 'missing-context', code: 'missing-history-context', severity: 'warning' }),
      expect.objectContaining({ entity: 'workoutSessions', id: 'mismatch', code: 'invalid-day-routine', severity: 'error' }),
    ]))
  })

  it('finds missing custom images in catalog items and historical snapshots', async () => {
    const catalog = (await db.exerciseCatalog.toArray())[0]!
    const exercise = (await db.routineExercises.toArray())[0]!
    const now = '2026-08-01T00:00:00.000Z'
    await db.exerciseCatalog.update(catalog.id, { customAssetId: 'missing-catalog-image' })
    await db.workoutSessions.add({ id: 'session', routineId: 'deleted', dayId: 'deleted', routineName: 'Rutina', dayName: 'Día', date: '2026-08-01', notes: '', displayUnit: 'kg', status: 'completed', createdAt: now, updatedAt: now })
    await db.exerciseLogs.add({ id: 'log', sessionId: 'session', routineExerciseId: exercise.id, state: 'done', notes: '', snapshot: { ...exercise, customAssetId: 'missing-history-image' }, createdAt: now, updatedAt: now })
    expect(await diagnoseIntegrity()).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'exerciseCatalog', id: catalog.id, code: 'missing-asset' }),
      expect.objectContaining({ entity: 'exerciseLogs', id: 'log', code: 'missing-asset' }),
    ]))
  })

  it('reports an unused custom image without deleting it', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    await db.exerciseAssets.add({ id: 'unused', name: 'Imagen', mimeType: 'image/png', dataUrl: 'data:image/png;base64,AAAA', createdAt: now, updatedAt: now })
    expect(await diagnoseIntegrity()).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'exerciseAssets', id: 'unused', code: 'unreferenced-asset', severity: 'warning' }),
    ]))
    expect(await db.exerciseAssets.get('unused')).toBeDefined()
  })

  it('reports invalid timestamps and duplicate exercise logs without modifying them', async () => {
    const exercise = (await db.routineExercises.toArray())[0]!
    const now = '2026-08-01T00:00:00.000Z'
    await db.workoutSessions.add({ id: 'session', routineId: 'deleted', dayId: 'deleted', routineName: 'Rutina', dayName: 'Día', date: '2026-08-01', notes: '', displayUnit: 'kg', status: 'completed', createdAt: now, updatedAt: now })
    await db.exerciseLogs.bulkAdd([
      { id: 'log1', sessionId: 'session', routineExerciseId: exercise.id, state: 'done', notes: '', snapshot: exercise, createdAt: 'bad', updatedAt: now },
      { id: 'log2', sessionId: 'session', routineExerciseId: exercise.id, state: 'done', notes: '', snapshot: exercise, createdAt: now, updatedAt: now },
    ])
    expect(await diagnoseIntegrity()).toEqual(expect.arrayContaining([
      expect.objectContaining({ entity: 'exerciseLogs', id: 'log1', code: 'invalid-timestamp' }),
      expect.objectContaining({ entity: 'exerciseLogs', id: 'log2', code: 'duplicate-log' }),
    ]))
    expect(await db.exerciseLogs.count()).toBe(2)
  })
})
