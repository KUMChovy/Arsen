// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecentSessionSummary, SessionDetail } from '../repository'
import { ProgressHistoryDatePage } from './ProgressHistoryDatePage'

const progressMocks = vi.hoisted(() => ({
  detail: null as SessionDetail | null,
  sessions: [] as RecentSessionSummary[],
}))

vi.mock('../hooks', () => ({
  useExistingSessionForDateAndDay: () => null,
  useProgressEditOptions: () => ({ routines: [], days: [], exercises: [] }),
  useSessionDetail: () => progressMocks.detail,
  useSessionsForDate: () => progressMocks.sessions,
}))

vi.mock('../../routine/hooks', () => ({
  useRoutineDayDetail: () => null,
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (callback: () => unknown) => callback(),
}))

vi.mock('../../settings/services', () => ({
  getAppSettings: () => ({ preferredUnit: 'lb', healthIntegrationEnabled: false }),
}))

vi.mock('../../workout/services', () => ({
  deleteMainSet: vi.fn(),
  deleteWorkoutSession: vi.fn(),
  moveMainSetToExercise: vi.fn(),
  registerMainSetForExercise: vi.fn(),
  updateMainSet: vi.fn(),
  updateWorkoutSession: vi.fn(),
}))

describe('ProgressHistoryDatePage', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    progressMocks.detail = null
    progressMocks.sessions = []
  })

  it('shows create session action on an empty date', () => {
    renderPage()

    expect(screen.getByRole('button', { name: /Crear sesion/i })).toBeInTheDocument()
    expect(screen.getByText(/No hay sesiones para esta fecha/i)).toBeInTheDocument()
  })

  it('shows create session action when the date already has sessions', () => {
    progressMocks.sessions = [
      {
        bestSetId: 'set-1',
        bestSetLabel: '60 kg x 8',
        date: '2026-08-01',
        dayName: 'Dia A',
        exerciseCount: 1,
        id: 'session-1',
        routineName: 'Rutina A',
        setCount: 1,
        volumeKg: 480,
      },
    ]

    renderPage()

    expect(screen.getByRole('button', { name: /Crear sesion/i })).toBeInTheDocument()
    expect(screen.queryByText(/No hay sesiones para esta fecha/i)).not.toBeInTheDocument()
  })

  it('opens the create session sheet from the calendar create URL', () => {
    renderPage('/progreso/historial/2026-08-01?create=1')

    expect(screen.getByText(/Registra series olvidadas desde progreso/i)).toBeInTheDocument()
  })

  it('renders session weights and volume in the preferred unit', () => {
    progressMocks.sessions = [{ bestSetId: 'set-1', bestSetLabel: '60 kg x 8', date: '2026-08-01', dayName: 'Dia A', exerciseCount: 1, id: 'session-1', routineName: 'Rutina A', setCount: 1, volumeKg: 480 }]
    progressMocks.detail = {
      date: '2026-08-01',
      dayId: 'day-1',
      dayName: 'Dia A',
      exercises: [{ bundledAssetId: null, exerciseLogId: 'log-1', exerciseName: 'Press', mainMuscle: 'Pecho', routineExerciseId: 'exercise-1', sets: [{ displayUnit: 'kg', dropSets: [{ id: 'drop-1', order: 0, reps: 5, rir: 1, weightKg: 50 }], id: 'set-1', order: 0, reps: 8, rir: 2, weightKg: 60 }] }],
      id: 'session-1',
      routineId: 'routine-1',
      routineName: 'Rutina A',
    }

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Expandir sesion/i }))

    expect(screen.getByText(/Mejor 132.3 lb x 8 - 1058.2 lb volumen/)).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.tagName === 'STRONG' && element.textContent?.includes('132.3 lb') === true)).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.tagName === 'DIV' && element.childElementCount === 0 && element.textContent?.includes('Drop 1:') === true && element.textContent.includes('110.2 lb') === true)).toBeInTheDocument()
  })
})

function renderPage(initialEntry = '/progreso/historial/2026-08-01') {
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route element={<ProgressHistoryDatePage />} path="/progreso/historial/:date" />
      </Routes>
    </MemoryRouter>,
  )
}
