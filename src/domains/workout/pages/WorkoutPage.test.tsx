// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WeightIncreaseRecommendation } from '../../../shared/calculations/progression'
import { WorkoutPage } from './WorkoutPage'
import type { RoutineExercise } from '../../routine/types'
import type { ExerciseLog, SetLog } from '../types'
import { completeSessionForDay } from '../services'

const workoutMocks = vi.hoisted(() => ({
  weightIncreaseRecommendations: [] as WeightIncreaseRecommendation[],
}))

vi.mock('../../routine/hooks', () => ({
  useActiveRoutineBundle: () => ({
    days: [day],
    exercisesByDay: new Map([[day.id, [exercise]]]),
    routine,
    settings: {
      preferredUnit: 'kg',
    },
  }),
  useRoutines: () => [routine],
  useWorkoutDayById: () => ({
    day: {
      description: 'Upper',
      id: 'day-1',
      name: 'Dia 1',
    },
    dayExercises: [exercise],
    routine: {
      id: 'routine-1',
      name: 'Mi rutina actual',
    },
    settings: {
      preferredUnit: 'kg',
    },
  }),
}))

vi.mock('../hooks', () => ({
  useWeightIncreaseRecommendations: () => workoutMocks.weightIncreaseRecommendations,
  useWorkoutProgress: () => ({
    completedCount: 0,
    dropSets: [],
    exerciseLogByExerciseId: new Map([[exercise.id, exerciseLog]]),
    inProgressCount: 1,
    pendingCount: 0,
    progress: {
      session: {
        id: 'session-1',
        notes: 'Sesion inicial',
        status: 'draft',
      },
    },
    setLogs: [setLog],
    setsByExerciseLogId: new Map([[exerciseLog.id, 1]]),
    skippedCount: 0,
    stateByExerciseId: new Map([[exercise.id, 'in_progress']]),
  }),
}))

vi.mock('../services', () => ({
  addDropSet: vi.fn(() => Promise.resolve()),
  completeSessionForDay: vi.fn(() => Promise.resolve('session-1')),
  deleteDropSet: vi.fn(() => Promise.resolve()),
  deleteMainSet: vi.fn(() => Promise.resolve()),
  skipRoutineExerciseForDay: vi.fn(() => Promise.resolve('session-1')),
  updateDropSet: vi.fn(() => Promise.resolve()),
  updateMainSet: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../routine/services', () => ({
  setActiveRoutine: vi.fn(() => Promise.resolve()),
}))

describe('WorkoutPage', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    workoutMocks.weightIncreaseRecommendations = []
  })

  it('renders clean daily workout without date, notes or rest controls', () => {
    render(<WorkoutPage />)

    expect(screen.getByRole('heading', { name: /Entreno/i })).toBeInTheDocument()
    expect(screen.getByText('Mi rutina actual - Dia 1')).toBeInTheDocument()
    expect(screen.getAllByText('Press inclinado').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Notas personales')).not.toBeInTheDocument()
    expect(screen.queryByText('Fecha de sesion')).not.toBeInTheDocument()
    expect(screen.queryByText('Descanso')).not.toBeInTheDocument()
  })

  it('completes current session', async () => {
    render(<WorkoutPage />)

    fireEvent.click(screen.getAllByRole('button', { name: /Finalizar sesion/i })[0]!)

    await waitFor(() => {
      expect(completeSessionForDay).toHaveBeenCalledWith(
        expect.objectContaining({
          dayId: 'day-1',
          routineId: 'routine-1',
        }),
      )
    })
  })

  it('shows active weight increase recommendation', () => {
    workoutMocks.weightIncreaseRecommendations = [weightIncreaseRecommendation]

    render(<WorkoutPage />)

    expect(screen.getByText('Listo para subir peso')).toBeInTheDocument()
    expect(screen.getAllByText('Press inclinado').length).toBeGreaterThan(0)
    expect(screen.getByText('+2.5 kg')).toBeInTheDocument()
  })

  it('shows barbell load note on the current exercise card', () => {
    render(<WorkoutPage />)

    expect(screen.getByText('Discos por lado: 30 kg · Total con barra: 80 kg')).toBeInTheDocument()
  })

  it('hides weight increase recommendation for a different exercise', () => {
    workoutMocks.weightIncreaseRecommendations = [{ ...weightIncreaseRecommendation, exerciseId: 'exercise-otro', exerciseName: 'Remo T' }]

    render(<WorkoutPage />)

    expect(screen.queryByText('Listo para subir peso')).not.toBeInTheDocument()
    expect(screen.queryByText('+2.5 kg')).not.toBeInTheDocument()
  })

  it('opens exercise indication notes from the info button', () => {
    render(<WorkoutPage />)

    expect(screen.queryByText(exercise.technicalNotes)).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /Ver indicaciones de Press inclinado/i })[0]!)

    expect(screen.getByRole('heading', { name: 'Indicaciones' })).toBeInTheDocument()
    expect(screen.getByText(exercise.technicalNotes)).toBeInTheDocument()
  })
})

const exercise: RoutineExercise = {
  canonicalName: 'press-inclinado',
  createdAt: '2026-07-20T00:00:00.000Z',
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
  targetSets: 4,
  technicalNotes: 'Mantén escapulas juntas y baja con control.',
  updatedAt: '2026-07-20T00:00:00.000Z',
  warmupProtocol: '',
  warmupSets: 2,
}

const day = {
  createdAt: '2026-07-20T00:00:00.000Z',
  description: 'Upper',
  id: 'day-1',
  name: 'Dia 1',
  order: 0,
  routineId: 'routine-1',
  updatedAt: '2026-07-20T00:00:00.000Z',
  weekday: 1,
} as const

const routine = {
  createdAt: '2026-07-20T00:00:00.000Z',
  id: 'routine-1',
  isActive: true,
  name: 'Mi rutina actual',
  updatedAt: '2026-07-20T00:00:00.000Z',
}

const exerciseLog: ExerciseLog = {
  createdAt: '2026-07-20T00:00:00.000Z',
  id: 'exercise-log-1',
  notes: '',
  routineExerciseId: exercise.id,
  sessionId: 'session-1',
  snapshot: {
    canonicalName: exercise.canonicalName,
    barWeightKg: exercise.barWeightKg,
    equipment: exercise.equipment,
    loadMode: exercise.loadMode,
    mainMuscle: exercise.mainMuscle,
    name: exercise.name,
    recommendedRir: exercise.recommendedRir,
    repsMax: exercise.repsMax,
    repsMin: exercise.repsMin,
    restSeconds: exercise.restSeconds,
    targetSets: exercise.targetSets,
  },
  state: 'in_progress',
  updatedAt: '2026-07-20T00:00:00.000Z',
}

const setLog: SetLog = {
  createdAt: '2026-07-20T00:00:00.000Z',
  displayUnit: 'kg',
  exerciseLogId: exerciseLog.id,
  id: 'set-1',
  kind: 'main',
  order: 0,
  reps: 8,
  rir: 1,
  updatedAt: '2026-07-20T00:00:00.000Z',
  weightKg: 60,
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
