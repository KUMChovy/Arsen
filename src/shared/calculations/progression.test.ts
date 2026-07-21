import { describe, expect, it } from 'vitest'
import type { RoutineExercise } from '../../domains/routine/types'
import { getWeightIncreaseRecommendation, type ProgressionSession } from './progression'

describe('progression calculations', () => {
  it('recommends weight increase after two completed high-rep sessions', () => {
    const recommendation = getWeightIncreaseRecommendation(exercise, [
      session('2026-07-18', [
        set(0, 60, 10, 2),
        set(1, 60, 10, 2),
        set(2, 60, 10, 3),
      ]),
      session('2026-07-20', [
        set(0, 62.5, 10, 2),
        set(1, 62.5, 11, 2),
        set(2, 62.5, 10, 2),
      ]),
    ])

    expect(recommendation).toMatchObject({
      currentWeightKg: 62.5,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      suggestedIncreaseLabel: '+2.5 kg',
    })
  })

  it('does not count drop sets for weight increase', () => {
    const recommendation = getWeightIncreaseRecommendation(exercise, [
      session('2026-07-18', [set(0, 60, 8, 1), dropSet(0, 40, 12, 3), dropSet(1, 40, 12, 3)]),
      session('2026-07-20', [set(0, 60, 8, 1), dropSet(0, 40, 12, 3), dropSet(1, 40, 12, 3)]),
    ])

    expect(recommendation).toBeNull()
  })

  it('does not recommend with low RIR or incomplete target sets', () => {
    expect(
      getWeightIncreaseRecommendation(exercise, [
        session('2026-07-18', [set(0, 60, 10, 1), set(1, 60, 10, 2), set(2, 60, 10, 2)]),
        session('2026-07-20', [set(0, 60, 10, 2), set(1, 60, 10, 2), set(2, 60, 10, 2)]),
      ]),
    ).toBeNull()

    expect(
      getWeightIncreaseRecommendation(exercise, [
        session('2026-07-18', [set(0, 60, 10, 2), set(1, 60, 10, 2)]),
        session('2026-07-20', [set(0, 60, 10, 2), set(1, 60, 10, 2), set(2, 60, 10, 2)]),
      ]),
    ).toBeNull()
  })
})

const exercise: RoutineExercise = {
  canonicalName: 'press-inclinado',
  createdAt: '2026-07-20T00:00:00.000Z',
  currentWeightKg: 60,
  dayId: 'day-1',
  equipment: 'Barra',
  id: 'exercise-1',
  mainMuscle: 'Pecho',
  name: 'Press inclinado',
  order: 0,
  progression: '',
  recommendedRir: '1-2',
  repRange: '8-10',
  rest: '90 seg',
  restSeconds: 90,
  routineId: 'routine-1',
  sourceExerciseId: null,
  targetSets: 3,
  technicalNotes: '',
  updatedAt: '2026-07-20T00:00:00.000Z',
  warmupProtocol: '',
  warmupSets: 2,
}

function session(date: string, sets: ProgressionSession['sets']): ProgressionSession {
  return { date, sets }
}

function set(order: number, weightKg: number, reps: number, rir: number): ProgressionSession['sets'][number] {
  return { kind: 'main', order, reps, rir, weightKg }
}

function dropSet(order: number, weightKg: number, reps: number, rir: number): ProgressionSession['sets'][number] {
  return { kind: 'warmup', order, reps, rir, weightKg }
}
