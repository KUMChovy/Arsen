import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { getActiveRoutineBundle, getExerciseAssets, getExerciseCatalog, getRoutineDayDetail, getRoutines, getRoutineSummaries, getWorkoutDayById, getWorkoutDayForDate } from './repository'
import { startCatalogScheduler } from './catalogScheduler'
import { syncRemoteCatalog } from './syncRemoteCatalog'
import { readRemoteCatalog } from './remoteCatalogCache'

export function useGlobalCatalog() {
  return useLiveQuery(() => readRemoteCatalog(), [], undefined)
}

export function useGlobalCatalogSync(ready: boolean) {
  useEffect(() => {
    const origin = import.meta.env.VITE_CATALOG_API_ORIGIN
    if (!ready || !origin) return
    const scheduler = startCatalogScheduler(() => syncRemoteCatalog(origin))
    return () => scheduler.stop()
  }, [ready])
}

export function useActiveRoutineBundle() {
  return useLiveQuery(() => getActiveRoutineBundle(), [], undefined)
}

export function useWorkoutDay(date: Date) {
  const dateKey = date.toISOString().slice(0, 10)

  return useLiveQuery(() => getWorkoutDayForDate(new Date(`${dateKey}T12:00:00`)), [dateKey], undefined)
}

export function useWorkoutDayById(dayId: string | null) {
  return useLiveQuery(() => getWorkoutDayById(dayId), [dayId], undefined)
}

export function useRoutineDayDetail(dayId: string | null) {
  return useLiveQuery(() => getRoutineDayDetail(dayId), [dayId], undefined)
}

export function useExerciseCatalog() {
  return useLiveQuery(() => getExerciseCatalog(), [], undefined)
}

export function useExerciseAssets() {
  return useLiveQuery(() => getExerciseAssets(), [], undefined)
}

export function useRoutines() {
  return useLiveQuery(() => getRoutines(), [], undefined)
}

export function useRoutineSummaries() {
  return useLiveQuery(() => getRoutineSummaries(), [], undefined)
}
