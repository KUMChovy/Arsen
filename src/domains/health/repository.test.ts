import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { getHealthProgressOverview } from './repository'

describe('getHealthProgressOverview', () => {
  beforeEach(async () => {
    await db.workoutSessions.clear()
  })

  it('projects only daily metrics even when legacy session data exists', async () => {
    await db.workoutSessions.put({
      createdAt: '2026-07-20T16:42:00.000Z',
      date: '2026-07-20',
      dayId: 'day-1',
      displayUnit: 'kg',
      health: {
        day: {
          metrics: {
            activeCaloriesKcal: 800,
            heartRateAvgBpm: 108,
            heartRateMaxBpm: 150,
            heartRateMinBpm: 72,
            oxygenSaturationAvgPercent: 97,
            steps: 7000,
          },
          rangeEnd: '2026-07-20T20:04:00.000Z',
          rangeStart: '2026-07-20T00:00:00.000Z',
        },
        session: {
          metrics: {
            activeCaloriesKcal: 260,
            heartRateAvgBpm: 130,
            heartRateMaxBpm: 168,
            heartRateMinBpm: 92,
            oxygenSaturationAvgPercent: 96,
            steps: 1500,
          },
          rangeEnd: '2026-07-20T18:30:00.000Z',
          rangeStart: '2026-07-20T16:42:00.000Z',
        },
        sessionEndSource: 'completed',
        syncedAt: '2026-07-20T20:04:00.000Z',
      },
      id: 'session-1',
      notes: '',
      routineId: 'routine-1',
      status: 'completed',
      updatedAt: '2026-07-20T20:04:00.000Z',
    })

    const overview = await getHealthProgressOverview()

    expect(overview.points).toEqual([
      {
        date: '2026-07-20',
        dayCaloriesKcal: 800,
        dayHeartRateAvgBpm: 108,
        daySteps: 7000,
        id: 'session-1',
      },
    ])
    expect(overview.exercisePoints).toEqual([])
  })

  it('projects exercise windows with their duration and metrics', async () => {
    await db.workoutSessions.put({
      createdAt: '2026-07-20T16:42:00.000Z',
      date: '2026-07-20',
      dayId: 'day-1',
      displayUnit: 'kg',
      health: {
        day: {
          metrics: {
            activeCaloriesKcal: 800,
            heartRateAvgBpm: 108,
            heartRateMaxBpm: 150,
            heartRateMinBpm: 72,
            oxygenSaturationAvgPercent: 97,
            steps: 7000,
          },
          rangeEnd: '2026-07-20T20:04:00.000Z',
          rangeStart: '2026-07-20T00:00:00.000Z',
        },
        exercises: [
          {
            canonicalName: 'press-inclinado',
            exerciseLogId: 'exercise-log-1',
            exerciseName: 'Press inclinado',
            metrics: {
              activeCaloriesKcal: 40,
              heartRateAvgBpm: 130,
              heartRateMaxBpm: 168,
              heartRateMinBpm: 92,
              oxygenSaturationAvgPercent: 96,
              steps: 200,
            },
            rangeEnd: '2026-07-20T18:40:00.000Z',
            rangeStart: '2026-07-20T18:25:00.000Z',
            routineExerciseId: 'exercise-1',
            setCount: 3,
          },
        ],
        syncedAt: '2026-07-20T20:04:00.000Z',
      },
      id: 'session-1',
      notes: '',
      routineId: 'routine-1',
      status: 'completed',
      updatedAt: '2026-07-20T20:04:00.000Z',
    })

    const overview = await getHealthProgressOverview()

    expect(overview.exercisePoints).toEqual([
      expect.objectContaining({
        canonicalName: 'press-inclinado',
        date: '2026-07-20',
        durationMinutes: 15,
        exerciseName: 'Press inclinado',
        setCount: 3,
      }),
    ])
  })
})
