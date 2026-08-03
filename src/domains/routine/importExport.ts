import { CURRENT_SCHEMA_VERSION, db } from '../../db/schema'
import { loadSettingsForEquipment } from '../../shared/calculations/equipmentLoad'
import { normalizeWarmupProtocol } from '../../shared/calculations/warmups'
import { downloadJson } from '../../shared/utils/download'
import { createId } from '../../shared/utils/id'
import { routineExportSchema } from '../../shared/validation/arsenImportSchemas'
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

/**
 * Exports one routine JSON file: routine metadata, its days, day exercises, and weekly volume targets.
 * Day exercises include recipe fields, technical notes, current weight, equipment, and load settings.
 */
export async function exportRoutineJson(routineId: string) {
  const routine = await db.routines.get(routineId)
  if (!routine) throw new Error('Rutina no encontrada')
  const exercises = (await db.routineExercises.where('routineId').equals(routineId).sortBy('order')).map(cleanExerciseForTransfer)
  const customAssetIds = [...new Set(exercises.map((exercise) => exercise.customAssetId).filter((id): id is string => Boolean(id)))]
  const exerciseAssets = customAssetIds.length > 0 ? await db.exerciseAssets.where('id').anyOf(customAssetIds).toArray() : []

  const data: RoutineExport = {
    days: await db.routineDays.where('routineId').equals(routineId).sortBy('order'),
    exerciseAssets,
    exercises,
    exportedAt: new Date().toISOString(),
    routine,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    weeklyVolumeTargets: await db.weeklyVolumeTargets.where('routineId').equals(routineId).toArray(),
  }

  downloadJson(`arsen-rutina-${routine.name.replaceAll(' ', '-').toLowerCase()}.json`, data)
}

/**
 * Imports one routine JSON file and activates it, applying schema defaults for legacy exercise fields.
 */
export async function importRoutineJson(file: File) {
  const parsed = parseRoutineExport(await file.text())
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
    cleanExerciseForTransfer({
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

  await db.transaction('rw', [db.settings, db.routines, db.routineDays, db.routineExercises, db.exerciseAssets, db.weeklyVolumeTargets], async () => {
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
  })

  return routineId
}

function cleanExerciseForTransfer(exercise: RoutineExercise): RoutineExercise {
  const copy = { ...exercise } as RoutineExercise & { progression?: unknown }
  delete copy.progression
  copy.warmupProtocol = normalizeWarmupProtocol(copy.warmupProtocol)
  const loadSettings = loadSettingsForEquipment(copy)
  copy.equipment = loadSettings.equipment
  copy.loadMode = loadSettings.loadMode
  copy.barWeightKg = loadSettings.barWeightKg

  return copy
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
