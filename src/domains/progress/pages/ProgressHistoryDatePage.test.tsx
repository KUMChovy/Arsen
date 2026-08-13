// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RecentSessionSummary } from '../repository'
import { ProgressHistoryDatePage } from './ProgressHistoryDatePage'

const progressMocks = vi.hoisted(() => ({
  sessions: [] as RecentSessionSummary[],
}))

vi.mock('../hooks', () => ({
  useExistingSessionForDateAndDay: () => null,
  useProgressEditOptions: () => ({ routines: [], days: [], exercises: [] }),
  useSessionDetail: () => null,
  useSessionsForDate: () => progressMocks.sessions,
}))

vi.mock('../../routine/hooks', () => ({
  useRoutineDayDetail: () => null,
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (callback: () => unknown) => callback(),
}))

vi.mock('../../settings/services', () => ({
  getAppSettings: () => Promise.resolve({ preferredUnit: 'kg' }),
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
