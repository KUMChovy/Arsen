import { useLiveQuery } from 'dexie-react-hooks'
import { getProgressOverview } from './repository'

export function useProgressOverview() {
  return useLiveQuery(() => getProgressOverview(), [], undefined)
}
