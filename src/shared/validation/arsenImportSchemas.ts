import { z } from 'zod'
import { loadSettingsForEquipment, normalizeEquipment } from '../calculations/equipmentLoad'
import { normalizeWarmupProtocol } from '../calculations/warmups'

const equipmentSchema = z.string().transform(normalizeEquipment)
const loadModeSchema = z.enum(['single', 'split'])
const weekdaySchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.null(),
])
const weightUnitSchema = z.enum(['kg', 'lb'])
const exerciseStateSchema = z.enum(['pending', 'in_progress', 'skipped', 'done'])
const setKindSchema = z.enum(['main', 'warmup'])

export const routineSchema = z
  .object({
    createdAt: z.string(),
    id: z.string().min(1),
    isActive: z.boolean(),
    name: z.string(),
    updatedAt: z.string(),
  })
  .passthrough()

export const routineDaySchema = z
  .object({
    createdAt: z.string(),
    description: z.string(),
    id: z.string().min(1),
    name: z.string(),
    order: z.number(),
    routineId: z.string().min(1),
    updatedAt: z.string(),
    weekday: weekdaySchema,
  })
  .passthrough()

export const routineExerciseSchema = z
  .object({
    assetKind: z.string().nullable().optional().default(null),
    canonicalName: z.string(),
    createdAt: z.string(),
    currentWeightKg: z.number().optional().default(0),
    customAssetId: z.string().nullable().optional().default(null),
    dayId: z.string().min(1),
    equipment: equipmentSchema,
    id: z.string().min(1),
    barWeightKg: z.number().optional(),
    loadMode: loadModeSchema.optional(),
    mainMuscle: z.string(),
    name: z.string(),
    order: z.number(),
    recommendedRir: z.number().min(0),
    repsMax: z.number().optional().default(10),
    repsMin: z.number().optional().default(8),
    rest: z.string(),
    restSeconds: z.number(),
    routineId: z.string().min(1),
    sourceExerciseId: z.string().nullable(),
    targetSets: z.number(),
    technicalNotes: z.string().optional().default(''),
    updatedAt: z.string(),
    warmupProtocol: z.string().optional().default('none').transform(normalizeWarmupProtocol),
    warmupSets: z.number(),
  })
  .passthrough()
  .transform((exercise) => ({
    ...exercise,
    ...loadSettingsForEquipment({
      barWeightKg: exercise.barWeightKg,
      equipment: exercise.equipment,
      loadMode: exercise.loadMode,
    }),
  }))
  .refine((exercise) => exercise.repsMin <= exercise.repsMax, { message: 'repsMin no puede ser mayor que repsMax' })

export const weeklyVolumeTargetSchema = z
  .object({
    comment: z.string(),
    evaluation: z.string(),
    id: z.string().min(1),
    muscle: z.string(),
    range: z.string(),
    routineId: z.string().min(1),
    sets: z.number(),
  })
  .passthrough()

export const exerciseCatalogItemSchema = z
  .object({
    aliases: z.array(z.string()),
    assetKind: z.string().nullable().optional().default(null),
    canonicalName: z.string(),
    createdAt: z.string(),
    customAssetId: z.string().nullable().optional().default(null),
    defaultRecommendedRir: z.number().min(0),
    defaultRepsMax: z.number().optional().default(10),
    defaultRepsMin: z.number().optional().default(8),
    defaultRestSeconds: z.number(),
    defaultTargetSets: z.number(),
    equipment: equipmentSchema,
    id: z.string().min(1),
    barWeightKg: z.number().optional(),
    loadMode: loadModeSchema.optional(),
    mainMuscle: z.string(),
    name: z.string(),
    technicalNotes: z.string().optional().default(''),
    updatedAt: z.string(),
    warmupProtocol: z.string().optional().default('none').transform(normalizeWarmupProtocol),
  })
  .passthrough()
  .transform((item) => ({
    ...item,
    ...loadSettingsForEquipment({
      barWeightKg: item.barWeightKg,
      equipment: item.equipment,
      loadMode: item.loadMode,
    }),
  }))
  .refine((item) => item.defaultRepsMin <= item.defaultRepsMax, { message: 'defaultRepsMin no puede ser mayor que defaultRepsMax' })

export const exerciseAssetSchema = z
  .object({
    createdAt: z.string(),
    dataUrl: z.string().startsWith('data:image/'),
    id: z.string().min(1),
    mimeType: z.string().startsWith('image/'),
    name: z.string(),
    updatedAt: z.string(),
  })
  .passthrough()

export const appSettingsSchema = z
  .object({
    activeRoutineId: z.string().nullable(),
    createdAt: z.string(),
    deloadNotifications: z.boolean(),
    id: z.literal('app'),
    lastDeloadNotificationDate: z.string().nullable().optional(),
    notificationPermission: z.enum(['default', 'denied', 'granted', 'unsupported']).optional(),
    preferredUnit: weightUnitSchema,
    schemaVersion: z.number(),
    storagePersisted: z.boolean().nullable(),
    updatedAt: z.string(),
  })
  .passthrough()

export const workoutSessionSchema = z
  .object({
    createdAt: z.string(),
    date: z.string(),
    dayId: z.string().min(1),
    displayUnit: weightUnitSchema,
    id: z.string().min(1),
    notes: z.string(),
    routineId: z.string().min(1),
    status: z.enum(['draft', 'completed']),
    updatedAt: z.string(),
  })
  .passthrough()

export const exerciseLogSchema = z
  .object({
    createdAt: z.string(),
    id: z.string().min(1),
    notes: z.string(),
    routineExerciseId: z.string().min(1),
    sessionId: z.string().min(1),
    snapshot: z
      .object({
        assetKind: z.string().nullable().optional().default(null),
        canonicalName: z.string(),
        customAssetId: z.string().nullable().optional().default(null),
        equipment: z.string(),
        mainMuscle: z.string(),
        name: z.string(),
        recommendedRir: z.number().min(0),
        repsMax: z.number().optional().default(10),
        repsMin: z.number().optional().default(8),
        restSeconds: z.number(),
        targetSets: z.number(),
      })
      .passthrough()
      .refine((snapshot) => snapshot.repsMin <= snapshot.repsMax, { message: 'repsMin no puede ser mayor que repsMax' }),
    state: exerciseStateSchema,
    updatedAt: z.string(),
  })
  .passthrough()

export const setLogSchema = z
  .object({
    createdAt: z.string(),
    displayUnit: weightUnitSchema,
    exerciseLogId: z.string().min(1),
    id: z.string().min(1),
    kind: setKindSchema,
    order: z.number(),
    reps: z.number(),
    rir: z.number(),
    updatedAt: z.string(),
    weightKg: z.number(),
  })
  .passthrough()

export const dropSetLogSchema = z
  .object({
    createdAt: z.string(),
    displayUnit: weightUnitSchema,
    id: z.string().min(1),
    order: z.number(),
    reps: z.number(),
    rir: z.number(),
    setLogId: z.string().min(1),
    updatedAt: z.string(),
    weightKg: z.number(),
  })
  .passthrough()

export const skipLogSchema = z
  .object({
    createdAt: z.string(),
    id: z.string().min(1),
    reason: z.string(),
    routineExerciseId: z.string().min(1),
    sessionId: z.string().min(1),
  })
  .passthrough()

export const routineExportSchema = z
  .object({
    days: z.array(routineDaySchema),
    exerciseAssets: z.array(exerciseAssetSchema).optional().default([]),
    exercises: z.array(routineExerciseSchema),
    exportedAt: z.string().optional().default(''),
    routine: routineSchema,
    schemaVersion: z.number().optional().default(1),
    weeklyVolumeTargets: z.array(weeklyVolumeTargetSchema).optional().default([]),
  })
  .passthrough()

export const backupSchema = z
  .object({
    exportedAt: z.string().optional(),
    schemaVersion: z.number().optional(),
    tables: z
      .object({
        dropSetLogs: z.array(dropSetLogSchema).optional().default([]),
        exerciseAssets: z.array(exerciseAssetSchema).optional().default([]),
        exerciseCatalog: z.array(exerciseCatalogItemSchema).optional().default([]),
        exerciseLogs: z.array(exerciseLogSchema).optional().default([]),
        routineDays: z.array(routineDaySchema).optional().default([]),
        routineExercises: z.array(routineExerciseSchema).optional().default([]),
        routines: z.array(routineSchema).optional().default([]),
        setLogs: z.array(setLogSchema).optional().default([]),
        settings: z.array(appSettingsSchema).optional().default([]),
        skipLogs: z.array(skipLogSchema).optional().default([]),
        weeklyVolumeTargets: z.array(weeklyVolumeTargetSchema).optional().default([]),
        workoutSessions: z.array(workoutSessionSchema).optional().default([]),
      })
      .passthrough(),
  })
  .passthrough()
