import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { RoutineExercise } from '../routine/types'
import type { ExerciseState } from './types'
import { getWeightIncreaseRecommendations, getWorkoutProgressForDay } from './repository'

export function useWorkoutProgress(date: string, dayId: string | undefined, exercises: RoutineExercise[]) {
  const progress = useLiveQuery(() => getWorkoutProgressForDay(date, dayId), [date, dayId], undefined)

  return useMemo(() => {
    const exerciseLogByExerciseId = new Map(progress?.exerciseLogs.map((log) => [log.routineExerciseId, log]) ?? [])
    const setsByExerciseLogId = new Map<string, number>()

    for (const set of progress?.setLogs ?? []) {
      if (set.kind !== 'main') continue
      setsByExerciseLogId.set(set.exerciseLogId, (setsByExerciseLogId.get(set.exerciseLogId) ?? 0) + 1)
    }

    const stateByExerciseId = new Map<string, ExerciseState>()
    for (const exercise of exercises) {
      const log = exerciseLogByExerciseId.get(exercise.id)
      stateByExerciseId.set(exercise.id, log?.state ?? 'pending')
    }

    let completedCount = 0
    let inProgressCount = 0
    let skippedCount = 0
    for (const state of stateByExerciseId.values()) {
      if (state === 'done') completedCount += 1
      if (state === 'in_progress') inProgressCount += 1
      if (state === 'skipped') skippedCount += 1
    }

    const pendingCount = Math.max(exercises.length - completedCount - inProgressCount - skippedCount, 0)

    return {
      completedCount,
      dropSets: progress?.dropSets ?? [],
      exerciseLogByExerciseId,
      inProgressCount,
      pendingCount,
      progress,
      setLogs: progress?.setLogs ?? [],
      setsByExerciseLogId,
      skippedCount,
      stateByExerciseId,
    }
  }, [exercises, progress])
}

export function useWeightIncreaseRecommendations(exercises: RoutineExercise[]) {
  const exerciseKey = exercises
    .map((exercise) => [exercise.id, exercise.targetSets, exercise.repsMin, exercise.repsMax, exercise.recommendedRir, exercise.equipment].join(':'))
    .join('|')

  return useLiveQuery(() => getWeightIncreaseRecommendations(exercises), [exerciseKey], undefined) ?? []
}
