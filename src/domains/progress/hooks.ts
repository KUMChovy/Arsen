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

export function useProgressExerciseOptions() {
  return useLiveQuery(() => getProgressExerciseOptions(), [], undefined)
}

export function useProgressDayOptions() {
  return useLiveQuery(() => getProgressDayOptions(), [], undefined)
}

export function useTrainingDates() {
  return useLiveQuery(() => getTrainingDates(), [], undefined)
}

export function useSessionDetail(sessionId: string | null) {
  return useLiveQuery(() => (sessionId ? getSessionDetail(sessionId) : Promise.resolve(null)), [sessionId], undefined)
}

export function useSessionsForDate(date: string | undefined) {
  return useLiveQuery(() => getSessionsForDate(date ?? ''), [date], undefined)
}

export function useProgressEditOptions() {
  return useLiveQuery(() => getProgressEditOptions(), [], undefined)
}
