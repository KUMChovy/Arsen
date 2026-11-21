import { useLiveQuery } from 'dexie-react-hooks'
import {
  getExistingSessionForDateAndDay,
  getProgressDayOptions,
  getProgressEditOptions,
  getProgressExerciseOptions,
  getProgressExerciseDetail,
  getProgressHistory,
  getProgressOverview,
  getProgressSummary,
  getSessionDetail,
  getSessionsForDate,
  getTrainingDates,
  type ProgressOverviewFilters,
} from './repository'

export function useProgressOverview(filters: ProgressOverviewFilters) {
  return useLiveQuery(() => getProgressOverview(filters), [filters.canonicalName, filters.dayId], undefined)
}

export function useProgressSummary(filters: ProgressOverviewFilters = {}) {
  return useLiveQuery(
    () => getProgressSummary(filters),
    [filters.canonicalName, filters.dayId, filters.period, filters.routineId],
    undefined,
  )
}

export function useProgressHistory(filters: ProgressOverviewFilters = {}) {
  return useLiveQuery(
    () => getProgressHistory(filters),
    [filters.canonicalName, filters.dayId, filters.period, filters.routineId],
    undefined,
  )
}

export function useProgressExerciseOptions(filters: Pick<ProgressOverviewFilters, 'dayId' | 'routineId'> = {}) {
  return useLiveQuery(() => getProgressExerciseOptions(filters), [filters.dayId], undefined)
}

export function useProgressExerciseDetail(canonicalName: string | null, filters: ProgressOverviewFilters = {}) {
  return useLiveQuery(
    () => (canonicalName ? getProgressExerciseDetail(canonicalName, filters) : Promise.resolve(null)),
    [canonicalName, filters.canonicalName, filters.dayId, filters.period, filters.routineId],
    undefined,
  )
}

export function useProgressDayOptions() {
  return useLiveQuery(() => getProgressDayOptions(), [], undefined)
}

export function useTrainingDates(filters: ProgressOverviewFilters = {}) {
  return useLiveQuery(() => getTrainingDates(filters), [filters.canonicalName, filters.dayId], undefined)
}

export function useExistingSessionForDateAndDay(date: string | undefined, dayId: string | null | undefined) {
  return useLiveQuery(
    () => (date && dayId ? getExistingSessionForDateAndDay(date, dayId) : Promise.resolve(null)),
    [date, dayId],
    undefined,
  )
}
export function useSessionDetail(sessionId: string | null, filters: ProgressOverviewFilters = {}) {
  return useLiveQuery(
    () => (sessionId ? getSessionDetail(sessionId, filters) : Promise.resolve(null)),
    [sessionId, filters.canonicalName, filters.dayId],
    undefined,
  )
}

export function useSessionsForDate(date: string | undefined, filters: ProgressOverviewFilters = {}) {
  return useLiveQuery(() => getSessionsForDate(date ?? '', filters), [date, filters.canonicalName, filters.dayId], undefined)
}

export function useProgressEditOptions() {
  return useLiveQuery(() => getProgressEditOptions(), [], undefined)
}
