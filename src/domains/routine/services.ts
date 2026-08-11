import type { Equipment, ExerciseAsset, ExerciseCatalogItem, LoadMode, Routine, RoutineDay, RoutineExercise } from './types'
import { db } from '../../db/schema'
import { loadSettingsForEquipment } from '../../shared/calculations/equipmentLoad'
import { normalizeWarmupProtocol } from '../../shared/calculations/warmups'
import { createId } from '../../shared/utils/id'
import { canonicalName } from '../../shared/utils/normalize'
import { getSinfulShellExerciseById } from './data/sinfulShellCatalog'
import { normalizeMuscleGroup } from './utils/muscles'

export type ExerciseInput = {
  assetKind?: string | null
  bundledAssetId?: string | null
  name: string
  customAssetId?: string | null
  mainMuscle: string
  equipment?: Equipment
  loadMode?: LoadMode
  barWeightKg?: number
  targetSets?: number
  repsMin?: number
  repsMax?: number
  recommendedRir?: number
  rest?: string
  restSeconds?: number
  warmupSets?: number
  warmupProtocol?: string
  technicalNotes?: string
  currentWeightKg?: number
}

export type CatalogExerciseInput = {
  aliases?: string[]
  assetKind?: string | null
  bundledAssetId?: string | null
  barWeightKg?: number
  defaultRecommendedRir?: number
  defaultRepsMax?: number
  defaultRepsMin?: number
  defaultRestSeconds?: number
  defaultTargetSets?: number
  equipment?: Equipment
  loadMode?: LoadMode
  mainMuscle?: string
  mode?: 'manual' | 'create-from-sinful-shell'
  name?: string
  customAssetId?: string | null
  sinfulShellId?: string | null
  technicalNotes?: string
  warmupProtocol?: string
}

export type ExerciseAssetInput = Pick<ExerciseAsset, 'dataUrl' | 'mimeType' | 'name'>

export async function createExerciseAsset(input: ExerciseAssetInput) {
  const now = new Date().toISOString()
  const asset: ExerciseAsset = {
    createdAt: now,
    dataUrl: input.dataUrl,
    id: createId('exercise-asset'),
    mimeType: input.mimeType,
    name: input.name.trim() || 'Imagen de ejercicio',
    updatedAt: now,
  }

  await db.exerciseAssets.add(asset)

  return asset.id
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
  const recommendedRir = normalizeRir(input.recommendedRir)
  const loadSettings = loadSettingsForEquipment({
    barWeightKg: input.barWeightKg,
    equipment: input.equipment ?? 'Otro',
    loadMode: input.loadMode,
  })
  const exercise: RoutineExercise = {
    assetKind: input.assetKind ?? null,
    bundledAssetId: input.bundledAssetId ?? null,
    customAssetId: input.customAssetId ?? null,
    id: createId('exercise'),
    routineId,
    dayId,
    sourceExerciseId: null,
    name,
    canonicalName: canonicalName(name),
    mainMuscle: normalizeMuscleGroup(input.mainMuscle),
    equipment: loadSettings.equipment,
    loadMode: loadSettings.loadMode,
    barWeightKg: loadSettings.barWeightKg,
    targetSets: input.targetSets ?? 3,
    repsMin: reps.min,
    repsMax: reps.max,
    recommendedRir,
    rest: input.rest ?? '60-90 seg',
    restSeconds: input.restSeconds ?? 90,
    warmupSets: input.warmupSets ?? 0,
    warmupProtocol: normalizeWarmupProtocol(input.warmupProtocol),
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
  const recommendedRir = normalizeRir(input.recommendedRir ?? catalogItem.defaultRecommendedRir)
  const loadSettings = loadSettingsForEquipment({
    barWeightKg: input.barWeightKg ?? catalogItem.barWeightKg,
    equipment: input.equipment ?? catalogItem.equipment,
    loadMode: input.loadMode ?? catalogItem.loadMode,
  })
  const exercise: RoutineExercise = {
    assetKind: catalogItem.assetKind ?? null,
    bundledAssetId: catalogItem.bundledAssetId ?? null,
    customAssetId: catalogItem.customAssetId ?? null,
    id: createId('exercise'),
    routineId,
    dayId,
    sourceExerciseId: catalogItem.id,
    name: catalogItem.name,
    canonicalName: catalogItem.canonicalName,
    mainMuscle: normalizeMuscleGroup(catalogItem.mainMuscle),
    equipment: loadSettings.equipment,
    loadMode: loadSettings.loadMode,
    barWeightKg: loadSettings.barWeightKg,
    targetSets: input.targetSets ?? catalogItem.defaultTargetSets,
    repsMin: reps.min,
    repsMax: reps.max,
    recommendedRir,
    rest: input.rest ?? `${input.restSeconds ?? catalogItem.defaultRestSeconds} seg`,
    restSeconds: input.restSeconds ?? catalogItem.defaultRestSeconds,
    warmupSets: input.warmupSets ?? 0,
    warmupProtocol: normalizeWarmupProtocol(input.warmupProtocol ?? catalogItem.warmupProtocol),
    technicalNotes: input.technicalNotes ?? catalogItem.technicalNotes ?? '',
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
  const recommendedRir = normalizeRir(input.recommendedRir)
  const loadSettings = loadSettingsForEquipment({
    barWeightKg: input.barWeightKg ?? existing?.barWeightKg,
    equipment: input.equipment ?? existing?.equipment ?? 'Otro',
    loadMode: input.loadMode ?? existing?.loadMode,
  })

  await db.routineExercises.update(exerciseId, {
    assetKind: input.assetKind === undefined ? existing?.assetKind ?? null : input.assetKind,
    bundledAssetId: input.bundledAssetId === undefined ? existing?.bundledAssetId ?? null : input.bundledAssetId,
    customAssetId: input.customAssetId === undefined ? existing?.customAssetId ?? null : input.customAssetId,
    name,
    canonicalName: canonicalName(name),
    mainMuscle: normalizeMuscleGroup(input.mainMuscle),
    equipment: loadSettings.equipment,
    loadMode: loadSettings.loadMode,
    barWeightKg: loadSettings.barWeightKg,
    targetSets: input.targetSets ?? 3,
    repsMin: reps.min,
    repsMax: reps.max,
    recommendedRir,
    rest: input.rest ?? '60-90 seg',
    restSeconds: input.restSeconds ?? 90,
    warmupSets: input.warmupSets ?? 0,
    warmupProtocol: normalizeWarmupProtocol(input.warmupProtocol),
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

  if (input.mode === 'create-from-sinful-shell') {
    const sinfulShellId = input.sinfulShellId?.trim()
    if (!sinfulShellId) throw new Error('Ejercicio de Sinful Shell requerido')

    const source = getSinfulShellExerciseById(sinfulShellId)
    if (!source) throw new Error('Ejercicio de Sinful Shell no encontrado')

    const existing = await findExistingSinfulShellCopy(sinfulShellId)
    if (existing) return existing.id

    const reps = normalizeReps(input.defaultRepsMin, input.defaultRepsMax)
    const loadSettings = loadSettingsForEquipment({
      barWeightKg: input.barWeightKg,
      equipment: input.equipment ?? 'Otro',
      loadMode: input.loadMode,
    })
    const catalogItem: ExerciseCatalogItem = {
      aliases: input.aliases ?? source.aliases,
      assetKind: null,
      bundledAssetId: source.bundledAssetId,
      canonicalName: source.canonicalName,
      createdAt: now,
      defaultRecommendedRir: normalizeRir(input.defaultRecommendedRir),
      defaultRepsMax: reps.max,
      defaultRepsMin: reps.min,
      defaultRestSeconds: input.defaultRestSeconds ?? 90,
      defaultTargetSets: input.defaultTargetSets ?? 3,
      equipment: loadSettings.equipment,
      loadMode: loadSettings.loadMode,
      barWeightKg: loadSettings.barWeightKg,
      id: createId('catalog'),
      mainMuscle: source.mainMuscle,
      name: source.name,
      customAssetId: null,
      origin: 'sinful-shell',
      sinfulShellContentLocked: true,
      sinfulShellId: source.id,
      technicalNotes: source.technicalNotes,
      warmupProtocol: normalizeWarmupProtocol(input.warmupProtocol),
      updatedAt: now,
    }

    await db.exerciseCatalog.add(catalogItem)

    return catalogItem.id
  }

  const name = input.name?.trim() || 'Ejercicio nuevo'
  const mainMuscle = normalizeMuscleGroup(input.mainMuscle)
  const reps = normalizeReps(input.defaultRepsMin, input.defaultRepsMax)
  const loadSettings = loadSettingsForEquipment({
    barWeightKg: input.barWeightKg,
    equipment: input.equipment ?? 'Otro',
    loadMode: input.loadMode,
  })
  const catalogItem: ExerciseCatalogItem = {
    aliases: input.aliases ?? [],
    assetKind: input.assetKind ?? null,
    bundledAssetId: input.bundledAssetId ?? null,
    canonicalName: canonicalName(name),
    createdAt: now,
    defaultRecommendedRir: normalizeRir(input.defaultRecommendedRir),
    defaultRepsMax: reps.max,
    defaultRepsMin: reps.min,
    defaultRestSeconds: input.defaultRestSeconds ?? 90,
    defaultTargetSets: input.defaultTargetSets ?? 3,
    equipment: loadSettings.equipment,
    loadMode: loadSettings.loadMode,
    barWeightKg: loadSettings.barWeightKg,
    id: createId('catalog'),
    mainMuscle,
    name,
    customAssetId: input.customAssetId ?? null,
    origin: 'user',
    sinfulShellContentLocked: false,
    sinfulShellId: null,
    technicalNotes: input.technicalNotes?.trim() ?? '',
    warmupProtocol: normalizeWarmupProtocol(input.warmupProtocol),
    updatedAt: now,
  }

  await db.exerciseCatalog.add(catalogItem)

  return catalogItem.id
}

export async function updateCatalogExercise(catalogItemId: string, input: CatalogExerciseInput) {
  const existing = await db.exerciseCatalog.get(catalogItemId)
  if (!existing) throw new Error('Ejercicio de catalogo no encontrado')

  const origin = normalizeCatalogOrigin(existing)
  const lockedSource = origin.sinfulShellContentLocked && origin.sinfulShellId ? getSinfulShellExerciseById(origin.sinfulShellId) : null
  const isLocked = origin.sinfulShellContentLocked
  const name = isLocked ? lockedSource?.name ?? existing.name : input.name?.trim() || 'Ejercicio sin nombre'
  const mainMuscle = isLocked ? lockedSource?.mainMuscle ?? existing.mainMuscle : normalizeMuscleGroup(input.mainMuscle)
  const reps = normalizeReps(input.defaultRepsMin ?? existing.defaultRepsMin, input.defaultRepsMax ?? existing.defaultRepsMax)
  const loadSettings = loadSettingsForEquipment({
    barWeightKg: input.barWeightKg ?? existing.barWeightKg,
    equipment: input.equipment ?? existing.equipment,
    loadMode: input.loadMode ?? existing.loadMode,
  })

  await db.exerciseCatalog.update(catalogItemId, {
    aliases: input.aliases ?? [],
    assetKind: isLocked ? existing.assetKind ?? null : input.assetKind === undefined ? existing.assetKind ?? null : input.assetKind,
    bundledAssetId: isLocked
      ? lockedSource?.bundledAssetId ?? existing.bundledAssetId
      : input.bundledAssetId === undefined
        ? existing.bundledAssetId ?? null
        : input.bundledAssetId,
    canonicalName: canonicalName(name),
    defaultRecommendedRir: normalizeRir(input.defaultRecommendedRir ?? existing.defaultRecommendedRir),
    defaultRepsMax: reps.max,
    defaultRepsMin: reps.min,
    defaultRestSeconds: input.defaultRestSeconds ?? existing.defaultRestSeconds,
    defaultTargetSets: input.defaultTargetSets ?? existing.defaultTargetSets,
    equipment: loadSettings.equipment,
    loadMode: loadSettings.loadMode,
    barWeightKg: loadSettings.barWeightKg,
    mainMuscle,
    name,
    customAssetId: isLocked ? existing.customAssetId ?? null : input.customAssetId === undefined ? existing.customAssetId ?? null : input.customAssetId,
    origin: origin.origin,
    sinfulShellContentLocked: origin.sinfulShellContentLocked,
    sinfulShellId: origin.sinfulShellId,
    technicalNotes: isLocked ? lockedSource?.technicalNotes ?? existing.technicalNotes : input.technicalNotes?.trim() ?? '',
    warmupProtocol: normalizeWarmupProtocol(input.warmupProtocol),
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

function normalizeCatalogOrigin(input: Pick<ExerciseCatalogItem, 'origin' | 'sinfulShellContentLocked' | 'sinfulShellId'>) {
  return {
    origin: input.origin ?? 'user',
    sinfulShellContentLocked: input.sinfulShellContentLocked ?? false,
    sinfulShellId: input.sinfulShellId ?? null,
  }
}

async function findExistingSinfulShellCopy(sinfulShellId: string) {
  return db.exerciseCatalog
    .filter((item) => (item.origin ?? 'user') === 'sinful-shell' && (item.sinfulShellId ?? null) === sinfulShellId)
    .first()
}

function normalizeRir(recommendedRir = 2) {
  if (!Number.isFinite(recommendedRir) || recommendedRir < 0) {
    throw new Error('El RIR debe ser mayor o igual a 0')
  }

  return recommendedRir
}
