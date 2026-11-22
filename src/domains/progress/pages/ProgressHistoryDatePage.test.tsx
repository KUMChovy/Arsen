// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecentSessionSummary, SessionDetail } from '../repository'
import { ProgressHistoryDatePage } from './ProgressHistoryDatePage'

const progressMocks = vi.hoisted(() => ({
  detail: null as SessionDetail | null,
  sessions: [] as RecentSessionSummary[],
  matches: null as string[] | null,
}))

vi.mock('../hooks', () => ({
  useExistingSessionForDateAndDay: () => null,
  useProgressEditOptions: () => ({ routines: [], days: [], exercises: [] }),
  useProgressExerciseOptions: () => [],
  useHistory: () => progressMocks.matches === null ? undefined : { sessions: progressMocks.matches.map((sessionId) => ({ sessionId })) },
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
    progressMocks.matches = null
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
    expect(screen.getByRole('link', { name: /Rutina A/ })).toHaveAttribute('href', '/historial/sesion/session-1')
  })

  it('opens the create session sheet from the calendar create URL', () => {
    renderPage('/progreso/historial/2026-08-01?create=1')

    expect(screen.getByText(/Registra series olvidadas desde progreso/i)).toBeInTheDocument()
  })

  it('opens each session directly while preserving the exercise filter', () => {
    progressMocks.sessions = [
      { bestSetId: null, bestSetLabel: 'Sin series', date: '2026-08-01', dayName: 'Día A', exerciseCount: 1, id: 'session-1', routineName: 'Rutina A', setCount: 0, volumeKg: 0 },
      { bestSetId: null, bestSetLabel: 'Sin series', date: '2026-08-01', dayName: 'Día B', exerciseCount: 1, id: 'session-2', routineName: 'Rutina B', setCount: 0, volumeKg: 0 },
    ]
    renderPage('/progreso/historial/2026-08-01?exercise=remo')
    expect(screen.getByRole('link', { name: /Rutina A/ })).toHaveAttribute('href', '/historial/sesion/session-1?exercise=remo')
    expect(screen.getByRole('link', { name: /Rutina B/ })).toHaveAttribute('href', '/historial/sesion/session-2?exercise=remo')
    expect(screen.queryByRole('button', { name: /Expandir sesion/i })).not.toBeInTheDocument()
  })

  it('renders the session summary in the preferred unit', () => {
    progressMocks.sessions = [{ bestSetId: 'set-1', bestSetLabel: '60 kg x 8', date: '2026-08-01', dayName: 'Dia A', exerciseCount: 1, id: 'session-1', routineName: 'Rutina A', setCount: 1, volumeKg: 480 }]
    renderPage()
    expect(screen.getByText(/Mejor 132.3 lb x 8 · 1058.2 lb volumen/)).toBeInTheDocument()
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
