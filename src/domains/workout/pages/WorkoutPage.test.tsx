// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WorkoutPage } from './WorkoutPage'
import type { RoutineExercise } from '../../routine/types'
import type { ExerciseLog, SetLog } from '../types'
import { completeSessionForDay } from '../services'

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
  useWeightIncreaseRecommendations: () => [],
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
  targetSets: 4,
  technicalNotes: '',
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
    equipment: exercise.equipment,
    mainMuscle: exercise.mainMuscle,
    name: exercise.name,
    recommendedRir: exercise.recommendedRir,
    repRange: exercise.repRange,
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
