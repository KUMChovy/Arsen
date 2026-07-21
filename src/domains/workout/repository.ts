import { db } from '../../db/schema'
import { getWeightIncreaseRecommendation } from '../../shared/calculations/progression'
import type { RoutineExercise } from '../routine/types'

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
