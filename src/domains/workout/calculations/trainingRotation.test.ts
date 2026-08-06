import { describe, expect, it } from 'vitest'
import type { RoutineDay } from '../../routine/types'
import {
  buildMissedTrainingNotice,
  calendarDaysBetween,
  getDefaultWorkoutDayId,
  getLatestSessionWithMainSets,
  getNextRotationDay,
} from './trainingRotation'

describe('training rotation calculations', () => {
  it('uses weekday match as default before falling back to the first ordered day', () => {
    expect(getDefaultWorkoutDayId([dayB, dayA], 1)).toBe('day-a')
    expect(getDefaultWorkoutDayId([dayB, dayA], 4)).toBe('day-a')
  })

  it('returns the next ordered day after the latest trained day with wraparound', () => {
    expect(getNextRotationDay([dayC, dayA, dayB], 'day-a', 'day-c')?.id).toBe('day-b')
    expect(getNextRotationDay([dayC, dayA, dayB], 'day-c', 'day-a')?.id).toBe('day-a')
  })

  it('uses a valid fallback when the latest trained day is not in the active routine', () => {
    expect(getNextRotationDay([dayB, dayA], 'deleted-day', 'day-b')?.id).toBe('day-b')
  })

  it('finds the latest session with main sets by date', () => {
    expect(
      getLatestSessionWithMainSets([
        { date: '2026-08-01', dayId: 'day-a', routineId: 'routine-1' },
        { date: '2026-08-03', dayId: 'day-b', routineId: 'routine-1' },
      ]),
    ).toEqual({ date: '2026-08-03', dayId: 'day-b', routineId: 'routine-1' })
  })

  it('counts calendar days between local date keys', () => {
    expect(calendarDaysBetween('2026-08-03', '2026-08-05')).toBe(2)
  })

  it('shows a missed-training notice at the configured threshold and reuses next rotation day', () => {
    expect(
      buildMissedTrainingNotice({
        activeRoutineId: 'routine-1',
        days: [dayA, dayB, dayC],
        sessionsWithMainSets: [{ date: '2026-08-03', dayId: 'day-a', routineId: 'routine-1' }],
        todayDate: '2026-08-05',
        todayWeekday: 3,
        threshold: 2,
      }),
    ).toEqual({
      daysWithoutTraining: 2,
      missedScheduledDay: false,
      nextDay: dayB,
      shouldShow: true,
    })
  })

  it('shows a missed-training notice when an anchored scheduled weekday was skipped before today', () => {
    const tuesdayDay: RoutineDay = { ...dayB, weekday: 2 }

    expect(
      buildMissedTrainingNotice({
        activeRoutineId: 'routine-1',
        days: [dayA, tuesdayDay, dayC],
        sessionsWithMainSets: [{ date: '2026-08-03', dayId: 'day-a', routineId: 'routine-1' }],
        todayDate: '2026-08-05',
        todayWeekday: 3,
        threshold: 7,
      }).missedScheduledDay,
    ).toBe(true)
  })

  it('detects a skipped anchored weekday even after training another routine later', () => {
    expect(
      buildMissedTrainingNotice({
        activeRoutineId: 'routine-1',
        days: [dayA, dayC],
        sessionsWithMainSets: [
          { date: '2026-08-02', dayId: 'day-c', routineId: 'routine-1' },
          { date: '2026-08-04', dayId: 'other-day', routineId: 'routine-2' },
        ],
        todayDate: '2026-08-05',
        todayWeekday: 3,
        threshold: 7,
      }),
    ).toMatchObject({
      daysWithoutTraining: 1,
      missedScheduledDay: true,
      nextDay: dayA,
      shouldShow: true,
    })
  })
})

const baseDay = {
  createdAt: '2026-08-01T00:00:00.000Z',
  description: '',
  routineId: 'routine-1',
  updatedAt: '2026-08-01T00:00:00.000Z',
} satisfies Omit<RoutineDay, 'id' | 'name' | 'order' | 'weekday'>

const dayA: RoutineDay = { ...baseDay, id: 'day-a', name: 'Dia A', order: 0, weekday: 1 }
const dayB: RoutineDay = { ...baseDay, id: 'day-b', name: 'Dia B', order: 1, weekday: null }
const dayC: RoutineDay = { ...baseDay, id: 'day-c', name: 'Dia C', order: 2, weekday: 3 }
