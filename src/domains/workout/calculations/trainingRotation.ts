import type { RoutineDay } from '../../routine/types'

export const MISSED_TRAINING_DAY_THRESHOLD = 2

export type SessionWithMainSets = {
  date: string
  dayId: string
  routineId: string
}

export function getDefaultWorkoutDayId(days: RoutineDay[], weekday: number) {
  const orderedDays = orderDays(days)
  return orderedDays.find((day) => day.weekday === weekday)?.id ?? orderedDays[0]?.id ?? null
}

export function getNextRotationDay(days: RoutineDay[], lastDayId: string | null, fallbackDayId: string | null) {
  const orderedDays = orderDays(days)
  if (orderedDays.length === 0) return null

  const latestIndex = lastDayId ? orderedDays.findIndex((day) => day.id === lastDayId) : -1
  if (latestIndex >= 0) return orderedDays[(latestIndex + 1) % orderedDays.length] ?? null

  return orderedDays.find((day) => day.id === fallbackDayId) ?? orderedDays[0] ?? null
}

export function calendarDaysBetween(fromDate: string, toDate: string) {
  return Math.max(0, Math.round((dateMs(toDate) - dateMs(fromDate)) / 86_400_000))
}

export function getLatestSessionWithMainSets(sessions: SessionWithMainSets[]) {
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}

export function buildMissedTrainingNotice(input: {
  activeRoutineId: string
  days: RoutineDay[]
  sessionsWithMainSets: SessionWithMainSets[]
  todayDate: string
  todayWeekday: number
  threshold?: number
}) {
  const threshold = input.threshold ?? MISSED_TRAINING_DAY_THRESHOLD
  const latestSession = getLatestSessionWithMainSets(input.sessionsWithMainSets)
  const activeRoutineDayIds = new Set(input.days.map((day) => day.id))
  const latestActiveRoutineSession = getLatestSessionWithMainSets(
    input.sessionsWithMainSets.filter(
      (session) => session.routineId === input.activeRoutineId && activeRoutineDayIds.has(session.dayId),
    ),
  )
  const fallbackDayId = getDefaultWorkoutDayId(input.days, input.todayWeekday)
  const nextDay = getNextRotationDay(
    input.days,
    latestActiveRoutineSession?.dayId ?? null,
    fallbackDayId,
  )
  const daysWithoutTraining = latestSession ? calendarDaysBetween(latestSession.date, input.todayDate) : 0
  const missedScheduledDay = latestActiveRoutineSession
    ? hasMissedAnchoredWeekday(input.days, input.sessionsWithMainSets, latestActiveRoutineSession.date, input.todayDate, input.todayWeekday)
    : false

  return {
    daysWithoutTraining,
    missedScheduledDay,
    nextDay,
    shouldShow: daysWithoutTraining >= threshold || missedScheduledDay,
  }
}

function orderDays(days: RoutineDay[]) {
  return [...days].sort((a, b) => a.order - b.order)
}

function hasMissedAnchoredWeekday(
  days: RoutineDay[],
  sessionsWithMainSets: SessionWithMainSets[],
  latestDate: string,
  todayDate: string,
  todayWeekday: number,
) {
  if (!days.some((day) => day.weekday === todayWeekday)) return false

  type AnchoredWeekday = Exclude<RoutineDay['weekday'], null>
  const anchoredWeekdays = new Set(days.flatMap((day) => (day.weekday === null ? [] : [day.weekday])))
  const trainedDates = new Set(sessionsWithMainSets.map((session) => session.date))
  for (let time = dateMs(latestDate) + 86_400_000; time < dateMs(todayDate); time += 86_400_000) {
    const date = new Date(time)
    const dateKey = date.toISOString().slice(0, 10)
    if (anchoredWeekdays.has(date.getUTCDay() as AnchoredWeekday) && !trainedDates.has(dateKey)) return true
  }

  return false
}

function dateMs(date: string) {
  return Date.parse(`${date}T00:00:00.000Z`)
}
