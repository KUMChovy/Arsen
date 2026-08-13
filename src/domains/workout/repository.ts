import { db } from '../../db/schema'
import { getWeightIncreaseRecommendation } from '../../shared/calculations/progression'
import type { RoutineExercise } from '../routine/types'
import type { SessionWithMainSets } from './calculations/trainingRotation'
import type { LastSessionReference } from './types'

export async function getWorkoutProgressForDay(date: string, dayId: string | undefined) {
  if (!dayId) return null

  const session = await db.workoutSessions.where('[date+dayId]').equals([date, dayId]).first()
  if (!session) {
    return {
      dropSets: [],
      exerciseLogs: [],
      session: null,
      setLogs: [],
      skipLogs: [],
    }
  }

  const [exerciseLogs, skipLogs] = await Promise.all([
    db.exerciseLogs.where('sessionId').equals(session.id).toArray(),
    db.skipLogs.where('sessionId').equals(session.id).toArray(),
  ])
  const exerciseLogIds = exerciseLogs.map((log) => log.id)
  const setLogs = exerciseLogIds.length > 0 ? await db.setLogs.where('exerciseLogId').anyOf(exerciseLogIds).toArray() : []
  const setLogIds = setLogs.map((set) => set.id)
  const dropSets = setLogIds.length > 0 ? await db.dropSetLogs.where('setLogId').anyOf(setLogIds).toArray() : []

  return { dropSets, exerciseLogs, session, setLogs, skipLogs }
}

export async function getLastSessionReferencesForDay(input: {
  date: string
  dayId: string | undefined
  exercises: RoutineExercise[]
  routineId: string | undefined
}) {
  if (!input.dayId || !input.routineId || input.exercises.length === 0) return new Map<string, LastSessionReference>()

  const exerciseIds = input.exercises.map((exercise) => exercise.id)
  const sessions = (await db.workoutSessions.where('routineId').equals(input.routineId).toArray())
    .filter((session) => session.dayId === input.dayId && session.date < input.date)
    .sort((a, b) => b.date.localeCompare(a.date))
  if (sessions.length === 0) return new Map<string, LastSessionReference>()

  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const exerciseLogs = (await db.exerciseLogs.where('routineExerciseId').anyOf(exerciseIds).toArray()).filter((log) => sessionById.has(log.sessionId))
  if (exerciseLogs.length === 0) return new Map<string, LastSessionReference>()

  const setLogs = await db.setLogs.where('exerciseLogId').anyOf(exerciseLogs.map((log) => log.id)).toArray()
  const mainSets = setLogs.filter((set) => set.kind === 'main').sort((a, b) => a.order - b.order)
  const dropSetLogs = mainSets.length > 0 ? await db.dropSetLogs.where('setLogId').anyOf(mainSets.map((set) => set.id)).toArray() : []
  const dropsBySetId = new Map<string, typeof dropSetLogs>()
  for (const dropSet of dropSetLogs.sort((a, b) => a.order - b.order)) {
    const drops = dropsBySetId.get(dropSet.setLogId)
    if (drops) drops.push(dropSet)
    else dropsBySetId.set(dropSet.setLogId, [dropSet])
  }

  const setsByLogId = new Map<string, typeof mainSets>()
  for (const set of mainSets) {
    const sets = setsByLogId.get(set.exerciseLogId)
    if (sets) sets.push(set)
    else setsByLogId.set(set.exerciseLogId, [set])
  }

  const logsByExerciseId = new Map<string, typeof exerciseLogs>()
  for (const log of exerciseLogs) {
    const logs = logsByExerciseId.get(log.routineExerciseId)
    if (logs) logs.push(log)
    else logsByExerciseId.set(log.routineExerciseId, [log])
  }

  const references = new Map<string, LastSessionReference>()
  for (const exercise of input.exercises) {
    const logs = logsByExerciseId.get(exercise.id) ?? []
    for (const session of sessions) {
      const log = logs.find((candidate) => candidate.sessionId === session.id)
      if (!log) continue

      const sets = setsByLogId.get(log.id) ?? []
      if (sets.length === 0) continue

      references.set(exercise.id, {
        date: session.date,
        sets: sets.map((set) => ({
          dropSets: dropsBySetId.get(set.id) ?? [],
          set,
        })),
      })
      break
    }
  }

  return references
}

export async function getWeightIncreaseRecommendations(exercises: RoutineExercise[]) {
  if (exercises.length === 0) return []

  const [sessions, exerciseLogs] = await Promise.all([
    db.workoutSessions.orderBy('date').toArray(),
    db.exerciseLogs
      .where('routineExerciseId')
      .anyOf(exercises.map((exercise) => exercise.id))
      .toArray(),
  ])
  const exerciseLogIds = exerciseLogs.map((log) => log.id)
  const setLogs = exerciseLogIds.length > 0 ? await db.setLogs.where('exerciseLogId').anyOf(exerciseLogIds).toArray() : []
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const setsByLogId = new Map<string, typeof setLogs>()

  for (const set of setLogs) {
    const current = setsByLogId.get(set.exerciseLogId)
    if (current) current.push(set)
    else setsByLogId.set(set.exerciseLogId, [set])
  }

  return exercises.flatMap((exercise) => {
    const progressionSessions = exerciseLogs
      .filter((log) => log.routineExerciseId === exercise.id)
      .flatMap((log) => {
        const session = sessionById.get(log.sessionId)
        if (!session) return []

        return [
          {
            date: session.date,
            sets: setsByLogId.get(log.id) ?? [],
          },
        ]
      })

    const recommendation = getWeightIncreaseRecommendation(exercise, progressionSessions)

    return recommendation ? [recommendation] : []
  })
}

export async function getSessionsWithMainSets(): Promise<SessionWithMainSets[]> {
  const [sessions, exerciseLogs, setLogs] = await Promise.all([
    db.workoutSessions.toArray(),
    db.exerciseLogs.toArray(),
    db.setLogs.where('kind').equals('main').toArray(),
  ])
  const logById = new Map(exerciseLogs.map((log) => [log.id, log]))
  const sessionIdsWithMainSets = new Set(
    setLogs.flatMap((set) => {
      const log = logById.get(set.exerciseLogId)
      return log ? [log.sessionId] : []
    }),
  )

  return sessions
    .filter((session) => sessionIdsWithMainSets.has(session.id))
    .map((session) => ({
      date: session.date,
      dayId: session.dayId,
      routineId: session.routineId,
    }))
}
