import { useLiveQuery } from 'dexie-react-hooks'
import { getProgressDayOptions, getProgressExerciseOptions, getProgressOverview, type ProgressOverviewFilters } from './repository'

export function useProgressOverview(filters: ProgressOverviewFilters) {
  return useLiveQuery(() => getProgressOverview(filters), [filters.canonicalName, filters.dayId], undefined)
}

export function useProgressExerciseOptions() {
  return useLiveQuery(() => getProgressExerciseOptions(), [], undefined)
}

export function useProgressDayOptions() {
  return useLiveQuery(() => getProgressDayOptions(), [], undefined)
}
