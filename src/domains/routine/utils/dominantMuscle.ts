import type { RoutineExercise, MuscleGroup } from '../types'
import { normalizeMuscleGroup } from './muscles'

export function dominantMuscleForExercises(exercises: Pick<RoutineExercise, 'mainMuscle' | 'order'>[]): MuscleGroup {
  if (exercises.length === 0) return 'Pecho'

  const counts = new Map<MuscleGroup, number>()
  const firstOrder = new Map<MuscleGroup, number>()

  for (const exercise of exercises) {
    const muscle = normalizeMuscleGroup(exercise.mainMuscle)
    counts.set(muscle, (counts.get(muscle) ?? 0) + 1)
    firstOrder.set(muscle, Math.min(firstOrder.get(muscle) ?? exercise.order, exercise.order))
  }

  return [...counts.entries()].reduce<MuscleGroup>((bestMuscle, [muscle, count]) => {
    const bestCount = counts.get(bestMuscle) ?? 0
    if (count > bestCount) return muscle
    if (count < bestCount) return bestMuscle

    return (firstOrder.get(muscle) ?? 0) < (firstOrder.get(bestMuscle) ?? 0) ? muscle : bestMuscle
  }, normalizeMuscleGroup(exercises[0]?.mainMuscle))
}
