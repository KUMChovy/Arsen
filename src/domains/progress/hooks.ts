import { useLiveQuery } from 'dexie-react-hooks'
import { getProgressExerciseOptions, getProgressOverview } from './repository'

export function useProgressOverview(canonicalName: string | null) {
  return useLiveQuery(() => getProgressOverview(canonicalName), [canonicalName], undefined)
}

export function useProgressExerciseOptions() {
  return useLiveQuery(() => getProgressExerciseOptions(), [], undefined)
}
