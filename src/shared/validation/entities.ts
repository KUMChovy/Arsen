import { z } from 'zod'
import { imageAssetInputSchema, recordedMainOrWarmupSetValuesSchema, recordedSetValuesSchema, sessionStatusSchema, timestampSchema, trainingDateSchema, weightUnitSchema } from './dataContract'
import { healthSummarySchema } from './healthSchemas'
import { DELOAD_SERIES_PERCENT_MAX, DELOAD_SERIES_PERCENT_MIN, DELOAD_WEIGHT_PERCENT_MAX, DELOAD_WEIGHT_PERCENT_MIN } from '../calculations/deload'

const id = z.string().min(1).refine((value) => value === value.trim(), 'Identificador inválido')
const name = z.string().min(1).refine((value) => value.trim().length > 0, 'Nombre requerido')
const text = z.string()
const nonnegative = z.number().finite().nonnegative().max(Number.MAX_SAFE_INTEGER)
const integer = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const positiveInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const times = { createdAt: timestampSchema, updatedAt: timestampSchema }
const equipment = z.enum(['Barra', 'Mancuerna', 'Maquina', 'Maquina de polea', 'Peso corporal', 'Otro'])
const loadMode = z.enum(['single', 'split'])
const assetFields = { assetKind: z.string().nullable(), bundledAssetId: id.nullable(), customAssetId: id.nullable() }
const optionalAssetFields = { assetKind: z.string().nullable().optional(), bundledAssetId: id.nullable().optional(), customAssetId: id.nullable().optional() }

export const routineEntitySchema = z.object({ id, name, isActive: z.boolean(), ...times }).strict()
export const routineDayEntitySchema = z.object({ id, routineId: id, name, description: text, weekday: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]).nullable(), order: integer, ...times }).strict()
export const routineExerciseEntitySchema = z.object({
  id, routineId: id, dayId: id, sourceExerciseId: id.nullable(), ...assetFields,
  name, canonicalName: name, mainMuscle: name, equipment, loadMode, barWeightKg: nonnegative,
  targetSets: positiveInteger, repsMin: positiveInteger, repsMax: positiveInteger,
  recommendedRir: nonnegative, rest: text, restSeconds: integer, warmupSets: integer, warmupProtocol: text,
  technicalNotes: text, currentWeightKg: nonnegative, order: integer, ...times,
}).strict().refine((exercise) => exercise.repsMin <= exercise.repsMax, 'Rango de repeticiones inválido')

export const catalogEntitySchema = z.object({
  id, name, canonicalName: name, mainMuscle: name, equipment, loadMode, barWeightKg: nonnegative,
  warmupProtocol: text, aliases: z.array(text), technicalNotes: text, defaultTargetSets: positiveInteger,
  defaultRepsMin: positiveInteger, defaultRepsMax: positiveInteger, defaultRecommendedRir: nonnegative,
  defaultRestSeconds: integer, ...assetFields, origin: z.enum(['user', 'sinful-shell']).optional(),
  sinfulShellId: id.nullable().optional(), sinfulShellContentLocked: z.boolean().optional(), ...times,
  catalogVersion: z.number().int().positive().optional(), catalogUpdatedAt: timestampSchema.nullable().optional(), catalogStatus: z.enum(['active', 'archived']).optional(),
}).strict().refine((item) => item.defaultRepsMin <= item.defaultRepsMax, 'Rango de repeticiones inválido')

export const assetEntitySchema = z.object({ id, name, mimeType: z.string().startsWith('image/'), dataUrl: z.string().startsWith('data:image/'), ...times }).strict().refine((asset) => imageAssetInputSchema.safeParse(asset).success, 'La imagen no coincide con su tipo o no es válida')
export const volumeTargetEntitySchema = z.object({ id, routineId: id, muscle: name, sets: integer, range: text, evaluation: text, comment: text }).strict()
export const settingsEntitySchema = z.object({
  id: z.literal('app'), schemaVersion: z.number().int().positive(), activeRoutineId: id.nullable(), preferredUnit: weightUnitSchema,
  lastContractBackupSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable().optional(),
  availablePlateWeightsKg: z.array(z.number().finite().refine((weight) => Number.isFinite(weight * 100) && Math.round(weight * 100) > 0)).optional(), deloadNotifications: z.boolean(),
  deloadSeriesReductionPercent: z.number().int().min(DELOAD_SERIES_PERCENT_MIN).max(DELOAD_SERIES_PERCENT_MAX).optional(),
  deloadWeightReductionPercent: z.number().int().min(DELOAD_WEIGHT_PERCENT_MIN).max(DELOAD_WEIGHT_PERCENT_MAX).optional(),
  healthIntegrationEnabled: z.boolean().optional(), healthIntegrationFirstConnectedAt: timestampSchema.nullable().optional(),
  lastDeloadNotificationDate: trainingDateSchema.nullable().optional(), notificationPermission: z.enum(['default', 'denied', 'granted', 'unsupported']).optional(),
  storagePersisted: z.boolean().nullable(), ...times,
}).strict()
export const deloadEntitySchema = z.object({
  id, status: z.enum(['suggested', 'scheduled', 'active', 'completed', 'skipped']),
  suggestedAt: trainingDateSchema.nullable(), scheduledStartDate: trainingDateSchema.nullable(), startedAt: trainingDateSchema.nullable(),
  completedAt: trainingDateSchema.nullable(), skippedAt: trainingDateSchema.nullable(), ...times,
}).strict()
const snapshotSchema = z.object({
  name, canonicalName: name, mainMuscle: name, equipment: name, ...optionalAssetFields,
  loadMode: loadMode.optional(), barWeightKg: nonnegative.optional(), targetSets: positiveInteger,
  repsMin: positiveInteger, repsMax: positiveInteger, recommendedRir: nonnegative, restSeconds: integer,
}).strict().refine((snapshot) => snapshot.repsMin <= snapshot.repsMax, 'Rango de repeticiones inválido')
export const sessionEntitySchema = z.object({
  id, routineId: id, dayId: id, date: trainingDateSchema, notes: text, displayUnit: weightUnitSchema, status: sessionStatusSchema,
  manuallyCompleted: z.boolean().optional(), sessionExercises: z.array(routineExerciseEntitySchema).optional(),
  routineName: text.optional(), dayName: text.optional(), startedAt: timestampSchema.nullable().optional(),
  lastExerciseAt: timestampSchema.nullable().optional(), completedAt: timestampSchema.nullable().optional(),
  health: healthSummarySchema.optional(), healthHistory: z.array(healthSummarySchema).optional(), ...times,
}).strict()
export const exerciseLogEntitySchema = z.object({ id, sessionId: id, routineExerciseId: id, state: z.enum(['pending', 'in_progress', 'skipped', 'done']), notes: text, snapshot: snapshotSchema, ...times }).strict()
export const setEntitySchema = recordedMainOrWarmupSetValuesSchema.extend({ id, exerciseLogId: id, ...times }).strict()
export const dropSetEntitySchema = recordedSetValuesSchema.extend({ id, setLogId: id, ...times }).strict()
export const skipEntitySchema = z.object({ id, sessionId: id, routineExerciseId: id, reason: text, createdAt: timestampSchema }).strict()
