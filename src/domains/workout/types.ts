export type ExerciseState = 'pending' | 'in_progress' | 'skipped' | 'done'
export type SetKind = 'main' | 'warmup'
export type WeightUnit = 'kg' | 'lb'

export type WorkoutSession = {
  id: string
  routineId: string
  dayId: string
  date: string
  notes: string
  displayUnit: WeightUnit
  status: 'draft' | 'completed'
  createdAt: string
  updatedAt: string
}

export type ExerciseSnapshot = {
  name: string
  canonicalName: string
  mainMuscle: string
  equipment: string
  targetSets: number
  repsMin: number
  repsMax: number
  recommendedRir: number
  restSeconds: number
}

export type ExerciseLog = {
  id: string
  sessionId: string
  routineExerciseId: string
  state: ExerciseState
  notes: string
  snapshot: ExerciseSnapshot
  createdAt: string
  updatedAt: string
}

export type SetLog = {
  id: string
  exerciseLogId: string
  kind: SetKind
  order: number
  weightKg: number
  displayUnit: WeightUnit
  reps: number
  rir: number
  createdAt: string
  updatedAt: string
}

export type DropSetLog = {
  id: string
  setLogId: string
  order: number
  weightKg: number
  displayUnit: WeightUnit
  reps: number
  rir: number
  createdAt: string
  updatedAt: string
}

export type SkipLog = {
  id: string
  sessionId: string
  routineExerciseId: string
  reason: string
  createdAt: string
}
