import { z } from 'zod'
import { CURRENT_SCHEMA_VERSION, dataTables, db } from '../../db/schema'
import { downloadJson } from '../../shared/utils/download'
import { createId } from '../../shared/utils/id'
import { timestampSchema } from '../../shared/validation/dataContract'
import { datasetSchema } from '../../shared/validation/dataset'
import { assetEntitySchema, routineDayEntitySchema, routineEntitySchema, routineExerciseEntitySchema, volumeTargetEntitySchema } from '../../shared/validation/entities'
import type { ExerciseAsset, Routine, RoutineDay, RoutineExercise, WeeklyVolumeTarget } from './types'

type RoutineExport = {
  days: RoutineDay[]
  exerciseAssets: ExerciseAsset[]
  exercises: RoutineExercise[]
  exportedAt: string
  routine: Routine
  schemaVersion: number
  weeklyVolumeTargets: WeeklyVolumeTarget[]
}

const routineExportSchema = z.object({
  days: z.array(routineDayEntitySchema), exerciseAssets: z.array(assetEntitySchema), exercises: z.array(routineExerciseEntitySchema),
  exportedAt: timestampSchema, routine: routineEntitySchema, schemaVersion: z.literal(CURRENT_SCHEMA_VERSION), weeklyVolumeTargets: z.array(volumeTargetEntitySchema),
}).strict()

/**
 * Exports one routine JSON file: routine metadata, its days, day exercises, and weekly volume targets.
 * Day exercises include recipe fields, technical notes, current weight, equipment, and load settings.
 */
export async function exportRoutineJson(routineId: string) {
  const data = await db.transaction('r', [db.routines, db.routineDays, db.routineExercises, db.exerciseAssets, db.weeklyVolumeTargets], async (): Promise<RoutineExport> => {
    const routine = await db.routines.get(routineId)
    if (!routine) throw new Error('Rutina no encontrada')
    const exercises = await db.routineExercises.where('routineId').equals(routineId).sortBy('order')
    const customAssetIds = [...new Set(exercises.map((exercise) => exercise.customAssetId).filter((id): id is string => Boolean(id)))]
    const exerciseAssets = customAssetIds.length > 0 ? await db.exerciseAssets.where('id').anyOf(customAssetIds).toArray() : []
    if (exerciseAssets.length !== customAssetIds.length) throw new Error('La rutina contiene imágenes ausentes')
    return {
      days: await db.routineDays.where('routineId').equals(routineId).sortBy('order'),
      exerciseAssets, exercises, exportedAt: new Date().toISOString(), routine, schemaVersion: CURRENT_SCHEMA_VERSION,
      weeklyVolumeTargets: await db.weeklyVolumeTargets.where('routineId').equals(routineId).toArray(),
    }
  })
  downloadJson(`arsen-rutina-${data.routine.name.replaceAll(' ', '-').toLowerCase()}.json`, data)
}

/**
 * Imports one routine JSON file and activates it after validation.
 */
export async function importRoutineJson(file: File) {
  const parsed = parseRoutineExport(await file.text())
  const sourceDayIds = new Set(parsed.days.map((day) => day.id))
  if (sourceDayIds.size !== parsed.days.length || parsed.days.some((day) => day.routineId !== parsed.routine.id) || parsed.exercises.some((exercise) => exercise.routineId !== parsed.routine.id || !sourceDayIds.has(exercise.dayId)) || parsed.weeklyVolumeTargets.some((target) => target.routineId !== parsed.routine.id)) throw new Error('La rutina contiene días o ejercicios incompatibles')
  for (const rows of [parsed.exercises, parsed.weeklyVolumeTargets]) {
    if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error('La rutina contiene identificadores duplicados')
  }
  const sourceAssetIds = new Set(parsed.exerciseAssets.map((asset) => asset.id))
  if (sourceAssetIds.size !== parsed.exerciseAssets.length || parsed.exercises.some((exercise) => exercise.customAssetId && !sourceAssetIds.has(exercise.customAssetId))) throw new Error('La rutina contiene imágenes ausentes o duplicadas')
  const now = new Date().toISOString()
  const routineId = createId('routine')
  const assetIdBySource = new Map<string, string>()
  const exerciseAssets = parsed.exerciseAssets.map((asset): ExerciseAsset => {
    const nextAssetId = createId('exercise-asset')
    assetIdBySource.set(asset.id, nextAssetId)
    return {
      ...asset,
      id: nextAssetId,
      createdAt: now,
      updatedAt: now,
    }
  })
  const dayIdBySource = new Map<string, string>()
  const days = parsed.days.map((day): RoutineDay => {
    const nextDayId = createId('day')
    dayIdBySource.set(day.id, nextDayId)

    return {
      ...day,
      id: nextDayId,
      routineId,
      createdAt: now,
      updatedAt: now,
    }
  })
  const exercises = parsed.exercises.map((exercise): RoutineExercise =>
    ({
      ...exercise,
      id: createId('exercise'),
      dayId: dayIdBySource.get(exercise.dayId) ?? exercise.dayId,
      customAssetId: exercise.customAssetId ? assetIdBySource.get(exercise.customAssetId) ?? null : null,
      routineId,
      createdAt: now,
      updatedAt: now,
    }),
  )
  const targets = parsed.weeklyVolumeTargets.map((target): WeeklyVolumeTarget => ({
    ...target,
    id: createId('volume-target'),
    routineId,
  }))

  await db.transaction('rw', db.tables, async () => {
    if (!(await db.settings.get('app'))) throw new Error('Configuración no encontrada')
    const routines = await db.routines.toArray()
    await Promise.all(routines.map((routine) => db.routines.update(routine.id, { isActive: false, updatedAt: now })))
    await db.routines.add({
      ...parsed.routine,
      id: routineId,
      isActive: true,
      name: `${parsed.routine.name} importada`,
      createdAt: now,
      updatedAt: now,
    })
    await db.routineDays.bulkAdd(days)
    await db.routineExercises.bulkAdd(exercises)
    await db.exerciseAssets.bulkAdd(exerciseAssets)
    await db.weeklyVolumeTargets.bulkAdd(targets)
    await db.settings.update('app', { activeRoutineId: routineId, updatedAt: now })
    const rows = await Promise.all(dataTables().map(async (table) => [table.name, await table.toArray()] as const))
    if (!datasetSchema.safeParse(Object.fromEntries(rows)).success) throw new Error('La rutina produciría datos o relaciones inválidos')
  })

  return routineId
}

function parseRoutineExport(content: string): RoutineExport {
  const parsed: unknown = JSON.parse(content)
  const result = routineExportSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error('El archivo no es una rutina Arsen valida')
  }
  const data = result.data

  return {
    days: data.days as RoutineDay[],
    exerciseAssets: (data.exerciseAssets ?? []) as ExerciseAsset[],
    exercises: data.exercises as RoutineExercise[],
    exportedAt: data.exportedAt,
    routine: data.routine as Routine,
    schemaVersion: data.schemaVersion,
    weeklyVolumeTargets: data.weeklyVolumeTargets as WeeklyVolumeTarget[],
  }
}
