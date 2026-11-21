import { describe, expect, it } from 'vitest'
import { compareSessions } from './comparison'

describe('compareSessions', () => {
  it('compares shared exercises and explains incompatible sessions', () => {
    const result = compareSessions(detail('session-a', 'press-inclinado', 600), detail('session-b', 'press-inclinado', 720))

    expect(result).toMatchObject({ comparable: true, leftVolumeKg: 601, rightVolumeKg: 721, volumeDeltaKg: 120 })
    expect(result.sharedExercises).toEqual(['press-inclinado'])
  })

  it('returns a limitation when sessions have no shared exercises', () => {
    expect(compareSessions(detail('a', 'press', 100), detail('b', 'sentadilla', 200))).toMatchObject({ comparable: false, sharedExercises: [] })
  })
})

function detail(id: string, name: string, weightKg: number) {
    return {
    id,
      exercises: [{ canonicalName: name, exerciseName: name, sets: [{ dropSets: [{ reps: 1, weightKg: 1 }], reps: 1, weightKg }] }],
  }
}
