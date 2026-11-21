import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getHealthProgressOverview } from './repository'
import { syncCurrentWorkoutHealth } from './services'

const HEALTH_AUTO_SYNC_INTERVAL_MS = 45_000

export function useHealthProgressOverview(dayId?: string | null, enabled = true) {
  return useLiveQuery(() => (enabled ? getHealthProgressOverview(dayId) : Promise.resolve(null)), [dayId, enabled], undefined)
}

export function useHealthAutoSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    let disposed = false
    let inFlight: Promise<unknown> | null = null
    const syncCurrentHealth = () => {
      if (disposed || document.visibilityState !== 'visible' || inFlight) return
      inFlight = syncCurrentWorkoutHealth()
        .catch(() => undefined)
        .finally(() => {
          inFlight = null
        })
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncCurrentHealth()
    }
    const handleFocus = () => syncCurrentHealth()
    const intervalId = window.setInterval(syncCurrentHealth, HEALTH_AUTO_SYNC_INTERVAL_MS)

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    syncCurrentHealth()

    return () => {
      disposed = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [enabled])
}
