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
  barWeightKg: 20,
  loadMode: 'split',
  mainMuscle: 'Pecho',
  name: 'Press inclinado',
  order: 0,
  progression: '',
  recommendedRir: 2,
  repsMax: 10,
  repsMin: 8,
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

  it('defaults legacy routine exercise fields during routine imports', () => {
    const result = routineExportSchema.safeParse({
      days: [day],
      exercises: [
        removeFields(exercise, [
          'barWeightKg',
          'currentWeightKg',
          'loadMode',
          'repsMax',
          'repsMin',
          'technicalNotes',
        ]),
      ],
      routine,
      weeklyVolumeTargets: [],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.exercises[0]).toMatchObject({
      barWeightKg: 20,
      currentWeightKg: 0,
      loadMode: 'split',
      repsMax: 10,
      repsMin: 8,
      technicalNotes: '',
    })
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

  it('rejects invalid rep ranges', () => {
    expect(
      routineExportSchema.safeParse({
        days: [day],
        exercises: [{ ...exercise, repsMax: 8, repsMin: 12 }],
        routine,
      }).success,
    ).toBe(false)

    expect(
      backupSchema.safeParse({
        tables: {
          exerciseCatalog: [
            {
              aliases: [],
              assetKind: null,
              canonicalName: 'press-inclinado',
              createdAt: '2026-01-01T00:00:00.000Z',
              defaultRecommendedRir: 2,
              defaultRepsMax: 8,
              defaultRepsMin: 12,
              defaultRestSeconds: 120,
              defaultTargetSets: 4,
              equipment: 'Barra',
              id: 'catalog-1',
              mainMuscle: 'Pecho',
              name: 'Press inclinado',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          ],
        },
      }).success,
    ).toBe(false)
  })

  it('rejects invalid RIR values', () => {
    expect(
      routineExportSchema.safeParse({
        days: [day],
        exercises: [{ ...exercise, recommendedRir: -1 }],
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

  it('defaults legacy backup routine and catalog fields', () => {
    const catalogItem = {
      aliases: [],
      assetKind: null,
      canonicalName: 'press-inclinado',
      createdAt: '2026-01-01T00:00:00.000Z',
      defaultRecommendedRir: 2,
      defaultRestSeconds: 120,
      defaultTargetSets: 4,
      equipment: 'Barra',
      id: 'catalog-1',
      mainMuscle: 'Pecho',
      name: 'Press inclinado',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const result = backupSchema.safeParse({
      tables: {
        exerciseCatalog: [catalogItem],
        routineExercises: [
          removeFields(exercise, [
            'barWeightKg',
            'currentWeightKg',
            'loadMode',
            'repsMax',
            'repsMin',
            'technicalNotes',
          ]),
        ],
      },
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.tables.routineExercises[0]).toMatchObject({
      assetKind: null,
      bundledAssetId: null,
      customAssetId: null,
    })
    expect(result.data.tables.routineExercises[0]).toMatchObject({
      barWeightKg: 20,
      currentWeightKg: 0,
      loadMode: 'split',
      repsMax: 10,
      repsMin: 8,
      technicalNotes: '',
    })
    expect(result.data.tables.exerciseCatalog[0]).toMatchObject({
      barWeightKg: 20,
      defaultRepsMax: 10,
      defaultRepsMin: 8,
      loadMode: 'split',
      origin: 'user',
      sinfulShellContentLocked: false,
      sinfulShellId: null,
      technicalNotes: '',
    })
  })

  it('preserves Sinful Shell catalog origin and lock fields', () => {
    const result = backupSchema.safeParse({
      tables: {
        exerciseCatalog: [
          {
            aliases: [],
            assetKind: null,
            bundledAssetId: 'press-inclinado--pecho',
            canonicalName: 'press-inclinado',
            createdAt: '2026-01-01T00:00:00.000Z',
            defaultRecommendedRir: 2,
            defaultRepsMax: 10,
            defaultRepsMin: 8,
            defaultRestSeconds: 120,
            defaultTargetSets: 4,
            equipment: 'Barra',
            id: 'catalog-sinful',
            mainMuscle: 'Pecho',
            name: 'Press inclinado',
            origin: 'sinful-shell',
            sinfulShellContentLocked: true,
            sinfulShellId: 'sinful-shell-press-inclinado',
            technicalNotes: 'Músculo principal: pectoral superior.',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.tables.exerciseCatalog[0]).toMatchObject({
      origin: 'sinful-shell',
      sinfulShellContentLocked: true,
      sinfulShellId: 'sinful-shell-press-inclinado',
    })
  })

  it('accepts visual asset fields and custom exercise assets', () => {
    const result = backupSchema.safeParse({
      tables: {
        exerciseAssets: [
          {
            createdAt: '2026-01-01T00:00:00.000Z',
            dataUrl: 'data:image/png;base64,AAAA',
            id: 'asset-1',
            mimeType: 'image/png',
            name: 'press.png',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        exerciseCatalog: [
          {
            aliases: [],
            assetKind: 'row',
            bundledAssetId: 'remo-con-barra--espalda',
            canonicalName: 'remo-barra',
            createdAt: '2026-01-01T00:00:00.000Z',
            customAssetId: 'asset-1',
            defaultRecommendedRir: 2,
            defaultRepsMax: 10,
            defaultRepsMin: 8,
            defaultRestSeconds: 120,
            defaultTargetSets: 4,
            equipment: 'Barra',
            id: 'catalog-1',
            mainMuscle: 'Espalda',
            name: 'Remo barra',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        routineExercises: [
          {
            ...exercise,
            assetKind: 'row',
            bundledAssetId: 'remo-con-barra--espalda',
            customAssetId: 'asset-1',
          },
        ],
        exerciseLogs: [
          {
            createdAt: '2026-01-01T00:00:00.000Z',
            id: 'exercise-log-1',
            notes: '',
            routineExerciseId: 'exercise-1',
            sessionId: 'session-1',
            snapshot: {
              assetKind: 'row',
              bundledAssetId: 'remo-con-barra--espalda',
              canonicalName: 'remo-barra',
              customAssetId: 'asset-1',
              equipment: 'Barra',
              mainMuscle: 'Espalda',
              name: 'Remo barra',
              recommendedRir: 2,
              restSeconds: 120,
              targetSets: 4,
            },
            state: 'done',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    })

    expect(result.success).toBe(true)
  })

  it('accepts legacy exercise log snapshots without rep ranges', () => {
    const result = backupSchema.safeParse({
      tables: {
        exerciseLogs: [
          {
            createdAt: '2026-01-01T00:00:00.000Z',
            id: 'exercise-log-1',
            notes: '',
            routineExerciseId: 'exercise-1',
            sessionId: 'session-1',
            snapshot: {
              canonicalName: 'press-inclinado',
              equipment: 'Barra',
              mainMuscle: 'Pecho',
              name: 'Press inclinado',
              recommendedRir: 2,
              restSeconds: 120,
              targetSets: 4,
            },
            state: 'done',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.tables.exerciseLogs[0]?.snapshot).toMatchObject({
      assetKind: null,
      bundledAssetId: null,
      customAssetId: null,
      repsMax: 10,
      repsMin: 8,
    })
  })

  it('preserves catalog indication notes and defaults old backups to empty notes', () => {
    const catalogItem = {
      aliases: [],
      assetKind: null,
      canonicalName: 'press-inclinado',
      createdAt: '2026-01-01T00:00:00.000Z',
      defaultRecommendedRir: 2,
      defaultRepsMax: 10,
      defaultRepsMin: 8,
      defaultRestSeconds: 120,
      defaultTargetSets: 4,
      equipment: 'Barra',
      id: 'catalog-1',
      mainMuscle: 'Pecho',
      name: 'Press inclinado',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const result = backupSchema.safeParse({
      tables: {
        exerciseCatalog: [{ ...catalogItem, technicalNotes: 'Pausa abajo.' }, catalogItem],
      },
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.tables.exerciseCatalog[0]?.technicalNotes).toBe('Pausa abajo.')
    expect(result.data.tables.exerciseCatalog[1]?.technicalNotes).toBe('')
    expect(result.data.tables.exerciseCatalog[1]?.warmupProtocol).toBe('none')
  })

  it('normalizes warmup protocols from old imports', () => {
    const result = backupSchema.safeParse({
      tables: {
        exerciseCatalog: [
          {
            aliases: [],
            assetKind: null,
            canonicalName: 'press-inclinado',
            createdAt: '2026-01-01T00:00:00.000Z',
            defaultRecommendedRir: 2,
            defaultRepsMax: 10,
            defaultRepsMin: 8,
            defaultRestSeconds: 120,
            defaultTargetSets: 4,
            equipment: 'Barra',
            id: 'catalog-1',
            mainMuscle: 'Pecho',
            name: 'Press inclinado',
            updatedAt: '2026-01-01T00:00:00.000Z',
            warmupProtocol: 'Fuerza maxima',
          },
        ],
        routineExercises: [{ ...exercise, warmupProtocol: '50%x8-10 / 75-80%x3-5' }],
      },
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.tables.exerciseCatalog[0]?.warmupProtocol).toBe('strength')
    expect(result.data.tables.routineExercises[0]?.warmupProtocol).toBe('none')
  })

  it('normalizes legacy Polea in routine imports and defaults load settings', () => {
    const result = routineExportSchema.safeParse({
      days: [day],
      exercises: [{ ...exercise, equipment: 'Polea', loadMode: undefined, barWeightKg: undefined }],
      routine,
      weeklyVolumeTargets: [],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.exercises[0]?.equipment).toBe('Maquina de polea')
    expect(result.data.exercises[0]?.loadMode).toBe('single')
    expect(result.data.exercises[0]?.barWeightKg).toBe(0)
  })

  it('normalizes legacy Polea in backup catalog imports', () => {
    const catalogItem = {
      aliases: [],
      assetKind: null,
      canonicalName: 'jalon-al-pecho',
      createdAt: '2026-01-01T00:00:00.000Z',
      defaultRecommendedRir: 2,
      defaultRepsMax: 10,
      defaultRepsMin: 8,
      defaultRestSeconds: 120,
      defaultTargetSets: 4,
      equipment: 'Polea',
      id: 'catalog-polea',
      mainMuscle: 'Espalda',
      name: 'Jalon al pecho',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }

    const result = backupSchema.safeParse({
      tables: {
        exerciseCatalog: [catalogItem],
      },
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.tables.exerciseCatalog[0]?.equipment).toBe('Maquina de polea')
    expect(result.data.tables.exerciseCatalog[0]?.loadMode).toBe('single')
    expect(result.data.tables.exerciseCatalog[0]?.barWeightKg).toBe(0)
  })
})

function removeFields<T extends Record<string, unknown>, K extends keyof T>(value: T, keys: K[]): Omit<T, K> {
  const copy = { ...value }
  for (const key of keys) delete copy[key]

  return copy
}
