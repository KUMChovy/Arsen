import { describe, expect, it } from 'vitest'
import { healthSummarySchema } from './healthSchemas'

const metrics = { activeCaloriesKcal: 12, heartRateAvgBpm: 80, heartRateMaxBpm: 100, heartRateMinBpm: 60, oxygenSaturationAvgPercent: 98, steps: 500 }
const day = { rangeStart: '2026-08-01T00:00:00.000Z', rangeEnd: '2026-08-01T23:00:00.000Z', metrics }

describe('health summary validation', () => {
  it('accepts bounded summaries and rejects reversed windows and impossible metrics', () => {
    expect(healthSummarySchema.safeParse({ day, syncedAt: '2026-08-01T23:30:00.000Z' }).success).toBe(true)
    expect(healthSummarySchema.safeParse({ day: { ...day, rangeStart: day.rangeEnd, rangeEnd: day.rangeStart }, syncedAt: day.rangeEnd }).success).toBe(false)
    expect(healthSummarySchema.safeParse({ day: { ...day, metrics: { ...metrics, oxygenSaturationAvgPercent: 101 } }, syncedAt: day.rangeEnd }).success).toBe(false)
  })

  it('requires exercise summaries to identify the exercise and its log', () => {
    expect(healthSummarySchema.safeParse({ day, exercises: [day], syncedAt: day.rangeEnd }).success).toBe(false)
  })
})
