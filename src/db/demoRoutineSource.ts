import rawDemoRoutine from './data/demo-routine.json'

export type DemoRoutineExerciseSource = {
  id: string
  day: string
  name: string
  mainMuscle: string
  warmupSets: number
  warmupProtocol: string
  targetSets: number
  repRange: string
  recommendedRir: string
  rest: string
  restSeconds: number
  progression: string
  technicalNotes: string
  currentWeight: number
}

export type DemoRoutineSource = {
  name: string
  trainingDays: string[]
  dayDescriptions: Record<string, string>
  routine: DemoRoutineExerciseSource[]
  weeklyVolumeTargets: Array<{
    muscle: string
    sets: number
    range: string
    evaluation: string
    comment: string
  }>
}

export const demoRoutineSource = rawDemoRoutine as DemoRoutineSource
