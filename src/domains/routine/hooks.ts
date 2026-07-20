import { useLiveQuery } from 'dexie-react-hooks'
import { getActiveRoutineBundle, getWorkoutDayForDate } from './repository'

export function useActiveRoutineBundle() {
  return useLiveQuery(() => getActiveRoutineBundle(), [], undefined)
}

export function useWorkoutDay(date: Date) {
  const dateKey = date.toISOString().slice(0, 10)

  return useLiveQuery(() => getWorkoutDayForDate(new Date(`${dateKey}T12:00:00`)), [dateKey], undefined)
}
