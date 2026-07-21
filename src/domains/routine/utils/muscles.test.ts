import { describe, expect, it } from 'vitest'
import { dominantMuscleForExercises } from './dominantMuscle'
import { normalizeMuscleGroup } from './muscles'

describe('muscle utilities', () => {
  it('normalizes muscle names into approved groups', () => {
    expect(normalizeMuscleGroup('Pectoral mayor')).toBe('Pecho')
    expect(normalizeMuscleGroup('Dorsales')).toBe('Espalda')
    expect(normalizeMuscleGroup('Triceps')).toBe('Brazos')
    expect(normalizeMuscleGroup('Cuadriceps')).toBe('Piernas')
  })

  it('uses the most frequent muscle and resolves ties by exercise order', () => {
    expect(
      dominantMuscleForExercises([
        { mainMuscle: 'Espalda', order: 1 },
        { mainMuscle: 'Pecho', order: 0 },
        { mainMuscle: 'Espalda', order: 2 },
      ]),
    ).toBe('Espalda')

    expect(
      dominantMuscleForExercises([
        { mainMuscle: 'Hombros', order: 1 },
        { mainMuscle: 'Pecho', order: 0 },
      ]),
    ).toBe('Pecho')
  })
})
