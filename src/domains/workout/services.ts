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
      name: exercise.name,
      canonicalName: exercise.canonicalName,
      mainMuscle: exercise.mainMuscle,
      equipment: exercise.equipment,
      targetSets: exercise.targetSets,
      repRange: exercise.repRange,
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
