import { canonicalName } from '../../shared/utils/normalize'

type ComparisonInput = {
  exercises: Array<{ canonicalName?: string; exerciseName: string; sets: Array<{ dropSets: Array<{ reps: number; weightKg: number }>; reps: number; weightKg: number }> }>
  id: string
}

export type SessionComparison = {
  comparable: boolean
  leftSessionId: string
  leftVolumeKg: number
  limitation: string | null
  rightSessionId: string
  rightVolumeKg: number
  sharedExercises: string[]
  volumeDeltaKg: number
}

export function compareSessions(left: ComparisonInput, right: ComparisonInput): SessionComparison {
  const leftNames = new Set(left.exercises.map((exercise) => exercise.canonicalName ?? canonicalName(exercise.exerciseName)))
  const rightNames = new Set(right.exercises.map((exercise) => exercise.canonicalName ?? canonicalName(exercise.exerciseName)))
  const sharedExercises = [...leftNames].filter((name) => rightNames.has(name)).sort()
  const leftVolumeKg = volume(left)
  const rightVolumeKg = volume(right)
  return {
    comparable: sharedExercises.length > 0,
    leftSessionId: left.id,
    leftVolumeKg,
    limitation: sharedExercises.length > 0 ? null : 'Estas sesiones no comparten ejercicios, así que el volumen total no es directamente comparable.',
    rightSessionId: right.id,
    rightVolumeKg,
    sharedExercises,
    volumeDeltaKg: rightVolumeKg - leftVolumeKg,
  }
}

function volume(session: ComparisonInput) {
  return session.exercises.reduce((total, exercise) => total + exercise.sets.reduce((setsTotal, set) => setsTotal + set.weightKg * set.reps + set.dropSets.reduce((dropsTotal, drop) => dropsTotal + drop.weightKg * drop.reps, 0), 0), 0)
}
