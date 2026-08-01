export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type Equipment = 'Barra' | 'Mancuerna' | 'Maquina' | 'Polea' | 'Peso corporal' | 'Otro'
export type MuscleGroup = 'Pecho' | 'Espalda' | 'Hombros' | 'Brazos' | 'Abdomen' | 'Piernas'

export type Routine = {
  id: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type RoutineDay = {
  id: string
  routineId: string
  name: string
  description: string
  weekday: Weekday | null
  order: number
  createdAt: string
  updatedAt: string
}

export type RoutineExercise = {
  id: string
  routineId: string
  dayId: string
  sourceExerciseId: string | null
  name: string
  canonicalName: string
  mainMuscle: string
  equipment: Equipment
  targetSets: number
  repsMin: number
  repsMax: number
  recommendedRir: number
  rest: string
  restSeconds: number
  warmupSets: number
  warmupProtocol: string
  progression: string
  technicalNotes: string
  currentWeightKg: number
  order: number
  createdAt: string
  updatedAt: string
}

export type ExerciseCatalogItem = {
  id: string
  name: string
  canonicalName: string
  mainMuscle: string
  equipment: Equipment
  aliases: string[]
  technicalNotes: string
  defaultTargetSets: number
  defaultRepsMin: number
  defaultRepsMax: number
  defaultRecommendedRir: number
  defaultRestSeconds: number
  assetKind: string | null
  createdAt: string
  updatedAt: string
}

export type WeeklyVolumeTarget = {
  id: string
  routineId: string
  muscle: string
  sets: number
  range: string
  evaluation: string
  comment: string
}
