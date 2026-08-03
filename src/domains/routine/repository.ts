import { db } from '../../db/schema'

export async function getActiveRoutineBundle() {
  const settings = await db.settings.get('app')
  const activeRoutineId = settings?.activeRoutineId
  if (!activeRoutineId) return null

  const [routine, days, exercises, volumeTargets] = await Promise.all([
    db.routines.get(activeRoutineId),
    db.routineDays.where('routineId').equals(activeRoutineId).sortBy('order'),
    db.routineExercises.where('routineId').equals(activeRoutineId).sortBy('order'),
    db.weeklyVolumeTargets.where('routineId').equals(activeRoutineId).toArray(),
  ])

  if (!routine) return null

  const exercisesByDay = new Map<string, typeof exercises>()
  for (const exercise of exercises) {
    const current = exercisesByDay.get(exercise.dayId)
    if (current) {
      current.push(exercise)
    } else {
      exercisesByDay.set(exercise.dayId, [exercise])
    }
  }

  return { days, exercises, exercisesByDay, routine, settings, volumeTargets }
}

export async function getWorkoutDayForDate(date: Date) {
  const bundle = await getActiveRoutineBundle()
  if (!bundle) return null

  const weekday = date.getDay()
  const day = bundle.days.find((candidate) => candidate.weekday === weekday) ?? bundle.days[0]
  if (!day) return null

  return {
    ...bundle,
    day,
    dayExercises: bundle.exercisesByDay.get(day.id) ?? [],
  }
}

export async function getWorkoutDayById(dayId: string | null | undefined) {
  const bundle = await getActiveRoutineBundle()
  if (!bundle || !dayId) return null

  const day = bundle.days.find((candidate) => candidate.id === dayId)
  if (!day) return null

  return {
    ...bundle,
    day,
    dayExercises: bundle.exercisesByDay.get(day.id) ?? [],
  }
}

export async function getRoutineDayDetail(dayId: string | null | undefined) {
  if (!dayId) return null

  const day = await db.routineDays.get(dayId)
  if (!day) return null

  const [routine, exercises] = await Promise.all([
    db.routines.get(day.routineId),
    db.routineExercises.where('dayId').equals(day.id).sortBy('order'),
  ])

  return {
    day,
    exercises,
    routine: routine ?? null,
  }
}

export async function getExerciseCatalog() {
  return db.exerciseCatalog.orderBy('canonicalName').toArray()
}

export async function getExerciseAssets() {
  return db.exerciseAssets.orderBy('updatedAt').reverse().toArray()
}

export async function getRoutines() {
  return db.routines.orderBy('updatedAt').reverse().toArray()
}
