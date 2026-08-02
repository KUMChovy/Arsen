import { CURRENT_SCHEMA_VERSION, db } from '../../db/schema'
import { downloadJson } from '../../shared/utils/download'
import { createId } from '../../shared/utils/id'
import { routineExportSchema } from '../../shared/validation/arsenImportSchemas'
import type { Routine, RoutineDay, RoutineExercise, WeeklyVolumeTarget } from './types'

type RoutineExport = {
  days: RoutineDay[]
  exercises: RoutineExercise[]
  exportedAt: string
  routine: Routine
  schemaVersion: number
  weeklyVolumeTargets: WeeklyVolumeTarget[]
}

export async function exportRoutineJson(routineId: string) {
  const routine = await db.routines.get(routineId)
  if (!routine) throw new Error('Rutina no encontrada')

  const data: RoutineExport = {
    days: await db.routineDays.where('routineId').equals(routineId).sortBy('order'),
    exercises: (await db.routineExercises.where('routineId').equals(routineId).sortBy('order')).map(stripLegacyProgression),
    exportedAt: new Date().toISOString(),
    routine,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    weeklyVolumeTargets: await db.weeklyVolumeTargets.where('routineId').equals(routineId).toArray(),
  }

  downloadJson(`arsen-rutina-${routine.name.replaceAll(' ', '-').toLowerCase()}.json`, data)
}

export async function importRoutineJson(file: File) {
  const parsed = parseRoutineExport(await file.text())
  const now = new Date().toISOString()
  const routineId = createId('routine')
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
    stripLegacyProgression({
      ...exercise,
      id: createId('exercise'),
      dayId: dayIdBySource.get(exercise.dayId) ?? exercise.dayId,
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

  await db.transaction('rw', [db.settings, db.routines, db.routineDays, db.routineExercises, db.weeklyVolumeTargets], async () => {
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
    await db.weeklyVolumeTargets.bulkAdd(targets)
    await db.settings.update('app', { activeRoutineId: routineId, updatedAt: now })
  })

  return routineId
}

function stripLegacyProgression(exercise: RoutineExercise): RoutineExercise {
  const copy = { ...exercise } as RoutineExercise & { progression?: unknown }
  delete copy.progression

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
    exercises: data.exercises as RoutineExercise[],
    exportedAt: data.exportedAt,
    routine: data.routine as Routine,
    schemaVersion: data.schemaVersion,
    weeklyVolumeTargets: data.weeklyVolumeTargets as WeeklyVolumeTarget[],
  }
}
