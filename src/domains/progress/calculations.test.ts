import { describe, expect, it } from 'vitest'
import { aggregateExerciseSession, buildWeeklyVolume, estimatedOneRm, getPeriodBounds } from './calculations'

describe('progress calculations', () => {
  it('calculates estimated one-rep max only for valid working-set repetitions', () => {
    expect(estimatedOneRm({ reps: 6, weightKg: 70 })).toEqual({ kind: 'estimated', valueKg: 84 })
    expect(estimatedOneRm({ reps: 1, weightKg: 100 })).toEqual({ kind: 'direct', valueKg: 100 })
    expect(estimatedOneRm({ reps: 13, weightKg: 70 })).toBeNull()
    expect(estimatedOneRm({ reps: 0, weightKg: 70 })).toBeNull()
    expect(estimatedOneRm({ reps: 6, weightKg: 0 })).toBeNull()
  })

  it('aggregates one exercise session with main and drop-set volume', () => {
    expect(aggregateExerciseSession({
        date: '2026-08-10',
        sessionId: 'session-1',
        sets: [
          { kind: 'main', reps: 8, weightKg: 60 },
          { kind: 'main', reps: 5, weightKg: 80 },
          { kind: 'warmup', reps: 10, weightKg: 30 },
        ],
        dropSets: [{ reps: 10, weightKg: 40 }],
      })).toMatchObject({
      date: '2026-08-10',
      mainSetCount: 2,
      maxReps: 8,
      maxWeightKg: 80,
      sessionId: 'session-1',
      volumeKg: 1280,
    })
    expect(aggregateExerciseSession({
      date: '2026-08-10',
      sessionId: 'session-1',
      sets: [{ kind: 'main', reps: 5, weightKg: 80 }],
      dropSets: [],
    }).estimatedOneRmKg).toBeCloseTo(93.33333333333333)
  })

  it('counts bodyweight sets while leaving the estimated one-rep max unavailable', () => {
    expect(aggregateExerciseSession({
      date: '2026-08-10', sessionId: 'bodyweight',
      sets: [{ kind: 'main', reps: 12, weightKg: 0 }], dropSets: [],
    })).toMatchObject({ mainSetCount: 1, maxReps: 12, maxWeightKg: 0, volumeKg: 0, estimatedOneRmKg: null })
  })

  it('builds equal-length period bounds from the latest visible date', () => {
    expect(getPeriodBounds(['2026-08-01', '2026-08-20', '2026-09-10'], '4w')).toEqual({
      current: { end: '2026-09-10', start: '2026-08-14' },
      previous: { end: '2026-08-13', start: '2026-07-17' },
    })
    expect(getPeriodBounds(['2026-08-01', '2026-08-20'], 'all')).toEqual({
      current: { end: '2026-08-20', start: '2026-08-01' },
      previous: null,
    })
  })

  it('ignores impossible calendar dates when selecting progress periods', () => {
    expect(getPeriodBounds(['2026-02-20', '2026-02-30'], 'all')).toEqual({
      current: { start: '2026-02-20', end: '2026-02-20' }, previous: null,
    })
  })

  it('keeps period dates local in time zones east of UTC', () => {
    const previousTimezone = process.env.TZ
    try {
      process.env.TZ = 'Pacific/Kiritimati'
      expect(getPeriodBounds(['2026-08-20'], '4w').current).toEqual({ start: '2026-07-24', end: '2026-08-20' })
    } finally {
      if (previousTimezone === undefined) delete process.env.TZ
      else process.env.TZ = previousTimezone
    }
  })

  it('groups session volume into local calendar weeks without inventing empty weeks', () => {
    expect(
      buildWeeklyVolume([
        { date: '2026-08-03', volumeKg: 500 },
        { date: '2026-08-05', volumeKg: 300 },
        { date: '2026-08-12', volumeKg: 700 },
      ], { end: '2026-08-12', start: '2026-08-01' }),
    ).toEqual([
      { end: '2026-08-09', start: '2026-08-03', volumeKg: 800 },
      { end: '2026-08-16', start: '2026-08-10', volumeKg: 700 },
    ])
  })
})
