// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WeightIncreaseRecommendation } from '../../../shared/calculations/progression'
import { WorkoutPage } from './WorkoutPage'
import type { RoutineDay, RoutineExercise } from '../../routine/types'
import type { DropSetLog, ExerciseLog, LastSessionReference, SetLog, WorkoutSession } from '../types'
import { confirmDanger } from '../../../shared/utils/alerts'
import { completeSessionForDay, deleteMainSet, updateMainSet } from '../services'
import { setActiveRoutine } from '../../routine/services'
import type { DeloadOverview } from '../../settings/types'

const workoutMocks = vi.hoisted(() => ({
  completeActiveDeload: vi.fn(() => Promise.resolve()),
  setLogs: [] as SetLog[],
  sessionStatus: 'draft' as WorkoutSession['status'],
  rotationStatus: {
    daysWithoutTraining: 0,
    missedScheduledDay: false,
    nextDay: null as RoutineDay | null,
    sessionsWithMainSets: [],
    shouldShow: false,
  },
  weightIncreaseRecommendations: [] as WeightIncreaseRecommendation[],
  lastSessionReferences: new Map<string, LastSessionReference>(),
  deloadOverview: {
    anchorDate: '2026-07-01',
    cooldownUntil: null,
    currentCycle: null,
    daysRemaining: null,
    firstLogDate: '2026-07-01',
    lastCompletedDate: null,
    phase: 'idle',
    seriesReductionPercent: 50,
    shouldNotify: false,
    weeksSinceAnchor: 2,
    weightReductionPercent: 80,
  } as DeloadOverview,
}))

vi.mock('../../routine/hooks', () => ({
  useActiveRoutineBundle: () => ({
    days: [day, day2],
    exercisesByDay: new Map([
      [day.id, [exercise, otherExercise]],
      [day2.id, [day2Exercise]],
    ]),
    routine,
    settings: {
      availablePlateWeightsKg: [20, 10],
      preferredUnit: 'kg',
    },
  }),
  useExerciseAssets: () => [],
  useRoutines: () => [routine, routine2],
  useWorkoutDayById: (dayId: string | null) => {
    const selectedDay = dayId === day2.id ? day2 : day
    return {
      day: selectedDay,
      dayExercises: selectedDay.id === day2.id ? [day2Exercise] : [exercise, otherExercise],
      routine: {
        id: 'routine-1',
        name: 'Mi rutina actual',
      },
      settings: {
        availablePlateWeightsKg: [20, 10],
        preferredUnit: 'kg',
      },
    }
  },
}))

vi.mock('../hooks', () => ({
  useDeloadOverview: () => workoutMocks.deloadOverview,
  useWeightIncreaseRecommendations: () => workoutMocks.weightIncreaseRecommendations,
  useWorkoutRotationStatus: () => workoutMocks.rotationStatus,
  useLastSessionReferencesForDay: () => workoutMocks.lastSessionReferences,
  useWorkoutProgress: () => ({
    completedCount: 0,
    dropSets: [],
    exerciseLogByExerciseId: new Map([
      [exercise.id, exerciseLog],
      [otherExercise.id, otherExerciseLog],
    ]),
    inProgressCount: 1,
    pendingCount: 0,
    progress: {
      session: {
        id: 'session-1',
        notes: 'Sesion inicial',
        status: workoutMocks.sessionStatus,
      },
    },
    setLogs: workoutMocks.setLogs,
    setsByExerciseLogId: new Map([
      [exerciseLog.id, 1],
      [otherExerciseLog.id, 1],
    ]),
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

vi.mock('../../../shared/utils/alerts', () => ({
  confirmDanger: vi.fn(() => Promise.resolve(true)),
}))

describe('WorkoutPage', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    window.localStorage.clear()
  })

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-07-20T12:00:00'))
    vi.clearAllMocks()
    workoutMocks.setLogs = [setLog, otherSetLog]
    workoutMocks.sessionStatus = 'draft'
    workoutMocks.rotationStatus = {
      daysWithoutTraining: 0,
      missedScheduledDay: false,
      nextDay: null,
      sessionsWithMainSets: [],
      shouldShow: false,
    }
    workoutMocks.weightIncreaseRecommendations = []
    workoutMocks.lastSessionReferences = new Map()
    workoutMocks.deloadOverview = {
      anchorDate: '2026-07-01',
      cooldownUntil: null,
      currentCycle: null,
      daysRemaining: null,
      firstLogDate: '2026-07-01',
      lastCompletedDate: null,
      phase: 'idle',
      seriesReductionPercent: 50,
      shouldNotify: false,
      weeksSinceAnchor: 2,
      weightReductionPercent: 80,
    } as DeloadOverview
    exercise.equipment = 'Barra'
    exercise.loadMode = 'split'
    exercise.barWeightKg = 20
  })

  it('renders clean daily workout with current exercise rest visible', () => {
    render(<WorkoutPage />)

    expect(screen.getByRole('heading', { name: /Entreno/i })).toBeInTheDocument()
    expect(screen.getByText('Mi rutina actual - Dia 1')).toBeInTheDocument()
    expect(screen.getAllByText('Press inclinado').length).toBeGreaterThan(0)
    expect(screen.queryByLabelText('Notas personales')).not.toBeInTheDocument()
    expect(screen.queryByText('Fecha de sesion')).not.toBeInTheDocument()
    expect(screen.getByText('Descanso')).toBeInTheDocument()
    expect(screen.getByText('1:30 min')).toBeInTheDocument()
    expect(screen.getByLabelText('Descanso recomendado')).toHaveTextContent('Descanso1:30 min')
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

  it('applies active deload targets to the current workout', async () => {
    workoutMocks.deloadOverview = {
      anchorDate: '2026-07-01',
      cooldownUntil: null,
      currentCycle: {
        completedAt: null,
        createdAt: '2026-07-20T00:00:00.000Z',
        id: 'deload-active',
        scheduledStartDate: null,
        skippedAt: null,
        startedAt: '2026-07-20',
        status: 'active',
        suggestedAt: null,
        updatedAt: '2026-07-20T00:00:00.000Z',
      },
      daysRemaining: 5,
      firstLogDate: '2026-07-01',
      lastCompletedDate: null,
      phase: 'active',
      seriesReductionPercent: 50,
      shouldNotify: false,
      weeksSinceAnchor: 6,
      weightReductionPercent: 80,
    }

    render(<WorkoutPage />)

    expect(screen.getByText('Modo deload activo')).toBeInTheDocument()
    expect(screen.getByText('5 dias restantes')).toBeInTheDocument()
    expect(screen.getByText('Peso deload')).toBeInTheDocument()
    expect(screen.getByText('48 kg')).toBeInTheDocument()
    expect(screen.getByText('Series deload').closest('div')).toHaveTextContent('2')

    expect(screen.getByRole('button', { name: 'Finalizar deload' })).toBeEnabled()
  })
  it('shows barbell load note on the current exercise card', () => {
    render(<WorkoutPage />)

    expect(screen.getByText('Discos: 20 + 10 kg por lado - Total con barra: 80 kg')).toBeInTheDocument()
  })

  it('does not show plate calculator for dumbbells', () => {
    exercise.equipment = 'Mancuerna'
    exercise.loadMode = 'single'
    exercise.barWeightKg = 0

    render(<WorkoutPage />)

    expect(screen.queryByText(/Discos:/i)).not.toBeInTheDocument()
  })

  it('hides weight increase recommendation for a different exercise', () => {
    workoutMocks.weightIncreaseRecommendations = [{ ...weightIncreaseRecommendation, exerciseId: 'exercise-otro', exerciseName: 'Remo T' }]

    render(<WorkoutPage />)

    expect(screen.queryByText('Listo para subir peso')).not.toBeInTheDocument()
    expect(screen.queryByText('+2.5 kg')).not.toBeInTheDocument()
  })

  it('shows the last-session reference for the current exercise', () => {
    workoutMocks.lastSessionReferences = new Map([
      [
        exercise.id,
        {
          date: '2026-07-18',
          sets: [{ dropSets: [referenceDropSet], set: referenceSetLog }],
        },
      ],
    ])

    render(<WorkoutPage />)

    expect(screen.getByText('Ultima sesion')).toBeInTheDocument()
    expect(screen.getByText('18 jul')).toBeInTheDocument()
    expect(screen.getByText('Referencia')).toBeInTheDocument()
    expect(screen.getByText('Serie 1 - 62.5 kg - 9 reps - RIR 2')).toBeInTheDocument()
    expect(screen.getByText('Drop 1 - 45 kg - 8 reps - RIR 3')).toBeInTheDocument()
  })

  it('shows an empty last-session reference state for exercises without day-scoped history', () => {
    render(<WorkoutPage />)

    expect(screen.getByText('Primera vez con este ejercicio en este dia')).toBeInTheDocument()
  })

  it('does not render edit or delete controls inside the last-session reference', () => {
    workoutMocks.lastSessionReferences = new Map([
      [
        exercise.id,
        {
          date: '2026-07-18',
          sets: [{ dropSets: [], set: referenceSetLog }],
        },
      ],
    ])

    render(<WorkoutPage />)

    const referenceBlock = screen.getByText('Ultima sesion').closest('section')
    expect(referenceBlock).not.toBeNull()
    expect(referenceBlock).not.toHaveTextContent(/Editar/i)
    expect(referenceBlock).not.toHaveTextContent(/Eliminar/i)
    expect(screen.queryByRole('button', { name: /Editar serie .*ultima/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Eliminar serie .*ultima/i })).not.toBeInTheDocument()
  })
  it('opens exercise indication notes from the info button', () => {
    render(<WorkoutPage />)

    expect(screen.queryByText(exercise.technicalNotes)).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: /Ver indicaciones de Press inclinado/i })[0]!)

    expect(screen.getByRole('heading', { name: 'Indicaciones' })).toBeInTheDocument()
    expect(screen.getByText(exercise.technicalNotes)).toBeInTheDocument()
  })

  it('shows registered sets inside the selected exercise only', () => {
    render(<WorkoutPage />)

    fireEvent.click(screen.getByRole('button', { name: /Ver series de Press inclinado/i }))

    expect(screen.getByText('Serie 1 - 60 kg - 8 reps - RIR 1')).toBeInTheDocument()
    expect(screen.queryByText('Serie 1 - 80 kg - 6 reps - RIR 2')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Ver series de Remo T/i }))

    expect(screen.getByText('Serie 1 - 80 kg - 6 reps - RIR 2')).toBeInTheDocument()
    expect(screen.queryByText('Serie 1 - 60 kg - 8 reps - RIR 1')).not.toBeInTheDocument()
  })

  it('edits a set from the active exercise context', async () => {
    render(<WorkoutPage />)

    fireEvent.click(screen.getByRole('button', { name: /Ver series de Press inclinado/i }))
    fireEvent.click(screen.getByRole('button', { name: /Editar serie 1 de Press inclinado/i }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/i }))

    await waitFor(() => {
      expect(updateMainSet).toHaveBeenCalledWith('set-1', expect.objectContaining({ reps: 8, rir: 1, weightKg: 60 }))
    })
  })

  it('deletes a set from the active exercise context', async () => {
    render(<WorkoutPage />)

    fireEvent.click(screen.getByRole('button', { name: /Ver series de Press inclinado/i }))
    fireEvent.click(screen.getByRole('button', { name: /Eliminar serie 1 de Press inclinado/i }))

    await waitFor(() => {
      expect(confirmDanger).toHaveBeenCalledWith('Eliminar serie', 'Se borrara esta serie y sus drop sets.')
      expect(deleteMainSet).toHaveBeenCalledWith('set-1')
    })
  })

  it('keeps a manually selected workout day after same-day reload', () => {
    workoutMocks.setLogs = []

    render(<WorkoutPage />)
    fireEvent.click(screen.getByRole('button', { name: /Cambiar rutina/i }))
    fireEvent.change(screen.getByLabelText(/Dia de entrenamiento/i), { target: { value: 'day-2' } })
    cleanup()

    render(<WorkoutPage />)

    expect(screen.getByText('Mi rutina actual - Dia 2')).toBeInTheDocument()
  })

  it('uses the weekday default when the stored manual day belongs to a previous date', () => {
    window.localStorage.setItem(
      'arsen.workoutDaySelection.v1',
      JSON.stringify({ date: '2026-07-19', selectionsByRoutineId: { 'routine-1': 'day-2' } }),
    )

    render(<WorkoutPage />)

    expect(screen.getByText('Mi rutina actual - Dia 1')).toBeInTheDocument()
  })

  it('shows when the manually selected day is off calendar', () => {
    workoutMocks.setLogs = []

    render(<WorkoutPage />)
    fireEvent.click(screen.getByRole('button', { name: /Cambiar rutina/i }))
    fireEvent.change(screen.getByLabelText(/Dia de entrenamiento/i), { target: { value: 'day-2' } })

    expect(screen.getByText('Fuera de calendario')).toBeInTheDocument()
  })

  it('blocks routine changes in the sheet when today has registered sets', () => {
    render(<WorkoutPage />)
    fireEvent.click(screen.getByRole('button', { name: /Cambiar rutina/i }))
    const routineSelect = screen.getByLabelText(/Rutina activa/i)

    expect(routineSelect).toBeDisabled()
    expect(screen.getByText(/No puedes cambiar este entreno/i)).toBeInTheDocument()
    fireEvent.change(routineSelect, { target: { value: 'routine-2' } })
    expect(setActiveRoutine).not.toHaveBeenCalled()
  })

  it('blocks routine changes when today has any registered set', () => {
    workoutMocks.setLogs = [{ ...setLog, kind: 'warmup' }]

    render(<WorkoutPage />)
    fireEvent.click(screen.getByRole('button', { name: /Cambiar rutina/i }))

    expect(screen.getByLabelText(/Rutina activa/i)).toBeDisabled()
    expect(screen.getByText(/No puedes cambiar este entreno/i)).toBeInTheDocument()
  })

  it('blocks day changes in the sheet when today has registered sets', () => {
    render(<WorkoutPage />)
    fireEvent.click(screen.getByRole('button', { name: /Cambiar rutina/i }))
    const daySelect = screen.getByLabelText(/Dia de entrenamiento/i)

    expect(daySelect).toBeDisabled()
    fireEvent.change(daySelect, { target: { value: 'day-2' } })
    expect(screen.getByText('Mi rutina actual - Dia 1')).toBeInTheDocument()
  })

  it('changes routine when today has no registered sets', async () => {
    workoutMocks.setLogs = []

    render(<WorkoutPage />)
    fireEvent.click(screen.getByRole('button', { name: /Cambiar rutina/i }))
    fireEvent.change(screen.getByLabelText(/Rutina activa/i), { target: { value: 'routine-2' } })

    await waitFor(() => {
      expect(setActiveRoutine).toHaveBeenCalledWith('routine-2')
    })
  })

  it('allows routine changes after finishing today session even if it has registered sets', async () => {
    workoutMocks.sessionStatus = 'completed'

    render(<WorkoutPage />)
    fireEvent.click(screen.getByRole('button', { name: /Cambiar rutina/i }))
    const routineSelect = screen.getByLabelText(/Rutina activa/i)

    expect(routineSelect).not.toBeDisabled()
    fireEvent.change(routineSelect, { target: { value: 'routine-2' } })

    await waitFor(() => {
      expect(setActiveRoutine).toHaveBeenCalledWith('routine-2')
    })
  })

  it('selects the next logical rotation day from the sheet action', () => {
    workoutMocks.setLogs = []
    workoutMocks.rotationStatus = {
      daysWithoutTraining: 0,
      missedScheduledDay: false,
      nextDay: day2,
      sessionsWithMainSets: [],
      shouldShow: false,
    }

    render(<WorkoutPage />)
    fireEvent.click(screen.getByRole('button', { name: /Cambiar rutina/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continuar con el siguiente dia/i }))

    expect(screen.getByText('Mi rutina actual - Dia 2')).toBeInTheDocument()
  })

  it('offers undo after changing day', () => {
    workoutMocks.setLogs = []

    render(<WorkoutPage />)
    fireEvent.click(screen.getByRole('button', { name: /Cambiar rutina/i }))
    fireEvent.change(screen.getByLabelText(/Dia de entrenamiento/i), { target: { value: 'day-2' } })

    expect(screen.getByText(/Antes: Mi rutina actual - Dia 1/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Deshacer/i }))
    expect(screen.getByText('Mi rutina actual - Dia 1')).toBeInTheDocument()
  })

  it('dismisses the undo alert without reverting the selection', () => {
    workoutMocks.setLogs = []

    render(<WorkoutPage />)
    fireEvent.click(screen.getByRole('button', { name: /Cambiar rutina/i }))
    fireEvent.change(screen.getByLabelText(/Dia de entrenamiento/i), { target: { value: 'day-2' } })

    fireEvent.click(screen.getByRole('button', { name: /Quitar aviso de cambio/i }))

    expect(screen.queryByText(/Antes: Mi rutina actual - Dia 1/i)).not.toBeInTheDocument()
    expect(screen.getByText('Mi rutina actual - Dia 2')).toBeInTheDocument()
  })

  it('shows missed-training notice with action to resume the logical next day', () => {
    workoutMocks.setLogs = []
    workoutMocks.rotationStatus = {
      daysWithoutTraining: 3,
      missedScheduledDay: false,
      nextDay: day2,
      sessionsWithMainSets: [],
      shouldShow: true,
    }

    render(<WorkoutPage />)

    expect(screen.getByText(/Llevas 3 dias sin entrenar/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Retomar Dia 2/i }))
    expect(screen.getByText('Mi rutina actual - Dia 2')).toBeInTheDocument()
  })

  it('does not show missed-training notice again after dismissal on the same date', () => {
    workoutMocks.rotationStatus = {
      daysWithoutTraining: 3,
      missedScheduledDay: false,
      nextDay: day2,
      sessionsWithMainSets: [],
      shouldShow: true,
    }

    render(<WorkoutPage />)
    fireEvent.click(screen.getByRole('button', { name: /Descartar aviso de dias faltantes/i }))
    cleanup()
    render(<WorkoutPage />)

    expect(screen.queryByText(/Llevas 3 dias sin entrenar/i)).not.toBeInTheDocument()
  })
})

const exercise: RoutineExercise = {
  assetKind: null,
  bundledAssetId: null,
  canonicalName: 'press-inclinado',
  createdAt: '2026-07-20T00:00:00.000Z',
  currentWeightKg: 60,
  customAssetId: null,
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

const otherExercise: RoutineExercise = {
  ...exercise,
  canonicalName: 'remo-t',
  id: 'exercise-2',
  mainMuscle: 'Espalda',
  name: 'Remo T',
  order: 1,
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

const day2 = {
  ...day,
  description: 'Lower',
  id: 'day-2',
  name: 'Dia 2',
  order: 1,
  weekday: 2,
} as const

const day2Exercise: RoutineExercise = {
  ...exercise,
  canonicalName: 'sentadilla',
  dayId: day2.id,
  id: 'exercise-3',
  mainMuscle: 'Piernas',
  name: 'Sentadilla',
  order: 0,
}

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

const routine2 = {
  ...routine,
  id: 'routine-2',
  isActive: false,
  name: 'Rutina alterna',
}

const otherExerciseLog: ExerciseLog = {
  ...exerciseLog,
  id: 'exercise-log-2',
  routineExerciseId: otherExercise.id,
  snapshot: {
    ...exerciseLog.snapshot,
    canonicalName: otherExercise.canonicalName,
    mainMuscle: otherExercise.mainMuscle,
    name: otherExercise.name,
  },
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

const referenceSetLog: SetLog = {
  ...setLog,
  createdAt: '2026-07-18T00:00:00.000Z',
  id: 'reference-set-1',
  reps: 9,
  rir: 2,
  updatedAt: '2026-07-18T00:00:00.000Z',
  weightKg: 62.5,
}

const referenceDropSet: DropSetLog = {
  createdAt: '2026-07-18T00:00:00.000Z',
  displayUnit: 'kg',
  id: 'reference-drop-1',
  order: 0,
  reps: 8,
  rir: 3,
  setLogId: referenceSetLog.id,
  updatedAt: '2026-07-18T00:00:00.000Z',
  weightKg: 45,
}
const otherSetLog: SetLog = {
  ...setLog,
  exerciseLogId: otherExerciseLog.id,
  id: 'set-2',
  reps: 6,
  rir: 2,
  weightKg: 80,
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
