// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WeightIncreaseRecommendation } from '../../../shared/calculations/progression'
import type { RoutineExercise } from '../types'
import { RoutineDayDetailPage } from './RoutineDayDetailPage'

const routineDayMocks = vi.hoisted(() => ({
  weightIncreaseRecommendations: [] as WeightIncreaseRecommendation[],
}))

vi.mock('../hooks', () => ({
  useExerciseAssets: () => [],
  useRoutineDayDetail: () => ({
    day: {
      description: 'Upper',
      id: 'day-1',
      name: 'Dia 1',
    },
    exercises: [exercise],
    routine: {
      id: 'routine-1',
      name: 'Mi rutina actual',
    },
  }),
}))

vi.mock('../../workout/hooks', () => ({
  useWeightIncreaseRecommendations: () => routineDayMocks.weightIncreaseRecommendations,
}))

describe('RoutineDayDetailPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    routineDayMocks.weightIncreaseRecommendations = []
  })

  it('shows weight increase signal in exercise summary', () => {
    routineDayMocks.weightIncreaseRecommendations = [weightIncreaseRecommendation]

    render(
      <MemoryRouter>
        <RoutineDayDetailPage />
      </MemoryRouter>,
    )

    expect(screen.getByText('Listo para subir peso: +2.5 kg')).toBeInTheDocument()
  })

  it('does not show weight increase signal without recommendation', () => {
    render(
      <MemoryRouter>
        <RoutineDayDetailPage />
      </MemoryRouter>,
    )

    expect(screen.queryByText(/Listo para subir peso/i)).not.toBeInTheDocument()
  })

  it('opens warmup description from the expanded exercise detail', () => {
    render(
      <MemoryRouter>
        <RoutineDayDetailPage />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: /Press inclinado/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Ver descripcion del calentamiento' }))

    expect(screen.getByText('Ejemplo con 100 kg de peso de trabajo.')).toBeInTheDocument()
  })
})

const exercise: RoutineExercise = {
  assetKind: null,
  bundledAssetId: null,
  canonicalName: 'press-inclinado',
  createdAt: '2026-07-20T00:00:00.000Z',
  customAssetId: null,
  currentWeightKg: 60,
  dayId: 'day-1',
  equipment: 'Barra',
  loadMode: 'split',
  barWeightKg: 20,
  id: 'exercise-1',
  mainMuscle: 'Pecho',
  name: 'Press inclinado',
  order: 0,
  recommendedRir: 2,
  repsMax: 10,
  repsMin: 8,
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

const weightIncreaseRecommendation: WeightIncreaseRecommendation = {
  currentWeightKg: 62.5,
  evidence: [
    { date: '2026-07-18', topSetLabel: '62.5 kg x 10 reps, RIR 2' },
    { date: '2026-07-20', topSetLabel: '62.5 kg x 10 reps, RIR 2' },
  ],
  exerciseId: exercise.id,
  exerciseName: exercise.name,
  reason: 'Ultimas 2 sesiones con 10+ reps y RIR 2+',
  suggestedIncreaseLabel: '+2.5 kg',
}
