import { describe, expect, it } from 'vitest'
import { resolveHealthDayWindow, resolveHealthWindows } from './calculations'

describe('resolveHealthDayWindow', () => {
  it('uses local midnight and caps the day at the sync time', () => {
    expect(resolveHealthDayWindow('2026-07-20', new Date('2026-07-20T20:04:00.000Z'))).toEqual({
      rangeEnd: '2026-07-20T20:04:00.000Z',
      rangeStart: new Date(2026, 6, 20).toISOString(),
    })
  })

  it('caps a late synchronization at the next local midnight', () => {
    expect(resolveHealthDayWindow('2026-07-20', new Date('2026-07-21T12:00:00.000Z'))).toEqual({
      rangeEnd: new Date(2026, 6, 21).toISOString(),
      rangeStart: new Date(2026, 6, 20).toISOString(),
    })
  })
})

describe('resolveHealthWindows', () => {
  it('resolves the completed session and each exercise from its main set timestamps', () => {
    const result = resolveHealthWindows(
      {
        date: '2026-07-20',
        startedAt: '2026-07-20T16:42:00.000Z',
        completedAt: '2026-07-20T18:30:00.000Z',
        status: 'completed',
      },
      [
        {
          canonicalName: 'press-inclinado',
          exerciseLogId: 'exercise-log-1',
          exerciseName: 'Press inclinado',
          routineExerciseId: 'exercise-1',
          setCount: 3,
          setTimes: ['2026-07-20T16:45:00.000Z', '2026-07-20T16:52:00.000Z', '2026-07-20T17:00:00.000Z'],
        },
        {
          canonicalName: 'curl-biceps',
          exerciseLogId: 'exercise-log-2',
          exerciseName: 'Curl de bíceps',
          routineExerciseId: 'exercise-2',
          setCount: 2,
          setTimes: ['2026-07-20T18:00:00.000Z', '2026-07-20T18:10:00.000Z'],
        },
      ],
      new Date('2026-07-20T20:04:00.000Z'),
    )

    expect(result.session).toEqual({
      rangeEnd: '2026-07-20T18:10:00.000Z',
      rangeStart: '2026-07-20T16:45:00.000Z',
    })
    expect(result.sessionEndSource).toBe('last-exercise')
    expect(result.exercises).toEqual([
      {
        canonicalName: 'press-inclinado',
        exerciseLogId: 'exercise-log-1',
        exerciseName: 'Press inclinado',
        rangeEnd: '2026-07-20T17:00:00.000Z',
        rangeStart: '2026-07-20T16:45:00.000Z',
        routineExerciseId: 'exercise-1',
        setCount: 3,
      },
      {
        canonicalName: 'curl-biceps',
        exerciseLogId: 'exercise-log-2',
        exerciseName: 'Curl de bíceps',
        rangeEnd: '2026-07-20T18:10:00.000Z',
        rangeStart: '2026-07-20T18:00:00.000Z',
        routineExerciseId: 'exercise-2',
        setCount: 2,
      },
    ])
  })

  it('does not extend a one-set exercise to the sync time', () => {
    const result = resolveHealthWindows(
      {
        date: '2026-07-20',
        startedAt: null,
        completedAt: null,
        status: 'draft',
      },
      [
        {
          canonicalName: 'sentadilla',
          exerciseLogId: 'exercise-log-1',
          exerciseName: 'Sentadilla',
          routineExerciseId: 'exercise-1',
          setCount: 1,
          setTimes: ['2026-07-20T18:30:00.000Z'],
        },
      ],
      new Date('2026-07-20T18:40:00.000Z'),
    )

    expect(result.session).toBeNull()
    expect(result.sessionEndSource).toBe('sync-time')
    expect(result.exercises).toEqual([])
  })

  it('uses the saved last exercise timestamp when a completed legacy session has no completedAt', () => {
    const result = resolveHealthWindows(
      {
        date: '2026-07-20',
        lastExerciseAt: '2026-07-20T18:30:00.000Z',
        startedAt: '2026-07-20T16:42:00.000Z',
        status: 'completed',
      },
      [],
      new Date('2026-07-20T20:04:00.000Z'),
    )

    expect(result.session).toEqual({
      rangeEnd: '2026-07-20T18:30:00.000Z',
      rangeStart: '2026-07-20T16:42:00.000Z',
    })
    expect(result.sessionEndSource).toBe('last-exercise')
  })
})
