import { db } from '../../db/schema'

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
