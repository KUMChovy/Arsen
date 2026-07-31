import type { Equipment, ExerciseCatalogItem, Routine, RoutineDay, RoutineExercise } from './types'
import { db } from '../../db/schema'
import { createId } from '../../shared/utils/id'
import { canonicalName } from '../../shared/utils/normalize'
import { normalizeMuscleGroup } from './utils/muscles'

export type ExerciseInput = {
  name: string
  mainMuscle: string
  equipment?: Equipment
  targetSets?: number
  repsMin?: number
  repsMax?: number
  recommendedRir?: string
  rest?: string
  restSeconds?: number
  warmupSets?: number
  warmupProtocol?: string
  progression?: string
  technicalNotes?: string
  currentWeightKg?: number
}

export type CatalogExerciseInput = {
  aliases?: string[]
  equipment?: Equipment
  mainMuscle: string
  name: string
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

export async function updateDay(
  dayId: string,
  input: {
    description: string
    name: string
    weekday: RoutineDay['weekday']
  },
) {
  await db.routineDays.update(dayId, {
    description: input.description.trim(),
    name: input.name.trim() || 'Dia sin nombre',
    updatedAt: new Date().toISOString(),
    weekday: input.weekday,
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

export async function reorderDays(routineId: string, orderedDayIds: string[]) {
  const now = new Date().toISOString()

  await db.transaction('rw', db.routineDays, async () => {
    await Promise.all(
      orderedDayIds.map((dayId, order) =>
        db.routineDays.update(dayId, {
          order,
          routineId,
          updatedAt: now,
        }),
      ),
    )
  })
}

export async function createExercise(routineId: string, dayId: string, input: ExerciseInput) {
  const now = new Date().toISOString()
  const order = await db.routineExercises.where('dayId').equals(dayId).count()
  const name = input.name.trim() || 'Ejercicio nuevo'
  const reps = normalizeReps(input.repsMin, input.repsMax)
  const exercise: RoutineExercise = {
    id: createId('exercise'),
    routineId,
    dayId,
    sourceExerciseId: null,
    name,
    canonicalName: canonicalName(name),
    mainMuscle: normalizeMuscleGroup(input.mainMuscle),
    equipment: input.equipment ?? 'Otro',
    targetSets: input.targetSets ?? 3,
    repsMin: reps.min,
    repsMax: reps.max,
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

export async function addCatalogExerciseToDay(routineId: string, dayId: string, catalogItemId: string, input: Partial<ExerciseInput> = {}) {
  const catalogItem = await db.exerciseCatalog.get(catalogItemId)
  if (!catalogItem) throw new Error('Ejercicio de catalogo no encontrado')

  const now = new Date().toISOString()
  const order = await db.routineExercises.where('dayId').equals(dayId).count()
  const reps = normalizeReps(input.repsMin ?? catalogItem.defaultRepsMin, input.repsMax ?? catalogItem.defaultRepsMax)
  const exercise: RoutineExercise = {
    id: createId('exercise'),
    routineId,
    dayId,
    sourceExerciseId: catalogItem.id,
    name: catalogItem.name,
    canonicalName: catalogItem.canonicalName,
    mainMuscle: normalizeMuscleGroup(catalogItem.mainMuscle),
    equipment: input.equipment ?? catalogItem.equipment,
    targetSets: input.targetSets ?? catalogItem.defaultTargetSets,
    repsMin: reps.min,
    repsMax: reps.max,
    recommendedRir: input.recommendedRir ?? catalogItem.defaultRecommendedRir,
    rest: input.rest ?? `${input.restSeconds ?? catalogItem.defaultRestSeconds} seg`,
    restSeconds: input.restSeconds ?? catalogItem.defaultRestSeconds,
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
  const existing = await db.routineExercises.get(exerciseId)
  const name = input.name.trim() || 'Ejercicio sin nombre'
  const reps = normalizeReps(input.repsMin, input.repsMax)

  await db.routineExercises.update(exerciseId, {
    name,
    canonicalName: canonicalName(name),
    mainMuscle: normalizeMuscleGroup(input.mainMuscle),
    equipment: input.equipment ?? 'Otro',
    targetSets: input.targetSets ?? 3,
    repsMin: reps.min,
    repsMax: reps.max,
    recommendedRir: input.recommendedRir ?? '1-2',
    rest: input.rest ?? '60-90 seg',
    restSeconds: input.restSeconds ?? 90,
    warmupSets: input.warmupSets ?? 0,
    warmupProtocol: input.warmupProtocol ?? '',
    progression: input.progression ?? '',
    technicalNotes: input.technicalNotes ?? '',
    currentWeightKg: input.currentWeightKg ?? existing?.currentWeightKg ?? 0,
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

export async function reorderExercises(dayId: string, orderedExerciseIds: string[]) {
  const now = new Date().toISOString()

  await db.transaction('rw', db.routineExercises, async () => {
    await Promise.all(
      orderedExerciseIds.map((exerciseId, order) =>
        db.routineExercises.update(exerciseId, {
          dayId,
          order,
          updatedAt: now,
        }),
      ),
    )
  })
}

export async function createCatalogExercise(input: CatalogExerciseInput) {
  const now = new Date().toISOString()
  const name = input.name.trim() || 'Ejercicio nuevo'
  const mainMuscle = normalizeMuscleGroup(input.mainMuscle)
  const catalogItem: ExerciseCatalogItem = {
    aliases: input.aliases ?? [],
    assetKind: mainMuscle,
    canonicalName: canonicalName(name),
    createdAt: now,
    defaultRecommendedRir: '1-2',
    defaultRepsMax: 10,
    defaultRepsMin: 8,
    defaultRestSeconds: 90,
    defaultTargetSets: 3,
    equipment: input.equipment ?? 'Otro',
    id: createId('catalog'),
    mainMuscle,
    name,
    updatedAt: now,
  }

  await db.exerciseCatalog.add(catalogItem)

  return catalogItem.id
}

export async function updateCatalogExercise(catalogItemId: string, input: CatalogExerciseInput) {
  const name = input.name.trim() || 'Ejercicio sin nombre'
  const mainMuscle = normalizeMuscleGroup(input.mainMuscle)

  await db.exerciseCatalog.update(catalogItemId, {
    aliases: input.aliases ?? [],
    assetKind: mainMuscle,
    canonicalName: canonicalName(name),
    equipment: input.equipment ?? 'Otro',
    mainMuscle,
    name,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteCatalogExercise(catalogItemId: string) {
  await db.exerciseCatalog.delete(catalogItemId)
}

function normalizeReps(repsMin = 8, repsMax = 10) {
  if (!Number.isFinite(repsMin) || !Number.isFinite(repsMax) || repsMin <= 0 || repsMax <= 0 || repsMin > repsMax) {
    throw new Error('Las reps minimas no pueden ser mayores que las maximas')
  }

  return { max: repsMax, min: repsMin }
}
