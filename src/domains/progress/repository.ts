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

export type RecentSessionSummary = {
  bestSetId: string | null
  bestSetLabel: string
  date: string
  exerciseCount: number
  id: string
  setCount: number
  volumeKg: number
}

export async function getProgressOverview(): Promise<ProgressOverview> {
  const [sessions, exerciseLogs, setLogs, dropSetLogs] = await Promise.all([
    db.workoutSessions.orderBy('date').toArray(),
    db.exerciseLogs.toArray(),
    db.setLogs.toArray(),
    db.dropSetLogs.toArray(),
  ])
  const firstExerciseLog = exerciseLogs[0]
  const exerciseName = firstExerciseLog?.snapshot.name ?? 'Sin registros'
  const mainSets = setLogs.filter((set) => set.kind === 'main')
  const best = bestSet(mainSets)
  const bestSetLabel = best ? `${best.weightKg} kg x ${best.reps}` : 'Sin series'
  const maxWeightKg = mainSets.reduce((max, set) => Math.max(max, set.weightKg), 0)
  const volumeKg = totalVolume(mainSets, dropSetLogs)
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const logById = new Map(exerciseLogs.map((log) => [log.id, log]))
  const logsBySessionId = new Map<string, typeof exerciseLogs>()
  const setsByExerciseLogId = new Map<string, typeof setLogs>()
  const bestScoreByDate = new Map<string, number>()

  for (const log of exerciseLogs) {
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
    lastSessionDate: sessions.at(-1)?.date ?? null,
    maxWeightKg,
    recentSessions,
    sessionCount: sessions.length,
    totalSets: mainSets.length,
    volumeKg,
  }
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))
}
