export type HealthMetric = 'heartRate' | 'activeCalories' | 'steps' | 'oxygenSaturation'

export type HealthMetricSummary = {
  heartRateAvgBpm: number | null
  heartRateMaxBpm: number | null
  heartRateMinBpm: number | null
  activeCaloriesKcal: number | null
  steps: number | null
  oxygenSaturationAvgPercent: number | null
}

export type HealthWindowSummary = {
  rangeStart: string
  rangeEnd: string
  metrics: HealthMetricSummary
}

export type HealthExerciseSummary = HealthWindowSummary & {
  canonicalName: string
  exerciseLogId: string
  exerciseName: string
  routineExerciseId: string
  setCount: number
}

export type HealthSummary = {
  syncedAt: string
  day: HealthWindowSummary
  session?: HealthWindowSummary
  exercises?: HealthExerciseSummary[]
  sessionEndSource?: 'completed' | 'last-exercise' | 'sync-time'
}
