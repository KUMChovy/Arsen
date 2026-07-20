import { db } from '../../db/schema'
import { bestSet, performanceScore, totalVolume } from '../../shared/calculations/workout'

export type ProgressPoint = {
  date: string
  score: number
}

export type ProgressOverview = {
  bestSetLabel: string
  chartData: ProgressPoint[]
  exerciseName: string
  lastSessionDate: string | null
  maxWeightKg: number
  recentSessions: RecentSessionSummary[]
  sessionCount: number
  totalSets: number
  volumeKg: number
}

export type ProgressExerciseOption = {
  canonicalName: string
  name: string
  sessions: number
}

export type ProgressDayOption = {
  dayId: string
  name: string
  routineName: string
  sessions: number
}

export type RecentSessionSummary = {
  bestSetId: string | null
  bestSetLabel: string
  date: string
  exerciseCount: number
  id: string
  setCount: number
  volumeKg: number
}

export type ProgressOverviewFilters = {
  canonicalName?: string | null
  dayId?: string | null
}

export async function getProgressOverview(filters: ProgressOverviewFilters = {}): Promise<ProgressOverview> {
  const [allSessions, exerciseLogs, setLogs, dropSetLogs] = await Promise.all([
    db.workoutSessions.orderBy('date').toArray(),
    db.exerciseLogs.toArray(),
    db.setLogs.toArray(),
    db.dropSetLogs.toArray(),
  ])
  const sessions = filters.dayId ? allSessions.filter((session) => session.dayId === filters.dayId) : allSessions
  const sessionIds = new Set(sessions.map((session) => session.id))
  const filteredExerciseLogs = filters.canonicalName
    ? exerciseLogs.filter((log) => sessionIds.has(log.sessionId) && log.snapshot.canonicalName === filters.canonicalName)
    : exerciseLogs.filter((log) => sessionIds.has(log.sessionId))
  const filteredExerciseLogIds = new Set(filteredExerciseLogs.map((log) => log.id))
  const filteredSessionIds = new Set(filteredExerciseLogs.map((log) => log.sessionId))
  const firstExerciseLog = filteredExerciseLogs[0]
  const exerciseName = firstExerciseLog?.snapshot.name ?? 'Sin registros'
  const mainSets = setLogs.filter((set) => set.kind === 'main' && filteredExerciseLogIds.has(set.exerciseLogId))
  const best = bestSet(mainSets)
  const bestSetLabel = best ? `${best.weightKg} kg x ${best.reps}` : 'Sin series'
  const maxWeightKg = mainSets.reduce((max, set) => Math.max(max, set.weightKg), 0)
  const volumeKg = totalVolume(mainSets, dropSetLogs)
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const logById = new Map(filteredExerciseLogs.map((log) => [log.id, log]))
  const logsBySessionId = new Map<string, typeof filteredExerciseLogs>()
  const setsByExerciseLogId = new Map<string, typeof setLogs>()
  const bestScoreByDate = new Map<string, number>()

  for (const log of filteredExerciseLogs) {
    const current = logsBySessionId.get(log.sessionId)
    if (current) current.push(log)
    else logsBySessionId.set(log.sessionId, [log])
  }

  for (const set of mainSets) {
    const current = setsByExerciseLogId.get(set.exerciseLogId)
    if (current) current.push(set)
    else setsByExerciseLogId.set(set.exerciseLogId, [set])
  }

  for (const set of mainSets) {
    const log = logById.get(set.exerciseLogId)
    if (!log) continue
    const session = sessionById.get(log.sessionId)
    if (!session) continue

    const score = Math.round(performanceScore(set))
    const currentScore = bestScoreByDate.get(session.date) ?? 0
    if (score > currentScore) {
      bestScoreByDate.set(session.date, score)
    }
  }

  const chartData = [...bestScoreByDate.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, score]) => ({
      date: formatShortDate(date),
      score,
    }))
  const recentSessions = sessions
    .map((session): RecentSessionSummary => {
      const logs = logsBySessionId.get(session.id) ?? []
      const sessionSets = logs.flatMap((log) => setsByExerciseLogId.get(log.id) ?? [])
      const bestSessionSet = bestSet(sessionSets)

      return {
        bestSetId: bestSessionSet?.id ?? null,
        bestSetLabel: bestSessionSet ? `${bestSessionSet.weightKg} kg x ${bestSessionSet.reps}` : 'Sin series',
        date: session.date,
        exerciseCount: logs.length,
        id: session.id,
        setCount: sessionSets.length,
        volumeKg: totalVolume(sessionSets, dropSetLogs),
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8)

  return {
    bestSetLabel,
    chartData,
    exerciseName,
    lastSessionDate: recentSessions[0]?.date ?? null,
    maxWeightKg,
    recentSessions,
    sessionCount: filteredSessionIds.size,
    totalSets: mainSets.length,
    volumeKg,
  }
}

export async function getProgressExerciseOptions(): Promise<ProgressExerciseOption[]> {
  const exerciseLogs = await db.exerciseLogs.toArray()
  const options = new Map<string, ProgressExerciseOption>()
  const sessionsByExercise = new Map<string, Set<string>>()

  for (const log of exerciseLogs) {
    const key = log.snapshot.canonicalName
    const sessions = sessionsByExercise.get(key) ?? new Set<string>()
    sessions.add(log.sessionId)
    sessionsByExercise.set(key, sessions)
    options.set(key, {
      canonicalName: key,
      name: log.snapshot.name,
      sessions: sessions.size,
    })
  }

  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export async function getProgressDayOptions(): Promise<ProgressDayOption[]> {
  const [routines, days, sessions] = await Promise.all([
    db.routines.toArray(),
    db.routineDays.toArray(),
    db.workoutSessions.toArray(),
  ])
  const routineById = new Map(routines.map((routine) => [routine.id, routine.name]))
  const sessionsByDay = new Map<string, number>()

  for (const session of sessions) {
    sessionsByDay.set(session.dayId, (sessionsByDay.get(session.dayId) ?? 0) + 1)
  }

  return days
    .map((day) => ({
      dayId: day.id,
      name: day.name,
      routineName: routineById.get(day.routineId) ?? 'Rutina eliminada',
      sessions: sessionsByDay.get(day.id) ?? 0,
    }))
    .filter((option) => option.sessions > 0)
    .sort((a, b) => a.routineName.localeCompare(b.routineName) || a.name.localeCompare(b.name))
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))
}
