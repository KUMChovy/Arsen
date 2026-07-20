import { describe, expect, it } from 'vitest'
import {
  average,
  bestSet,
  exerciseStateFromSets,
  performanceScore,
  shouldNotifyDeload,
  totalVolume,
  volumeForSet,
  weeksSince,
} from './workout'

describe('workout calculations', () => {
  it('calcula volumen y score', () => {
    expect(volumeForSet({ reps: 8, weightKg: 60 })).toBe(480)
    expect(performanceScore({ reps: 6, weightKg: 70 })).toBe(84)
  })

  it('suma volumen principal y drop sets', () => {
    expect(totalVolume([{ reps: 8, weightKg: 60 }], [{ reps: 10, weightKg: 40 }])).toBe(880)
  })

  it('elige mejor serie por score', () => {
    expect(bestSet([{ reps: 8, weightKg: 60 }, { reps: 5, weightKg: 80 }])).toEqual({ reps: 5, weightKg: 80 })
  })

  it('deriva estado del ejercicio', () => {
    expect(exerciseStateFromSets(0, 3, false)).toBe('pending')
    expect(exerciseStateFromSets(2, 3, false)).toBe('in_progress')
    expect(exerciseStateFromSets(3, 3, false)).toBe('done')
    expect(exerciseStateFromSets(0, 3, true)).toBe('skipped')
  })

  it('calcula promedios y deload', () => {
    expect(average([60, 70, 80])).toBe(70)
    expect(weeksSince('2026-01-01', '2026-02-12')).toBe(6)
    expect(shouldNotifyDeload('2026-01-01', '2026-02-12')).toBe(true)
  })
})
