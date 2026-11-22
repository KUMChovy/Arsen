import { db } from '../../db/schema'
import type { Routine, RoutineDay, RoutineExercise } from '../routine/types'
import { bestSet, performanceScore, totalVolume } from '../../shared/calculations/workout'
import { canonicalName } from '../../shared/utils/normalize'
import {
  aggregateExerciseSession,
  buildWeeklyVolume,
  estimatedOneRm,
  getPeriodBounds,
  type ExerciseSessionAggregate,
  type ProgressDateRange,
  type ProgressPeriodKey,
} from './calculations'
import type { HealthSummary } from '../health/types'
import type { DropSetLog, ExerciseLog, SetLog, WorkoutSession } from '../workout/types'

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
  dayNames: string[]
  lastTrainedDate: string | null
  mainMuscle: string | null
  name: string
  routineNames: string[]
  sessions: number
}

export type ProgressDayOption = {
  dayId: string
  name: string
  routineId: string
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
  canonicalName?: string
  exerciseLogId: string
  exerciseName: string
  mainMuscle: string
  notes?: string
  routineExerciseId: string
  warmupSets?: Array<{ id: string; order: number; reps: number; rir: number; weightKg: number; displayUnit: string }>
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
  completedAt?: string | null
  createdAt: string
  date: string
  dayId: string
  dayName: string
  displayUnit: 'kg' | 'lb'
  exercises: SessionExerciseDetail[]
  id: string
  health?: HealthSummary
  lastExerciseAt?: string | null
  notes: string
  routineId: string
  routineName: string
  startedAt?: string | null
  status: 'draft' | 'completed'
  updatedAt: string
}

export type ProgressEditOptions = {
  days: Array<{ id: string; name: string; routineId: string; routineName: string }>
  exercises: Array<{ dayId: string; id: string; name: string; routineId: string }>
  routines: Array<{ id: string; name: string }>
}

export type ProgressOverviewFilters = {
  canonicalName?: string | null
  dayId?: string | null
  period?: ProgressPeriodKey
  routineId?: string | null
}

export type ProgressDataset = {
  days: RoutineDay[]
  dropSetLogs: DropSetLog[]
  exerciseLogs: ExerciseLog[]
  routineExercises: RoutineExercise[]
  routines: Routine[]
  sessions: WorkoutSession[]
  setLogs: SetLog[]
}

export type ProgressSessionAggregate = ExerciseSessionAggregate & {
  dayId: string
  dayName: string
  exerciseCount: number
  routineId: string
  routineName: string
}

export type ProgressSummary = {
  averageVolumeKg: number
  currentPeriod: ProgressDateRange
  previousAverageVolumeKg: number | null
  previousPeriod: ProgressDateRange | null
  previousSessionCount: number
  previousSessions: ProgressSessionAggregate[]
  previousTotalSets: number
  previousVolumeKg: number
  sessionCount: number
  sessions: ProgressSessionAggregate[]
  totalSets: number
  volumeKg: number
  weeklyVolume: ReturnType<typeof buildWeeklyVolume>
}

export type ProgressHistoryFilters = ProgressOverviewFilters

export type HistoryFilters = {
  canonicalName?: string | null
  dayId?: string | null
  endDate?: string | null
  period?: ProgressPeriodKey
  routineId?: string | null
  search?: string | null
  startDate?: string | null
  status?: WorkoutSession['status'] | null
}

export type HistorySessionSummary = {
  bestSetId: string | null
  bestSetLabel: string
  date: string
  dayId: string
  dayName: string
  dropSetCount: number
  exerciseCount: number
  mainSetCount: number
  notes: string
  routineId: string
  routineName: string
  sessionId: string
  status: WorkoutSession['status']
  volumeKg: number
}

export type HistorySummary = {
  distinctTrainingDays: number
  exercises: number
  mainSets: number
  sessions: number
  volumeKg: number
}

export type HistoryResult = {
  sessions: HistorySessionSummary[]
  summary: HistorySummary
}

export type PersonalRecord = {
  canonicalName: string
  date: string
  estimatedOneRmKg: number | null
  exerciseName: string
  sessionId: string
  weightKg: number
}

export type ProgressExerciseSession = ExerciseSessionAggregate & {
  bestSetId: string | null
  bestSetLabel: string
  dayName: string
  routineName: string
}

export type ProgressExerciseDetail = {
  bestEstimatedOneRmKg: number | null
  bundledAssetId: string | null
  canonicalName: string
  lastSessionDate: string | null
  mainMuscle: string | null
  maxWeightKg: number
  name: string
  sessionCount: number
  sessions: ProgressExerciseSession[]
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
        dayName: session.dayName ?? dayById.get(session.dayId) ?? 'Dia eliminado',
        exerciseCount: logs.length,
        id: session.id,
        routineName: session.routineName ?? routineById.get(session.routineId) ?? 'Rutina eliminada',
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
export async function getProgressExerciseOptions(
  filters: Pick<ProgressOverviewFilters, 'dayId' | 'routineId'> = {},
): Promise<ProgressExerciseOption[]> {
  const [sessions, exerciseLogs, routines, days] = await Promise.all([
    db.workoutSessions.toArray(),
    db.exerciseLogs.toArray(),
    db.routines.toArray(),
    db.routineDays.toArray(),
  ])
  const visibleSessions = sessions.filter(
    (session) => (!filters.dayId || session.dayId === filters.dayId) && (!filters.routineId || session.routineId === filters.routineId),
  )
  const visibleSessionIds = new Set(visibleSessions.map((session) => session.id))
  const routineById = new Map(routines.map((routine) => [routine.id, routine.name]))
  const dayById = new Map(days.map((day) => [day.id, day.name]))
  const options = new Map<string, ProgressExerciseOption>()
  const sessionsByExercise = new Map<string, Set<string>>()
  const contextsByExercise = new Map<string, { days: Set<string>; routines: Set<string> }>()

  for (const log of exerciseLogs) {
    if (!visibleSessionIds.has(log.sessionId)) continue

    const key = log.snapshot.canonicalName
    const sessions = sessionsByExercise.get(key) ?? new Set<string>()
    sessions.add(log.sessionId)
    sessionsByExercise.set(key, sessions)
    const session = visibleSessions.find((candidate) => candidate.id === log.sessionId)
    const context = contextsByExercise.get(key) ?? { days: new Set<string>(), routines: new Set<string>() }
    if (session) {
      context.days.add(session.dayName ?? dayById.get(session.dayId) ?? 'Día eliminado')
      context.routines.add(session.routineName ?? routineById.get(session.routineId) ?? 'Rutina eliminada')
    }
    contextsByExercise.set(key, context)
    const existing = options.get(key)
    const lastTrainedDate = session?.date ?? existing?.lastTrainedDate ?? null
    options.set(key, {
      bundledAssetId: log.snapshot.bundledAssetId ?? null,
      canonicalName: key,
      dayNames: [...context.days].sort((a, b) => a.localeCompare(b)),
      lastTrainedDate: !lastTrainedDate || !existing?.lastTrainedDate
        ? lastTrainedDate
        : lastTrainedDate > existing.lastTrainedDate
          ? lastTrainedDate
          : existing.lastTrainedDate,
      mainMuscle: log.snapshot.mainMuscle ?? null,
      name: log.snapshot.name,
      routineNames: [...context.routines].sort((a, b) => a.localeCompare(b)),
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
      routineId: session.routineId,
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
    completedAt: session.completedAt,
    createdAt: session.createdAt,
    date: session.date,
    dayId: session.dayId,
    dayName: session.dayName ?? day?.name ?? 'Dia eliminado',
    displayUnit: session.displayUnit,
    exercises: visibleExerciseLogs.map((log) => ({
      bundledAssetId: log.snapshot.bundledAssetId ?? null,
      canonicalName: log.snapshot.canonicalName,
      exerciseLogId: log.id,
      exerciseName: log.snapshot.name,
      mainMuscle: log.snapshot.mainMuscle,
      notes: log.notes,
      routineExerciseId: log.routineExerciseId,
      warmupSets: setLogs
        .filter((set) => set.kind === 'warmup' && set.exerciseLogId === log.id)
        .sort((a, b) => a.order - b.order)
        .map(({ id, order, reps, rir, weightKg, displayUnit }) => ({ id, order, reps, rir, weightKg, displayUnit })),
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
    health: session.health,
    lastExerciseAt: session.lastExerciseAt,
    notes: session.notes,
    routineId: session.routineId,
    routineName: session.routineName ?? routine?.name ?? 'Rutina eliminada',
    startedAt: session.startedAt,
    status: session.status,
    updatedAt: session.updatedAt,
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

export async function getProgressDataset(): Promise<ProgressDataset> {
  const [days, dropSetLogs, exerciseLogs, routineExercises, routines, sessions, setLogs] = await Promise.all([
    db.routineDays.toArray(),
    db.dropSetLogs.toArray(),
    db.exerciseLogs.toArray(),
    db.routineExercises.toArray(),
    db.routines.toArray(),
    db.workoutSessions.orderBy('date').toArray(),
    db.setLogs.toArray(),
  ])

  return { days, dropSetLogs, exerciseLogs, routineExercises, routines, sessions, setLogs }
}

export async function getProgressSummary(filters: ProgressOverviewFilters = {}): Promise<ProgressSummary> {
  const dataset = await getProgressDataset()
  const records = buildProgressSessionRecords(dataset, filters)
  const period = filters.period ?? '4w'
  const bounds = getPeriodBounds(records.map((record) => record.date), period)
  const currentRecords = records.filter((record) => inRange(record.date, bounds.current))
  const previousRecords = bounds.previous ? records.filter((record) => inRange(record.date, bounds.previous!)) : []
  const currentTotals = summarizeSessionRecords(currentRecords)
  const previousTotals = summarizeSessionRecords(previousRecords)

  return {
    averageVolumeKg: currentRecords.length > 0 ? currentTotals.volumeKg / currentRecords.length : 0,
    currentPeriod: bounds.current,
    previousAverageVolumeKg: previousRecords.length > 0 ? previousTotals.volumeKg / previousRecords.length : null,
    previousPeriod: bounds.previous,
    previousSessionCount: previousRecords.length,
    previousSessions: previousRecords.map(({ bestSet: _bestSet, ...record }) => record),
    previousTotalSets: previousTotals.totalSets,
    previousVolumeKg: previousTotals.volumeKg,
    sessionCount: currentRecords.length,
    sessions: currentRecords.map(({ bestSet: _bestSet, ...record }) => record),
    totalSets: currentTotals.totalSets,
    volumeKg: currentTotals.volumeKg,
    weeklyVolume: buildWeeklyVolume(currentRecords, bounds.current),
  }
}

export async function getProgressHistory(filters: ProgressHistoryFilters = {}): Promise<RecentSessionSummary[]> {
  const dataset = await getProgressDataset()
  return buildProgressSessionRecords(dataset, filters)
    .map((record): RecentSessionSummary => ({
      bestSetId: record.bestSet?.id ?? null,
      bestSetLabel: record.bestSet ? `${record.bestSet.weightKg} kg x ${record.bestSet.reps}` : 'Sin series',
      date: record.date,
      dayName: record.dayName,
      exerciseCount: record.exerciseCount,
      id: record.sessionId,
      routineName: record.routineName,
      setCount: record.mainSetCount,
      volumeKg: record.volumeKg,
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

export async function getHistory(filters: HistoryFilters = {}): Promise<HistoryResult> {
  const dataset = await getProgressDataset()
  const routineById = new Map(dataset.routines.map((routine) => [routine.id, routine.name]))
  const dayById = new Map(dataset.days.map((day) => [day.id, day.name]))
  const logsBySession = groupBy(dataset.exerciseLogs, (log) => log.sessionId)
  const setsByLog = groupBy(dataset.setLogs, (set) => set.exerciseLogId)
  const dropsBySet = groupBy(dataset.dropSetLogs, (dropSet) => dropSet.setLogId)
  const search = filters.search ? canonicalName(filters.search) : ''
  const records = dataset.sessions
    .map((session): HistorySessionSummary | null => {
      if (filters.routineId && session.routineId !== filters.routineId) return null
      if (filters.dayId && session.dayId !== filters.dayId) return null
      if (filters.status && session.status !== filters.status) return null
      if (filters.startDate && session.date < filters.startDate) return null
      if (filters.endDate && session.date > filters.endDate) return null

      const routineName = session.routineName ?? routineById.get(session.routineId) ?? 'Rutina eliminada'
      const dayName = session.dayName ?? dayById.get(session.dayId) ?? 'Dia eliminado'
      const logs = logsBySession.get(session.id) ?? []
      const visibleLogs = filters.canonicalName
        ? logs.filter((log) => log.snapshot.canonicalName === filters.canonicalName)
        : logs
      const searchableText = [routineName, dayName, ...logs.flatMap((log) => [log.snapshot.name, log.snapshot.canonicalName])]
        .map((value) => canonicalName(value))
        .join(' ')
      if (search && !searchableText.includes(search)) return null
      if (filters.canonicalName && visibleLogs.length === 0) return null

      const mainSets = visibleLogs.flatMap((log) => setsByLog.get(log.id) ?? []).filter((set) => set.kind === 'main')
      const dropSets = mainSets.flatMap((set) => dropsBySet.get(set.id) ?? [])
      const aggregate = aggregateExerciseSession({ date: session.date, dropSets, sessionId: session.id, sets: mainSets })
      const best = bestSet(mainSets)

      return {
        bestSetId: best?.id ?? null,
        bestSetLabel: best ? `${best.weightKg} kg x ${best.reps}` : 'Sin series',
        date: session.date,
        dayId: session.dayId,
        dayName,
        dropSetCount: dropSets.length,
        exerciseCount: visibleLogs.length,
        mainSetCount: aggregate.mainSetCount,
        notes: session.notes,
        routineId: session.routineId,
        routineName,
        sessionId: session.id,
        status: session.status,
        volumeKg: aggregate.volumeKg,
      }
    })
    .filter((record): record is HistorySessionSummary => record !== null)

  const scopedRecords = filters.period && filters.period !== 'all'
    ? (() => {
        const bounds = getPeriodBounds(records.map((record) => record.date), filters.period)
        return records.filter((record) => inRange(record.date, bounds.current))
      })()
    : records
  const sessions = scopedRecords.sort((a, b) => b.date.localeCompare(a.date) || b.sessionId.localeCompare(a.sessionId))
  const performanceSessions = sessions.filter((session) => session.status === 'completed')

  return {
    sessions,
    summary: {
      distinctTrainingDays: new Set(performanceSessions.map((session) => session.date)).size,
      exercises: performanceSessions.reduce((total, session) => total + session.exerciseCount, 0),
      mainSets: performanceSessions.reduce((total, session) => total + session.mainSetCount, 0),
      sessions: sessions.length,
      volumeKg: performanceSessions.reduce((total, session) => total + session.volumeKg, 0),
    },
  }
}

export async function getPersonalRecords(filters: Pick<HistoryFilters, 'canonicalName' | 'dayId' | 'routineId'> = {}): Promise<PersonalRecord[]> {
  const dataset = await getProgressDataset()
  const sessions = new Map(dataset.sessions.filter((session) => session.status === 'completed' && (!filters.dayId || session.dayId === filters.dayId) && (!filters.routineId || session.routineId === filters.routineId)).map((session) => [session.id, session]))
  const logsBySession = groupBy(dataset.exerciseLogs, (log) => log.sessionId)
  const setsByLog = groupBy(dataset.setLogs, (set) => set.exerciseLogId)
  const records = new Map<string, PersonalRecord>()
  for (const [sessionId, logs] of logsBySession) {
    const session = sessions.get(sessionId)
    if (!session) continue
    for (const log of logs) {
      if (filters.canonicalName && log.snapshot.canonicalName !== filters.canonicalName) continue
      const sets = (setsByLog.get(log.id) ?? []).filter((set) => set.kind === 'main')
      const best = bestSet(sets)
      if (!best) continue
      const candidate: PersonalRecord = { canonicalName: log.snapshot.canonicalName, date: session.date, estimatedOneRmKg: estimatedOneRm(best)?.valueKg ?? null, exerciseName: log.snapshot.name, sessionId, weightKg: best.weightKg }
      const current = records.get(candidate.canonicalName)
      if (!current || candidate.weightKg > current.weightKg || (candidate.weightKg === current.weightKg && (candidate.estimatedOneRmKg ?? 0) > (current.estimatedOneRmKg ?? 0))) records.set(candidate.canonicalName, candidate)
    }
  }
  return [...records.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName))
}

export async function getProgressExerciseDetail(canonicalName: string, filters: ProgressOverviewFilters = {}): Promise<ProgressExerciseDetail | null> {
  if (!canonicalName) return null
  const dataset = await getProgressDataset()
  const records = buildExerciseSessionRecords(dataset, canonicalName, filters)
  const bounds = getPeriodBounds(records.map((record) => record.date), filters.period ?? '4w')
  const sessions = records.filter((record) => inRange(record.date, bounds.current))
  const sourceLog = dataset.exerciseLogs.find((log) => log.snapshot.canonicalName === canonicalName)
  if (!sourceLog || sessions.length === 0) return null

  return {
    bestEstimatedOneRmKg: maxOrNull(sessions.map((session) => session.estimatedOneRmKg)),
    bundledAssetId: sourceLog.snapshot.bundledAssetId ?? null,
    canonicalName,
    lastSessionDate: sessions.at(-1)?.date ?? null,
    mainMuscle: sourceLog.snapshot.mainMuscle ?? null,
    maxWeightKg: Math.max(...sessions.map((session) => session.maxWeightKg ?? 0)),
    name: sourceLog.snapshot.name,
    sessionCount: sessions.length,
    sessions,
  }
}

type ProgressSessionRecord = ProgressSessionAggregate & {
  bestSet: SetLog | null
}

function buildProgressSessionRecords(dataset: ProgressDataset, filters: ProgressOverviewFilters) {
  const sessionById = new Map(dataset.sessions.map((session) => [session.id, session]))
  const routineById = new Map(dataset.routines.map((routine) => [routine.id, routine.name]))
  const dayById = new Map(dataset.days.map((day) => [day.id, day.name]))
  const logsBySession = new Map<string, ExerciseLog[]>()
  const setsByLog = new Map<string, SetLog[]>()
  const dropsBySet = new Map<string, DropSetLog[]>()

  for (const log of dataset.exerciseLogs) {
    if (filters.canonicalName && log.snapshot.canonicalName !== filters.canonicalName) continue
    const current = logsBySession.get(log.sessionId)
    if (current) current.push(log)
    else logsBySession.set(log.sessionId, [log])
  }
  for (const set of dataset.setLogs) {
    const current = setsByLog.get(set.exerciseLogId)
    if (current) current.push(set)
    else setsByLog.set(set.exerciseLogId, [set])
  }
  for (const dropSet of dataset.dropSetLogs) {
    const current = dropsBySet.get(dropSet.setLogId)
    if (current) current.push(dropSet)
    else dropsBySet.set(dropSet.setLogId, [dropSet])
  }

  return [...logsBySession.entries()]
    .map(([sessionId, logs]): ProgressSessionRecord | null => {
      const session = sessionById.get(sessionId)
      if (!session || (filters.dayId && session.dayId !== filters.dayId) || (filters.routineId && session.routineId !== filters.routineId)) return null
      const mainSets = logs.flatMap((log) => setsByLog.get(log.id) ?? []).filter((set) => set.kind === 'main')
      const dropSets = mainSets.flatMap((set) => dropsBySet.get(set.id) ?? [])
      if (mainSets.length === 0) return null
      const aggregate = aggregateExerciseSession({ date: session.date, dropSets, sessionId, sets: mainSets })
      return {
        ...aggregate,
        bestSet: bestSet(mainSets),
        dayId: session.dayId,
        dayName: session.dayName ?? dayById.get(session.dayId) ?? 'Día eliminado',
        exerciseCount: logs.length,
        routineId: session.routineId,
        routineName: session.routineName ?? routineById.get(session.routineId) ?? 'Rutina eliminada',
      }
    })
    .filter((record): record is ProgressSessionRecord => record !== null)
}

function buildExerciseSessionRecords(dataset: ProgressDataset, canonicalName: string, filters: ProgressOverviewFilters) {
  const sessionById = new Map(dataset.sessions.map((session) => [session.id, session]))
  const routineById = new Map(dataset.routines.map((routine) => [routine.id, routine.name]))
  const dayById = new Map(dataset.days.map((day) => [day.id, day.name]))
  const logsBySession = new Map<string, ExerciseLog[]>()
  const setsByLog = new Map<string, SetLog[]>()
  const dropsBySet = new Map<string, DropSetLog[]>()

  for (const log of dataset.exerciseLogs) {
    if (log.snapshot.canonicalName !== canonicalName) continue
    const current = logsBySession.get(log.sessionId)
    if (current) current.push(log)
    else logsBySession.set(log.sessionId, [log])
  }
  for (const set of dataset.setLogs) {
    const current = setsByLog.get(set.exerciseLogId)
    if (current) current.push(set)
    else setsByLog.set(set.exerciseLogId, [set])
  }
  for (const dropSet of dataset.dropSetLogs) {
    const current = dropsBySet.get(dropSet.setLogId)
    if (current) current.push(dropSet)
    else dropsBySet.set(dropSet.setLogId, [dropSet])
  }

  return [...logsBySession.entries()]
    .map(([sessionId, logs]): ProgressExerciseSession | null => {
      const session = sessionById.get(sessionId)
      if (!session || (filters.dayId && session.dayId !== filters.dayId) || (filters.routineId && session.routineId !== filters.routineId)) return null
      const mainSets = logs.flatMap((log) => setsByLog.get(log.id) ?? []).filter((set) => set.kind === 'main')
      if (mainSets.length === 0) return null
      const dropSets = mainSets.flatMap((set) => dropsBySet.get(set.id) ?? [])
      const aggregate = aggregateExerciseSession({ date: session.date, dropSets, sessionId, sets: mainSets })
      const best = bestSet(mainSets)
      return {
        ...aggregate,
        bestSetId: best?.id ?? null,
        bestSetLabel: best ? `${best.weightKg} kg x ${best.reps}` : 'Sin series',
        dayName: session.dayName ?? dayById.get(session.dayId) ?? 'Día eliminado',
        routineName: session.routineName ?? routineById.get(session.routineId) ?? 'Rutina eliminada',
      }
    })
    .filter((record): record is ProgressExerciseSession => record !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
}

function summarizeSessionRecords(records: ProgressSessionRecord[]) {
  return {
    totalSets: records.reduce((total, record) => total + record.mainSetCount, 0),
    volumeKg: records.reduce((total, record) => total + record.volumeKg, 0),
  }
}

function inRange(date: string, range: ProgressDateRange) {
  return Boolean(range.start && range.end && date >= range.start && date <= range.end)
}

function maxOrNull(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value))
  return valid.length > 0 ? Math.max(...valid) : null
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))
}

function dropSetsForSets<TSet extends { id: string }>(sets: TSet[], dropSetBySetId: Map<string, DropSetLog[]>) {
  return sets.flatMap((set) => dropSetBySetId.get(set.id) ?? [])
}

function groupBy<T>(values: T[], keyOf: (value: T) => string) {
  const groups = new Map<string, T[]>()
  for (const value of values) {
    const key = keyOf(value)
    const group = groups.get(key)
    if (group) group.push(value)
    else groups.set(key, [value])
  }
  return groups
}
