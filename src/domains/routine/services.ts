import type { Equipment, Routine, RoutineDay, RoutineExercise } from './types'
import { db } from '../../db/schema'
import { createId } from '../../shared/utils/id'
import { canonicalName } from '../../shared/utils/normalize'

type ExerciseInput = {
  name: string
  mainMuscle: string
  equipment?: Equipment
  targetSets?: number
  repRange?: string
  recommendedRir?: string
  rest?: string
  restSeconds?: number
  warmupSets?: number
  warmupProtocol?: string
  progression?: string
  technicalNotes?: string
  currentWeightKg?: number
}

export async function createRoutine(name: string) {
  const now = new Date().toISOString()
  const routine: Routine = {
    id: createId('routine'),
    name: name.trim() || 'Nueva rutina',
    isActive: false,
    createdAt: now,
    updatedAt: now,
  }

  await db.routines.add(routine)

  return routine.id
}

export async function setActiveRoutine(routineId: string) {
  const now = new Date().toISOString()

  await db.transaction('rw', [db.routines, db.settings], async () => {
    const routines = await db.routines.toArray()
    await Promise.all(
      routines.map((routine) => db.routines.update(routine.id, { isActive: routine.id === routineId, updatedAt: now })),
    )
    await db.settings.update('app', { activeRoutineId: routineId, updatedAt: now })
  })
}

export async function renameRoutine(routineId: string, name: string) {
  await db.routines.update(routineId, {
    name: name.trim() || 'Rutina sin nombre',
    updatedAt: new Date().toISOString(),
  })
}

export async function duplicateRoutine(routineId: string) {
  const source = await db.routines.get(routineId)
  if (!source) throw new Error('Rutina no encontrada')

  const [days, exercises, volumeTargets] = await Promise.all([
    db.routineDays.where('routineId').equals(routineId).sortBy('order'),
    db.routineExercises.where('routineId').equals(routineId).sortBy('order'),
    db.weeklyVolumeTargets.where('routineId').equals(routineId).toArray(),
  ])

  const now = new Date().toISOString()
  const nextRoutineId = createId('routine')
  const dayIdMap = new Map<string, string>()
  const nextDays = days.map((day): RoutineDay => {
    const nextDayId = createId('day')
    dayIdMap.set(day.id, nextDayId)

    return {
      ...day,
      id: nextDayId,
      routineId: nextRoutineId,
      createdAt: now,
      updatedAt: now,
    }
  })
  const nextExercises = exercises.map((exercise): RoutineExercise => ({
    ...exercise,
    id: createId('exercise'),
    routineId: nextRoutineId,
    dayId: dayIdMap.get(exercise.dayId) ?? exercise.dayId,
    createdAt: now,
    updatedAt: now,
  }))

  await db.transaction('rw', [db.routines, db.routineDays, db.routineExercises, db.weeklyVolumeTargets], async () => {
    await db.routines.add({
      id: nextRoutineId,
      name: `${source.name} copia`,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    })
    await db.routineDays.bulkAdd(nextDays)
    await db.routineExercises.bulkAdd(nextExercises)
    await db.weeklyVolumeTargets.bulkAdd(
      volumeTargets.map((target) => ({
        ...target,
        id: createId('volume-target'),
        routineId: nextRoutineId,
      })),
    )
  })

  return nextRoutineId
}

export async function deleteRoutine(routineId: string) {
  const settings = await db.settings.get('app')
  const now = new Date().toISOString()

  await db.transaction('rw', [db.settings, db.routines, db.routineDays, db.routineExercises, db.weeklyVolumeTargets], async () => {
    await Promise.all([
      db.routines.delete(routineId),
      db.routineDays.where('routineId').equals(routineId).delete(),
      db.routineExercises.where('routineId').equals(routineId).delete(),
      db.weeklyVolumeTargets.where('routineId').equals(routineId).delete(),
    ])

    if (settings?.activeRoutineId !== routineId) return

    const nextRoutine = await db.routines.orderBy('updatedAt').last()
    await db.settings.update('app', {
      activeRoutineId: nextRoutine?.id ?? null,
      updatedAt: now,
    })
    if (nextRoutine) {
      await db.routines.update(nextRoutine.id, { isActive: true, updatedAt: now })
    }
  })
}

export async function createDay(routineId: string, name: string) {
  const now = new Date().toISOString()
  const order = await db.routineDays.where('routineId').equals(routineId).count()
  const day: RoutineDay = {
    id: createId('day'),
    routineId,
    name: name.trim() || `Dia ${order + 1}`,
    description: '',
    weekday: null,
    order,
    createdAt: now,
    updatedAt: now,
  }

  await db.routineDays.add(day)

  return day.id
}

export async function renameDay(dayId: string, name: string) {
  await db.routineDays.update(dayId, {
    name: name.trim() || 'Día sin nombre',
    updatedAt: new Date().toISOString(),
  })
}

export async function duplicateDay(dayId: string) {
  const day = await db.routineDays.get(dayId)
  if (!day) throw new Error('Día no encontrado')

  const exercises = await db.routineExercises.where('dayId').equals(dayId).sortBy('order')
  const now = new Date().toISOString()
  const nextDayId = createId('day')

  await db.transaction('rw', [db.routineDays, db.routineExercises], async () => {
    await db.routineDays.add({
      ...day,
      id: nextDayId,
      name: `${day.name} copia`,
      order: day.order + 1,
      weekday: null,
      createdAt: now,
      updatedAt: now,
    })
    await db.routineExercises.bulkAdd(
      exercises.map((exercise) => ({
        ...exercise,
        id: createId('exercise'),
        dayId: nextDayId,
        createdAt: now,
        updatedAt: now,
      })),
    )
  })

  return nextDayId
}

export async function deleteDay(dayId: string) {
  await db.transaction('rw', [db.routineDays, db.routineExercises], async () => {
    await db.routineDays.delete(dayId)
    await db.routineExercises.where('dayId').equals(dayId).delete()
  })
}

export async function moveDay(dayId: string, direction: 'up' | 'down') {
  const day = await db.routineDays.get(dayId)
  if (!day) throw new Error('Día no encontrado')

  const days = await db.routineDays.where('routineId').equals(day.routineId).sortBy('order')
  const index = days.findIndex((candidate) => candidate.id === dayId)
  const swapIndex = direction === 'up' ? index - 1 : index + 1
  const swapDay = days[swapIndex]
  if (index < 0 || !swapDay) return

  const now = new Date().toISOString()
  await db.transaction('rw', db.routineDays, async () => {
    await Promise.all([
      db.routineDays.update(day.id, { order: swapDay.order, updatedAt: now }),
      db.routineDays.update(swapDay.id, { order: day.order, updatedAt: now }),
    ])
  })
}

export async function createExercise(routineId: string, dayId: string, input: ExerciseInput) {
  const now = new Date().toISOString()
  const order = await db.routineExercises.where('dayId').equals(dayId).count()
  const name = input.name.trim() || 'Ejercicio nuevo'
  const exercise: RoutineExercise = {
    id: createId('exercise'),
    routineId,
    dayId,
    sourceExerciseId: null,
    name,
    canonicalName: canonicalName(name),
    mainMuscle: input.mainMuscle.trim() || 'Sin músculo',
    equipment: input.equipment ?? 'Otro',
    targetSets: input.targetSets ?? 3,
    repRange: input.repRange ?? '8-10',
    recommendedRir: input.recommendedRir ?? '1-2',
    rest: input.rest ?? '60-90 seg',
    restSeconds: input.restSeconds ?? 90,
    warmupSets: input.warmupSets ?? 0,
    warmupProtocol: input.warmupProtocol ?? '',
    progression: input.progression ?? '',
    technicalNotes: input.technicalNotes ?? '',
    currentWeightKg: input.currentWeightKg ?? 0,
    order,
    createdAt: now,
    updatedAt: now,
  }

  await db.routineExercises.add(exercise)

  return exercise.id
}

export async function updateExercise(exerciseId: string, input: ExerciseInput) {
  const name = input.name.trim() || 'Ejercicio sin nombre'

  await db.routineExercises.update(exerciseId, {
    name,
    canonicalName: canonicalName(name),
    mainMuscle: input.mainMuscle.trim() || 'Sin músculo',
    equipment: input.equipment ?? 'Otro',
    targetSets: input.targetSets ?? 3,
    repRange: input.repRange ?? '8-10',
    recommendedRir: input.recommendedRir ?? '1-2',
    rest: input.rest ?? '60-90 seg',
    restSeconds: input.restSeconds ?? 90,
    warmupSets: input.warmupSets ?? 0,
    warmupProtocol: input.warmupProtocol ?? '',
    progression: input.progression ?? '',
    technicalNotes: input.technicalNotes ?? '',
    currentWeightKg: input.currentWeightKg ?? 0,
    updatedAt: new Date().toISOString(),
  })
}

export async function duplicateExercise(exerciseId: string) {
  const exercise = await db.routineExercises.get(exerciseId)
  if (!exercise) throw new Error('Ejercicio no encontrado')

  const now = new Date().toISOString()
  const nextId = createId('exercise')
  await db.routineExercises.add({
    ...exercise,
    id: nextId,
    name: `${exercise.name} copia`,
    order: exercise.order + 1,
    createdAt: now,
    updatedAt: now,
  })

  return nextId
}

export async function deleteExercise(exerciseId: string) {
  await db.routineExercises.delete(exerciseId)
}

export async function moveExercise(exerciseId: string, direction: 'up' | 'down') {
  const exercise = await db.routineExercises.get(exerciseId)
  if (!exercise) throw new Error('Ejercicio no encontrado')

  const exercises = await db.routineExercises.where('dayId').equals(exercise.dayId).sortBy('order')
  const index = exercises.findIndex((candidate) => candidate.id === exerciseId)
  const swapIndex = direction === 'up' ? index - 1 : index + 1
  const swapExercise = exercises[swapIndex]
  if (index < 0 || !swapExercise) return

  const now = new Date().toISOString()
  await db.transaction('rw', db.routineExercises, async () => {
    await Promise.all([
      db.routineExercises.update(exercise.id, { order: swapExercise.order, updatedAt: now }),
      db.routineExercises.update(swapExercise.id, { order: exercise.order, updatedAt: now }),
    ])
  })
}
