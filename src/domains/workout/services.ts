import type { RoutineExercise } from '../routine/types'
import type { DropSetLog, ExerciseLog, SetLog, WeightUnit, WorkoutSession } from './types'
import { db } from '../../db/schema'
import { createId } from '../../shared/utils/id'
import { exerciseStateFromSets } from '../../shared/calculations/workout'

export async function getOrCreateSessionForDay(input: {
  date: string
  dayId: string
  displayUnit: WeightUnit
  routineId: string
}) {
  const existing = await db.workoutSessions
    .where('[date+dayId]')
    .equals([input.date, input.dayId])
    .first()

  if (existing) return existing.id

  const now = new Date().toISOString()
  const session: WorkoutSession = {
    id: createId('session'),
    routineId: input.routineId,
    dayId: input.dayId,
    date: input.date,
    notes: '',
    displayUnit: input.displayUnit,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }

  await db.workoutSessions.add(session)

  return session.id
}

export async function ensureExerciseLog(sessionId: string, exercise: RoutineExercise) {
  const existing = await db.exerciseLogs
    .where('sessionId')
    .equals(sessionId)
    .filter((log) => log.routineExerciseId === exercise.id)
    .first()

  if (existing) return existing.id

  const now = new Date().toISOString()
  const log: ExerciseLog = {
    id: createId('exercise-log'),
    sessionId,
    routineExerciseId: exercise.id,
    state: 'pending',
    notes: '',
    snapshot: {
      assetKind: exercise.assetKind,
      customAssetId: exercise.customAssetId,
      name: exercise.name,
      canonicalName: exercise.canonicalName,
      mainMuscle: exercise.mainMuscle,
      equipment: exercise.equipment,
      loadMode: exercise.loadMode,
      barWeightKg: exercise.barWeightKg,
      targetSets: exercise.targetSets,
      repsMin: exercise.repsMin,
      repsMax: exercise.repsMax,
      recommendedRir: exercise.recommendedRir,
      restSeconds: exercise.restSeconds,
    },
    createdAt: now,
    updatedAt: now,
  }

  await db.exerciseLogs.add(log)

  return log.id
}

export async function saveMainSet(input: {
  displayUnit: WeightUnit
  exerciseLogId: string
  reps: number
  rir: number
  weightKg: number
}) {
  const now = new Date().toISOString()
  const order = await db.setLogs
    .where('exerciseLogId')
    .equals(input.exerciseLogId)
    .and((set) => set.kind === 'main')
    .count()

  const set: SetLog = {
    id: createId('set'),
    exerciseLogId: input.exerciseLogId,
    kind: 'main',
    order,
    weightKg: input.weightKg,
    displayUnit: input.displayUnit,
    reps: input.reps,
    rir: input.rir,
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', [db.setLogs, db.exerciseLogs], async () => {
    await db.setLogs.add(set)
    await refreshExerciseState(input.exerciseLogId)
  })

  return set.id
}

export async function registerMainSetForExercise(input: {
  date: string
  dayId: string
  displayUnit: WeightUnit
  dropSet?: {
    reps: number
    rir: number
    weightKg: number
  } | null
  exercise: RoutineExercise
  reps: number
  rir: number
  routineId: string
  weightKg: number
}) {
  const sessionId = await getOrCreateSessionForDay({
    date: input.date,
    dayId: input.dayId,
    displayUnit: input.displayUnit,
    routineId: input.routineId,
  })
  const exerciseLogId = await ensureExerciseLog(sessionId, input.exercise)
  const setLogId = await saveMainSet({
    displayUnit: input.displayUnit,
    exerciseLogId,
    reps: input.reps,
    rir: input.rir,
    weightKg: input.weightKg,
  })

  if (input.dropSet) {
    await addDropSet({
      displayUnit: input.displayUnit,
      reps: input.dropSet.reps,
      rir: input.dropSet.rir,
      setLogId,
      weightKg: input.dropSet.weightKg,
    })
  }

  await Promise.all([
    db.workoutSessions.update(sessionId, {
      updatedAt: new Date().toISOString(),
    }),
    db.routineExercises.update(input.exercise.id, {
      currentWeightKg: input.weightKg,
      updatedAt: new Date().toISOString(),
    }),
  ])

  return { exerciseLogId, sessionId, setLogId }
}

export async function addDropSet(input: {
  displayUnit: WeightUnit
  reps: number
  rir: number
  setLogId: string
  weightKg: number
}) {
  const now = new Date().toISOString()
  const order = await db.dropSetLogs.where('setLogId').equals(input.setLogId).count()
  const dropSet: DropSetLog = {
    id: createId('drop-set'),
    setLogId: input.setLogId,
    order,
    weightKg: input.weightKg,
    displayUnit: input.displayUnit,
    reps: input.reps,
    rir: input.rir,
    createdAt: now,
    updatedAt: now,
  }

  await db.dropSetLogs.add(dropSet)

  return dropSet.id
}

export async function updateDropSet(
  dropSetId: string,
  input: {
    reps: number
    rir: number
    weightKg: number
  },
) {
  const dropSet = await db.dropSetLogs.get(dropSetId)
  if (!dropSet) throw new Error('Drop set no encontrado')

  await db.dropSetLogs.update(dropSetId, {
    reps: input.reps,
    rir: input.rir,
    updatedAt: new Date().toISOString(),
    weightKg: input.weightKg,
  })
}

export async function deleteDropSet(dropSetId: string) {
  const dropSet = await db.dropSetLogs.get(dropSetId)
  if (!dropSet) throw new Error('Drop set no encontrado')

  await db.dropSetLogs.delete(dropSetId)
}

export async function skipExercise(sessionId: string, routineExerciseId: string, reason = '') {
  const now = new Date().toISOString()
  await db.transaction('rw', [db.skipLogs, db.exerciseLogs], async () => {
    await db.skipLogs.add({
      id: createId('skip'),
      sessionId,
      routineExerciseId,
      reason,
      createdAt: now,
    })

    const log = await db.exerciseLogs
      .where('sessionId')
      .equals(sessionId)
      .filter((candidate) => candidate.routineExerciseId === routineExerciseId)
      .first()
    if (log) {
      await db.exerciseLogs.update(log.id, { state: 'skipped', updatedAt: now })
    }
  })
}

export async function skipRoutineExerciseForDay(input: {
  date: string
  dayId: string
  displayUnit: WeightUnit
  exercise: RoutineExercise
  reason?: string
  routineId: string
}) {
  const sessionId = await getOrCreateSessionForDay({
    date: input.date,
    dayId: input.dayId,
    displayUnit: input.displayUnit,
    routineId: input.routineId,
  })
  await ensureExerciseLog(sessionId, input.exercise)
  await skipExercise(sessionId, input.exercise.id, input.reason)

  return sessionId
}

export async function updateSessionNotesForDay(input: {
  date: string
  dayId: string
  displayUnit: WeightUnit
  notes: string
  routineId: string
}) {
  const sessionId = await getOrCreateSessionForDay({
    date: input.date,
    dayId: input.dayId,
    displayUnit: input.displayUnit,
    routineId: input.routineId,
  })

  await db.workoutSessions.update(sessionId, {
    notes: input.notes,
    updatedAt: new Date().toISOString(),
  })

  return sessionId
}

export async function completeSessionForDay(input: {
  date: string
  dayId: string
  displayUnit: WeightUnit
  routineId: string
}) {
  const sessionId = await getOrCreateSessionForDay({
    date: input.date,
    dayId: input.dayId,
    displayUnit: input.displayUnit,
    routineId: input.routineId,
  })

  await db.workoutSessions.update(sessionId, {
    status: 'completed',
    updatedAt: new Date().toISOString(),
  })

  return sessionId
}

export async function reactivateExercise(sessionId: string, routineExerciseId: string) {
  await db.transaction('rw', [db.skipLogs, db.exerciseLogs, db.setLogs], async () => {
    await db.skipLogs
      .where('sessionId')
      .equals(sessionId)
      .filter((skip) => skip.routineExerciseId === routineExerciseId)
      .delete()

    const log = await db.exerciseLogs
      .where('sessionId')
      .equals(sessionId)
      .filter((candidate) => candidate.routineExerciseId === routineExerciseId)
      .first()
    if (log) {
      await refreshExerciseState(log.id)
    }
  })
}

export async function updateMainSet(
  setLogId: string,
  input: {
    reps: number
    rir: number
    weightKg: number
  },
) {
  const set = await db.setLogs.get(setLogId)
  if (!set) throw new Error('Serie no encontrada')

  await db.transaction('rw', [db.setLogs, db.exerciseLogs], async () => {
    await db.setLogs.update(setLogId, {
      reps: input.reps,
      rir: input.rir,
      updatedAt: new Date().toISOString(),
      weightKg: input.weightKg,
    })
    await refreshExerciseState(set.exerciseLogId)
  })
}

export async function updateWorkoutSession(
  sessionId: string,
  input: {
    date: string
    dayId: string
    routineId: string
  },
) {
  await db.workoutSessions.update(sessionId, {
    date: input.date,
    dayId: input.dayId,
    routineId: input.routineId,
    updatedAt: new Date().toISOString(),
  })
}

export async function moveMainSetToExercise(setLogId: string, routineExerciseId: string) {
  const set = await db.setLogs.get(setLogId)
  if (!set) throw new Error('Serie no encontrada')

  const currentLog = await db.exerciseLogs.get(set.exerciseLogId)
  if (!currentLog) throw new Error('Log de ejercicio no encontrado')

  const exercise = await db.routineExercises.get(routineExerciseId)
  if (!exercise) throw new Error('Ejercicio no encontrado')

  const nextLogId = await ensureExerciseLog(currentLog.sessionId, exercise)
  if (nextLogId === set.exerciseLogId) return

  const order = await db.setLogs
    .where('exerciseLogId')
    .equals(nextLogId)
    .and((candidate) => candidate.kind === 'main')
    .count()

  await db.transaction('rw', [db.setLogs, db.exerciseLogs], async () => {
    await db.setLogs.update(setLogId, {
      exerciseLogId: nextLogId,
      order,
      updatedAt: new Date().toISOString(),
    })
    await refreshExerciseState(set.exerciseLogId)
    await refreshExerciseState(nextLogId)
  })
}

export async function deleteMainSet(setLogId: string) {
  const set = await db.setLogs.get(setLogId)
  if (!set) throw new Error('Serie no encontrada')

  await db.transaction('rw', [db.setLogs, db.dropSetLogs, db.exerciseLogs], async () => {
    await db.dropSetLogs.where('setLogId').equals(setLogId).delete()
    await db.setLogs.delete(setLogId)
    await refreshExerciseState(set.exerciseLogId)
  })
}

export async function deleteWorkoutSession(sessionId: string) {
  const exerciseLogs = await db.exerciseLogs.where('sessionId').equals(sessionId).toArray()
  const exerciseLogIds = exerciseLogs.map((log) => log.id)
  const setLogs = exerciseLogIds.length > 0 ? await db.setLogs.where('exerciseLogId').anyOf(exerciseLogIds).toArray() : []
  const setLogIds = setLogs.map((set) => set.id)

  await db.transaction('rw', [db.workoutSessions, db.exerciseLogs, db.setLogs, db.dropSetLogs, db.skipLogs], async () => {
    await Promise.all(setLogIds.map((setLogId) => db.dropSetLogs.where('setLogId').equals(setLogId).delete()))
    await db.setLogs.bulkDelete(setLogIds)
    await db.exerciseLogs.bulkDelete(exerciseLogIds)
    await db.skipLogs.where('sessionId').equals(sessionId).delete()
    await db.workoutSessions.delete(sessionId)
  })
}

async function refreshExerciseState(exerciseLogId: string) {
  const log = await db.exerciseLogs.get(exerciseLogId)
  if (!log) return

  const mainSetCount = await db.setLogs
    .where('exerciseLogId')
    .equals(exerciseLogId)
    .and((set) => set.kind === 'main')
    .count()

  await db.exerciseLogs.update(exerciseLogId, {
    state: exerciseStateFromSets(mainSetCount, log.snapshot.targetSets, false),
    updatedAt: new Date().toISOString(),
  })
}
