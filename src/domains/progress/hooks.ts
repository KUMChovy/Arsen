import { useLiveQuery } from 'dexie-react-hooks'
import {
  getProgressDayOptions,
  getProgressEditOptions,
  getProgressExerciseOptions,
  getProgressOverview,
  getSessionDetail,
  getSessionsForDate,
  getTrainingDates,
  type ProgressOverviewFilters,
} from './repository'

export function useProgressOverview(filters: ProgressOverviewFilters) {
  return useLiveQuery(() => getProgressOverview(filters), [filters.canonicalName, filters.dayId], undefined)
}

export function useProgressExerciseOptions(filters: Pick<ProgressOverviewFilters, 'dayId'> = {}) {
  return useLiveQuery(() => getProgressExerciseOptions(filters), [filters.dayId], undefined)
}

export function useProgressDayOptions() {
  return useLiveQuery(() => getProgressDayOptions(), [], undefined)
}

export function useTrainingDates(filters: ProgressOverviewFilters = {}) {
  return useLiveQuery(() => getTrainingDates(filters), [filters.canonicalName, filters.dayId], undefined)
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
