import { describe, expect, it } from 'vitest'
import { backupSchema, routineExportSchema } from './arsenImportSchemas'

const routine = {
  createdAt: '2026-01-01T00:00:00.000Z',
  id: 'routine-1',
  isActive: true,
  name: 'Rutina',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const day = {
  createdAt: '2026-01-01T00:00:00.000Z',
  description: 'Upper',
  id: 'day-1',
  name: 'Dia 1',
  order: 0,
  routineId: 'routine-1',
  updatedAt: '2026-01-01T00:00:00.000Z',
  weekday: 1,
}

const exercise = {
  canonicalName: 'press-inclinado',
  createdAt: '2026-01-01T00:00:00.000Z',
  currentWeightKg: 80,
  dayId: 'day-1',
  equipment: 'Barra',
  id: 'exercise-1',
  mainMuscle: 'Pecho',
  name: 'Press inclinado',
  order: 0,
  progression: '',
  recommendedRir: '1-2',
  repRange: '8-10',
  rest: '120 seg',
  restSeconds: 120,
  routineId: 'routine-1',
  sourceExerciseId: null,
  targetSets: 4,
  technicalNotes: '',
  updatedAt: '2026-01-01T00:00:00.000Z',
  warmupProtocol: '',
  warmupSets: 2,
}

describe('Arsen import schemas', () => {
  it('accepts a routine export with expected tables', () => {
    expect(
      routineExportSchema.safeParse({
        days: [day],
        exercises: [exercise],
        exportedAt: '2026-01-01T00:00:00.000Z',
        routine,
        schemaVersion: 1,
        weeklyVolumeTargets: [],
      }).success,
    ).toBe(true)
  })

  it('rejects malformed routine exports', () => {
    expect(
      routineExportSchema.safeParse({
        days: [{ ...day, weekday: 9 }],
        exercises: [exercise],
        routine,
      }).success,
    ).toBe(false)
  })

  it('accepts a backup with optional empty tables', () => {
    expect(
      backupSchema.safeParse({
        exportedAt: '2026-01-01T00:00:00.000Z',
        schemaVersion: 1,
        tables: {
          routineDays: [day],
          routineExercises: [exercise],
          routines: [routine],
        },
      }).success,
    ).toBe(true)
  })
})
