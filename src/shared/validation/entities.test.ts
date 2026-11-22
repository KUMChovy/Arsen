import { describe, expect, it } from 'vitest'
import { routineEntitySchema, routineExerciseEntitySchema, sessionEntitySchema, settingsEntitySchema } from './entities'

const now = '2026-08-01T00:00:00.000Z'

describe('persisted entity validation', () => {
  it('rejects invalid timestamps and empty identifiers on routines', () => {
    expect(routineEntitySchema.safeParse({ id: '', name: 'Rutina', isActive: true, createdAt: now, updatedAt: now }).success).toBe(false)
    expect(routineEntitySchema.safeParse({ id: 'routine', name: 'Rutina', isActive: true, createdAt: 'bad', updatedAt: now }).success).toBe(false)
  })

  it('rejects impossible exercise recipes and non-finite values', () => {
    const exercise = { id: 'exercise', routineId: 'routine', dayId: 'day', sourceExerciseId: null, assetKind: null, bundledAssetId: null, customAssetId: null, name: 'Press', canonicalName: 'press', mainMuscle: 'Pecho', equipment: 'Barra', loadMode: 'single', barWeightKg: 20, targetSets: 3, repsMin: 8, repsMax: 10, recommendedRir: 1, rest: '90 seg', restSeconds: 90, warmupSets: 0, warmupProtocol: 'none', technicalNotes: '', currentWeightKg: 20, order: 0, createdAt: now, updatedAt: now }
    expect(routineExerciseEntitySchema.safeParse(exercise).success).toBe(true)
    expect(routineExerciseEntitySchema.safeParse({ ...exercise, currentWeightKg: Infinity }).success).toBe(false)
    expect(routineExerciseEntitySchema.safeParse({ ...exercise, repsMin: 12, repsMax: 8 }).success).toBe(false)
    expect(routineExerciseEntitySchema.safeParse({ ...exercise, targetSets: -1 }).success).toBe(false)
  })

  it('rejects malformed session dates and unknown states', () => {
    const session = { id: 'session', routineId: 'routine', dayId: 'day', date: '2026-08-01', notes: '', displayUnit: 'kg', status: 'draft', createdAt: now, updatedAt: now }
    expect(sessionEntitySchema.safeParse(session).success).toBe(true)
    expect(sessionEntitySchema.safeParse({ ...session, date: '2026-02-30' }).success).toBe(false)
    expect(sessionEntitySchema.safeParse({ ...session, status: 'unknown' }).success).toBe(false)
  })

  it('rejects deload percentages outside the product ranges', () => {
    const settings = { id: 'app', schemaVersion: 7, activeRoutineId: null, preferredUnit: 'kg', deloadNotifications: true, storagePersisted: null, createdAt: now, updatedAt: now }
    expect(settingsEntitySchema.safeParse({ ...settings, deloadSeriesReductionPercent: 39 }).success).toBe(false)
    expect(settingsEntitySchema.safeParse({ ...settings, deloadWeightReductionPercent: 91 }).success).toBe(false)
    expect(settingsEntitySchema.safeParse({ ...settings, deloadSeriesReductionPercent: 50, deloadWeightReductionPercent: 80 }).success).toBe(true)
  })
})
