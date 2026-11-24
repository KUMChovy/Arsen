import { describe, expect, it } from 'vitest'
import { DATA_CONTRACT_VERSION, trainingDateSchema, timestampSchema, recordedSetValuesSchema } from './dataContract'

describe('persistent data contract primitives', () => {
  it('uses an independent version and accepts only real calendar dates', () => {
    expect(DATA_CONTRACT_VERSION).toBe(1)
    expect(trainingDateSchema.safeParse('2024-02-29').success).toBe(true)
    expect(trainingDateSchema.safeParse('2026-02-29').success).toBe(false)
    expect(trainingDateSchema.safeParse('2026-2-01').success).toBe(false)
  })

  it('requires a timestamp with an explicit offset', () => {
    expect(timestampSchema.safeParse('2026-08-01T12:00:00Z').success).toBe(true)
    expect(timestampSchema.safeParse('2026-08-01T12:00:00').success).toBe(false)
  })

  it('rejects negative and non-finite weights and invalid repetition counts', () => {
    const set = { weightKg: 25, reps: 8, rir: 1, displayUnit: 'kg', order: 0 }
    expect(recordedSetValuesSchema.safeParse(set).success).toBe(true)
    for (const weightKg of [-1, Infinity, NaN]) expect(recordedSetValuesSchema.safeParse({ ...set, weightKg }).success).toBe(false)
    expect(recordedSetValuesSchema.safeParse({ ...set, reps: 0 }).success).toBe(false)
    expect(recordedSetValuesSchema.safeParse({ ...set, reps: 1.5 }).success).toBe(false)
    expect(recordedSetValuesSchema.safeParse({ ...set, weightKg: Number.MAX_VALUE }).success).toBe(false)
    expect(recordedSetValuesSchema.safeParse({ ...set, reps: Number.MAX_SAFE_INTEGER + 1 }).success).toBe(false)
  })
})
