import { useLiveQuery } from 'dexie-react-hooks'
import { getActiveRoutineBundle, getExerciseCatalog, getRoutineDayDetail, getRoutines, getWorkoutDayById, getWorkoutDayForDate } from './repository'

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

export function useRoutines() {
  return useLiveQuery(() => getRoutines(), [], undefined)
}
