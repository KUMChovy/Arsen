import { useLiveQuery } from 'dexie-react-hooks'
import { getHealthProgressOverview } from './repository'

export function useHealthProgressOverview(dayId?: string | null, enabled = true) {
  return useLiveQuery(() => (enabled ? getHealthProgressOverview(dayId) : Promise.resolve(null)), [dayId, enabled], undefined)
}
