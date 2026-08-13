import { db } from '../../db/schema'
import { bestSet, performanceScore, totalVolume } from '../../shared/calculations/workout'
import type { DropSetLog } from '../workout/types'

export type ProgressPoint = {
  date: string
  score: number
}

export type ProgressOverview = {
  bestSetLabel: string
  bestMarks: ProgressBestMark[]
  bundledAssetId: string | null
  chartData: ProgressPoint[]
  exerciseName: string
  mainMuscle: string | null
  lastSessionDate: string | null
  maxWeightKg: number
  recentSessions: RecentSessionSummary[]
  sessionCount: number
  totalSets: number
  volumeKg: number
}

export type ProgressExerciseOption = {
  bundledAssetId: string | null
  canonicalName: string
  mainMuscle: string | null
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
  dayName: string
  exerciseCount: number
  id: string
  routineName: string
  setCount: number
  volumeKg: number
}

export type ProgressBestMark = {
  date: string
  exerciseName: string
  id: string
  label: string
  score: number
  weightKg: number
}

export type SessionExerciseDetail = {
  bundledAssetId: string | null
  exerciseLogId: string
  exerciseName: string
  mainMuscle: string
  routineExerciseId: string
  sets: Array<{
    displayUnit: string
    dropSets: Array<{
      id: string
      order: number
      reps: number
      rir: number
      weightKg: number
    }>
    id: string
    order: number
    reps: number
    rir: number
    weightKg: number
  }>
}

export type SessionDetail = {
  date: string
  dayId: string
  dayName: string
  exercises: SessionExerciseDetail[]
  id: string
  routineId: string
  routineName: string
}

export type ProgressEditOptions = {
  days: Array<{ id: string; name: string; routineId: string; routineName: string }>
  exercises: Array<{ dayId: string; id: string; name: string; routineId: string }>
  routines: Array<{ id: string; name: string }>
}

export type ProgressOverviewFilters = {
  canonicalName?: string | null
  dayId?: string | null
}

export async function getProgressOverview(filters: ProgressOverviewFilters = {}): Promise<ProgressOverview> {
  const [allSessions, exerciseLogs, setLogs, dropSetLogs, routines, days] = await Promise.all([
    db.workoutSessions.orderBy('date').toArray(),
    db.exerciseLogs.toArray(),
    db.setLogs.toArray(),
    db.dropSetLogs.toArray(),
    db.routines.toArray(),
    db.routineDays.toArray(),
  ])
  const sessions = filters.dayId ? allSessions.filter((session) => session.dayId === filters.dayId) : allSessions
  const sessionIds = new Set(sessions.map((session) => session.id))
  const filteredExerciseLogs = filters.canonicalName
    ? exerciseLogs.filter((log) => sessionIds.has(log.sessionId) && log.snapshot.canonicalName === filters.canonicalName)
    : exerciseLogs.filter((log) => sessionIds.has(log.sessionId))
  const filteredExerciseLogIds = new Set(filteredExerciseLogs.map((log) => log.id))
  const filteredSessionIds = new Set(filteredExerciseLogs.map((log) => log.sessionId))
  const firstExerciseLog = filteredExerciseLogs[0]
  const bundledAssetId = firstExerciseLog?.snapshot.bundledAssetId ?? null
  const exerciseName = firstExerciseLog?.snapshot.name ?? 'Sin registros'
  const mainMuscle = firstExerciseLog?.snapshot.mainMuscle ?? null
  const mainSets = setLogs.filter((set) => set.kind === 'main' && filteredExerciseLogIds.has(set.exerciseLogId))
  const best = bestSet(mainSets)
  const bestSetLabel = best ? `${best.weightKg} kg x ${best.reps}` : 'Sin series'
  const maxWeightKg = mainSets.reduce((max, set) => Math.max(max, set.weightKg), 0)
  const dropSetBySetId = new Map<string, typeof dropSetLogs>()
  for (const dropSet of dropSetLogs) {
    const current = dropSetBySetId.get(dropSet.setLogId)
    if (current) current.push(dropSet)
    else dropSetBySetId.set(dropSet.setLogId, [dropSet])
  }
  const volumeKg = totalVolume(mainSets, dropSetsForSets(mainSets, dropSetBySetId))
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const logById = new Map(filteredExerciseLogs.map((log) => [log.id, log]))
  const routineById = new Map(routines.map((routine) => [routine.id, routine.name]))
  const dayById = new Map(days.map((day) => [day.id, day.name]))
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

  const bestMarks = mainSets
    .map((set): ProgressBestMark | null => {
      const log = logById.get(set.exerciseLogId)
      if (!log) return null
      const session = sessionById.get(log.sessionId)
      if (!session) return null
      const score = Math.round(performanceScore(set) * 100) / 100

      return {
        date: session.date,
        exerciseName: log.snapshot.name,
        id: set.id,
        label: `${set.weightKg} kg x ${set.reps}`,
        score,
        weightKg: set.weightKg,
      }
    })
    .filter((mark): mark is ProgressBestMark => mark !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const chartData = [...bestScoreByDate.entries()]
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, score]) => ({
      date: formatShortDate(date),
      score,
    }))
  const recentSessionSource = filters.canonicalName ? sessions.filter((session) => filteredSessionIds.has(session.id)) : sessions
  const recentSessions = recentSessionSource
    .map((session): RecentSessionSummary => {
      const logs = logsBySessionId.get(session.id) ?? []
      const sessionSets = logs.flatMap((log) => setsByExerciseLogId.get(log.id) ?? [])
      const bestSessionSet = bestSet(sessionSets)

      return {
        bestSetId: bestSessionSet?.id ?? null,
        bestSetLabel: bestSessionSet ? `${bestSessionSet.weightKg} kg x ${bestSessionSet.reps}` : 'Sin series',
        date: session.date,
        dayName: dayById.get(session.dayId) ?? 'Dia eliminado',
        exerciseCount: logs.length,
        id: session.id,
        routineName: routineById.get(session.routineId) ?? 'Rutina eliminada',
        setCount: sessionSets.length,
        volumeKg: totalVolume(sessionSets, dropSetsForSets(sessionSets, dropSetBySetId)),
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))

  return {
    bestMarks,
    bestSetLabel,
    bundledAssetId,
    chartData,
    exerciseName,
    mainMuscle,
    lastSessionDate: recentSessions[0]?.date ?? null,
    maxWeightKg,
    recentSessions,
    sessionCount: filteredSessionIds.size,
    totalSets: mainSets.length,
    volumeKg,
  }
}

export async function getTrainingDates(filters: ProgressOverviewFilters = {}): Promise<string[]> {
  const overview = await getProgressOverview(filters)

  return [...new Set(overview.recentSessions.map((session) => session.date))].sort((a, b) => b.localeCompare(a))
}

export async function getSessionsForDate(date: string, filters: ProgressOverviewFilters = {}): Promise<RecentSessionSummary[]> {
  if (!date) return []

  const overview = await getProgressOverview(filters)

  return overview.recentSessions.filter((session) => session.date === date)
}

export async function getExistingSessionForDateAndDay(date: string, dayId: string): Promise<RecentSessionSummary | null> {
  if (!date || !dayId) return null

  const sessions = await getSessionsForDate(date, { dayId })

  return sessions.find((session) => session.date === date) ?? null
}
export async function getProgressExerciseOptions(filters: Pick<ProgressOverviewFilters, 'dayId'> = {}): Promise<ProgressExerciseOption[]> {
  const [sessions, exerciseLogs] = await Promise.all([db.workoutSessions.toArray(), db.exerciseLogs.toArray()])
  const visibleSessionIds = filters.dayId ? new Set(sessions.filter((session) => session.dayId === filters.dayId).map((session) => session.id)) : null
  const options = new Map<string, ProgressExerciseOption>()
  const sessionsByExercise = new Map<string, Set<string>>()

  for (const log of exerciseLogs) {
    if (visibleSessionIds && !visibleSessionIds.has(log.sessionId)) continue

    const key = log.snapshot.canonicalName
    const sessions = sessionsByExercise.get(key) ?? new Set<string>()
    sessions.add(log.sessionId)
    sessionsByExercise.set(key, sessions)
    options.set(key, {
      bundledAssetId: log.snapshot.bundledAssetId ?? null,
      canonicalName: key,
      mainMuscle: log.snapshot.mainMuscle ?? null,
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
  const dayById = new Map(days.map((day) => [day.id, day]))
  const optionsByDay = new Map<string, ProgressDayOption>()

  for (const session of sessions) {
    const day = dayById.get(session.dayId)
    const current = optionsByDay.get(session.dayId)
    optionsByDay.set(session.dayId, {
      dayId: session.dayId,
      name: current?.name ?? day?.name ?? 'Dia eliminado',
      routineName: current?.routineName ?? routineById.get(session.routineId) ?? 'Rutina eliminada',
      sessions: (current?.sessions ?? 0) + 1,
    })
  }

  return [...optionsByDay.values()]
    .sort((a, b) => a.routineName.localeCompare(b.routineName) || a.name.localeCompare(b.name))
}

export async function getSessionDetail(sessionId: string, filters: ProgressOverviewFilters = {}): Promise<SessionDetail | null> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return null
  if (filters.dayId && session.dayId !== filters.dayId) return null

  const [routine, day, exerciseLogs] = await Promise.all([
    db.routines.get(session.routineId),
    db.routineDays.get(session.dayId),
    db.exerciseLogs.where('sessionId').equals(session.id).toArray(),
  ])
  const visibleExerciseLogs = filters.canonicalName
    ? exerciseLogs.filter((log) => log.snapshot.canonicalName === filters.canonicalName)
    : exerciseLogs
  const exerciseLogIds = visibleExerciseLogs.map((log) => log.id)
  const setLogs = exerciseLogIds.length > 0 ? await db.setLogs.where('exerciseLogId').anyOf(exerciseLogIds).toArray() : []
  const setLogIds = setLogs.map((set) => set.id)
  const dropSets = setLogIds.length > 0 ? await db.dropSetLogs.where('setLogId').anyOf(setLogIds).toArray() : []
  const dropSetsBySetId = new Map<string, typeof dropSets>()

  for (const dropSet of dropSets) {
    const current = dropSetsBySetId.get(dropSet.setLogId)
    if (current) current.push(dropSet)
    else dropSetsBySetId.set(dropSet.setLogId, [dropSet])
  }

  return {
    date: session.date,
    dayId: session.dayId,
    dayName: day?.name ?? 'Dia eliminado',
    exercises: visibleExerciseLogs.map((log) => ({
      bundledAssetId: log.snapshot.bundledAssetId ?? null,
      exerciseLogId: log.id,
      exerciseName: log.snapshot.name,
      mainMuscle: log.snapshot.mainMuscle,
      routineExerciseId: log.routineExerciseId,
      sets: setLogs
        .filter((set) => set.kind === 'main' && set.exerciseLogId === log.id)
        .sort((a, b) => a.order - b.order)
        .map((set) => ({
          displayUnit: set.displayUnit,
          dropSets: (dropSetsBySetId.get(set.id) ?? [])
            .sort((a, b) => a.order - b.order)
            .map((dropSet) => ({
              id: dropSet.id,
              order: dropSet.order,
              reps: dropSet.reps,
              rir: dropSet.rir,
              weightKg: dropSet.weightKg,
            })),
          id: set.id,
          order: set.order,
          reps: set.reps,
          rir: set.rir,
          weightKg: set.weightKg,
        })),
    })),
    id: session.id,
    routineId: session.routineId,
    routineName: routine?.name ?? 'Rutina eliminada',
  }
}

export async function getProgressEditOptions(): Promise<ProgressEditOptions> {
  const [routines, days, exercises] = await Promise.all([
    db.routines.orderBy('updatedAt').reverse().toArray(),
    db.routineDays.toArray(),
    db.routineExercises.toArray(),
  ])
  const routineById = new Map(routines.map((routine) => [routine.id, routine.name]))

  return {
    days: days
      .sort((a, b) => a.routineId.localeCompare(b.routineId) || a.order - b.order)
      .map((day) => ({
        id: day.id,
        name: day.name,
        routineId: day.routineId,
        routineName: routineById.get(day.routineId) ?? 'Rutina eliminada',
      })),
    exercises: exercises
      .sort((a, b) => a.dayId.localeCompare(b.dayId) || a.order - b.order)
      .map((exercise) => ({
        dayId: exercise.dayId,
        id: exercise.id,
        name: exercise.name,
        routineId: exercise.routineId,
      })),
    routines: routines.map((routine) => ({ id: routine.id, name: routine.name })),
  }
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))
}

function dropSetsForSets<TSet extends { id: string }>(sets: TSet[], dropSetBySetId: Map<string, DropSetLog[]>) {
  return sets.flatMap((set) => dropSetBySetId.get(set.id) ?? [])
}
