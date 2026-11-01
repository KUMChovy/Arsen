import { db } from '../../db/schema'
import type { HealthMetricSummary } from './types'

export type HealthProgressPoint = {
  date: string
  dayCaloriesKcal: number | null
  dayHeartRateAvgBpm: number | null
  daySteps: number | null
  id: string
}

export type HealthProgressOverview = {
  exercisePoints: HealthExerciseProgressPoint[]
  maxDayCalories: HealthProgressPoint | null
  points: HealthProgressPoint[]
}

export type HealthExerciseProgressPoint = {
  canonicalName: string
  date: string
  durationMinutes: number
  exerciseName: string
  id: string
  metrics: HealthMetricSummary
  rangeEnd: string
  rangeStart: string
  setCount: number
}

// Proyecta los resúmenes persistidos a una forma ligera para la pantalla Progreso.
export async function getHealthProgressOverview(dayId?: string | null): Promise<HealthProgressOverview> {
  const sessions = await db.workoutSessions.orderBy('date').toArray()
  const points = sessions
    .filter((session) => (!dayId || session.dayId === dayId) && session.health)
    .map((session): HealthProgressPoint => ({
      date: session.date,
      dayCaloriesKcal: session.health?.day.metrics.activeCaloriesKcal ?? null,
      dayHeartRateAvgBpm: session.health?.day.metrics.heartRateAvgBpm ?? null,
      daySteps: session.health?.day.metrics.steps ?? null,
      id: session.id,
    }))
  // Las estadísticas por ejercicio se derivan del resumen guardado; no vuelven a consultar el reloj.
  const exercisePoints = sessions.flatMap((session): HealthExerciseProgressPoint[] =>
    (session.health?.exercises ?? []).map((exercise) => ({
      canonicalName: exercise.canonicalName,
      date: session.date,
      durationMinutes: Math.max(0, Math.round((new Date(exercise.rangeEnd).getTime() - new Date(exercise.rangeStart).getTime()) / 60000)),
      exerciseName: exercise.exerciseName,
      id: `${session.id}:${exercise.exerciseLogId}`,
      metrics: exercise.metrics,
      rangeEnd: exercise.rangeEnd,
      rangeStart: exercise.rangeStart,
      setCount: exercise.setCount,
    })),
  )

  return {
    exercisePoints,
    maxDayCalories: points.reduce<HealthProgressPoint | null>((max, point) => {
      if (point.dayCaloriesKcal === null) return max
      if (!max || (max.dayCaloriesKcal ?? -1) < point.dayCaloriesKcal) return point
      return max
    }, null),
    points,
  }
}
