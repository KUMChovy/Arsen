import type { DropSetLog, SetLog } from '../workout/types'

export type ProgressMetricKey = 'weight' | 'reps' | 'volume' | 'estimatedOneRm'
export type ProgressPeriodKey = '4w' | '8w' | '12w' | 'all'

export type ProgressDateRange = {
  end: string
  start: string
}

export type ProgressSetInput = Pick<SetLog, 'kind' | 'reps' | 'weightKg'>
export type ProgressDropSetInput = Pick<DropSetLog, 'reps' | 'weightKg'>

export type ExerciseSessionInput = {
  date: string
  dropSets: ProgressDropSetInput[]
  sessionId: string
  sets: ProgressSetInput[]
}

export type ExerciseSessionAggregate = {
  date: string
  estimatedOneRmKg: number | null
  mainSetCount: number
  maxReps: number | null
  maxWeightKg: number | null
  sessionId: string
  volumeKg: number
}

export type WeeklyVolumePoint = ProgressDateRange & {
  volumeKg: number
}

export function estimatedOneRm(set: Pick<SetLog, 'reps' | 'weightKg'>) {
  if (!isValidLoad(set.weightKg) || !Number.isInteger(set.reps) || set.reps < 1 || set.reps > 12) return null
  if (set.reps === 1) return { kind: 'direct' as const, valueKg: set.weightKg }

  return { kind: 'estimated' as const, valueKg: set.weightKg * (1 + set.reps / 30) }
}

export function aggregateExerciseSession(input: ExerciseSessionInput): ExerciseSessionAggregate {
  const mainSets = input.sets.filter((set) => set.kind === 'main' && isValidSet(set))
  const validDropSets = input.dropSets.filter(isValidSet)
  const oneRepMaxes = mainSets
    .map((set) => estimatedOneRm(set))
    .filter((value): value is NonNullable<ReturnType<typeof estimatedOneRm>> => value !== null)

  return {
    date: input.date,
    estimatedOneRmKg: oneRepMaxes.length > 0 ? Math.max(...oneRepMaxes.map((value) => value.valueKg)) : null,
    mainSetCount: mainSets.length,
    maxReps: mainSets.length > 0 ? Math.max(...mainSets.map((set) => set.reps)) : null,
    maxWeightKg: mainSets.length > 0 ? Math.max(...mainSets.map((set) => set.weightKg)) : null,
    sessionId: input.sessionId,
    volumeKg: [...mainSets, ...validDropSets].reduce((total, set) => total + set.weightKg * set.reps, 0),
  }
}

export function getPeriodBounds(dates: string[], period: ProgressPeriodKey) {
  const sortedDates = dates.filter(isDateKey).sort()
  const latestDate = sortedDates.at(-1) ?? ''
  if (!latestDate) return { current: { end: '', start: '' }, previous: null }
  if (period === 'all') return { current: { end: latestDate, start: sortedDates[0] ?? latestDate }, previous: null }

  const weeks = Number(period.slice(0, -1))
  const currentEnd = parseDateKey(latestDate)
  const currentStart = addDays(currentEnd, -(weeks * 7 - 1))
  const previousEnd = addDays(currentStart, -1)
  const previousStart = addDays(previousEnd, -(weeks * 7 - 1))

  return {
    current: { end: latestDate, start: toDateKey(currentStart) },
    previous: { end: toDateKey(previousEnd), start: toDateKey(previousStart) },
  }
}

export function buildWeeklyVolume(sessions: Array<{ date: string; volumeKg: number }>, range: ProgressDateRange): WeeklyVolumePoint[] {
  const points = new Map<string, WeeklyVolumePoint>()
  for (const session of sessions) {
    if (!isDateKey(session.date) || session.date < range.start || session.date > range.end) continue
    const date = parseDateKey(session.date)
    const start = addDays(date, -((date.getDay() + 6) % 7))
    const startKey = toDateKey(start)
    const endKey = toDateKey(addDays(start, 6))
    const current = points.get(startKey)
    points.set(startKey, {
      end: endKey,
      start: startKey,
      volumeKg: (current?.volumeKg ?? 0) + session.volumeKg,
    })
  }

  return [...points.values()].sort((a, b) => a.start.localeCompare(b.start))
}

function isValidSet(set: { reps: number; weightKg: number }) {
  return isValidLoad(set.weightKg) && Number.isInteger(set.reps) && set.reps > 0
}

function isValidLoad(value: number) {
  return Number.isFinite(value) && value > 0
}

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDateKey(value).getTime())
}

function parseDateKey(value: string) {
  return new Date(`${value}T12:00:00`)
}

function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10)
}

function addDays(value: Date, days: number) {
  const result = new Date(value)
  result.setDate(result.getDate() + days)
  return result
}
