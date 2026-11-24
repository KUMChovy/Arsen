import { z } from 'zod'
import { timestampSchema, trainingDateSchema } from './dataContract'

const metric = z.number().finite().nonnegative().nullable()
const metricsSchema = z.object({
  activeCaloriesKcal: metric,
  heartRateAvgBpm: metric,
  heartRateMaxBpm: metric,
  heartRateMinBpm: metric,
  oxygenSaturationAvgPercent: metric.refine((value) => value === null || value <= 100),
  steps: z.number().int().nonnegative().nullable(),
}).strict()
const windowFields = { rangeStart: timestampSchema, rangeEnd: timestampSchema, metrics: metricsSchema }
const orderedWindow = (window: { rangeStart: string; rangeEnd: string }) => Date.parse(window.rangeStart) <= Date.parse(window.rangeEnd)
const healthWindowSchema = z.object(windowFields).strict().refine(orderedWindow)
const healthExerciseSchema = z.object({
  ...windowFields,
  canonicalName: z.string().min(1),
  exerciseLogId: z.string().min(1),
  exerciseName: z.string().min(1),
  routineExerciseId: z.string().min(1),
  setCount: z.number().int().nonnegative(),
}).strict().refine(orderedWindow)

export const healthSummarySchema = z.object({
  syncedAt: timestampSchema,
  sourceDate: trainingDateSchema.optional(),
  day: healthWindowSchema,
  session: healthWindowSchema.optional(),
  exercises: z.array(healthExerciseSchema).optional(),
  sessionEndSource: z.enum(['completed', 'last-exercise', 'sync-time']).optional(),
}).strict().superRefine((summary, ctx) => {
  const dayStart = Date.parse(summary.day.rangeStart)
  const dayEnd = Date.parse(summary.day.rangeEnd)
  for (const [index, window] of [summary.session, ...(summary.exercises ?? [])].entries()) {
    if (window && (Date.parse(window.rangeStart) < dayStart || Date.parse(window.rangeEnd) > dayEnd)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: index === 0 ? ['session'] : ['exercises', index - 1], message: 'El intervalo está fuera del día de salud' })
    }
  }
})
