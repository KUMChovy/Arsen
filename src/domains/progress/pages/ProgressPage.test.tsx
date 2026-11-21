// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProgressPage } from './ProgressPage'

const progressMocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')

  return {
    ...actual,
    useNavigate: () => progressMocks.navigate,
  }
})

vi.mock('../components/TrainingCalendarSheet', () => ({
  TrainingCalendarSheet: ({ onSelect }: { onSelect: (date: string, hasTraining: boolean) => void }) => (
    <div>
      <button onClick={() => onSelect('2026-08-09', false)} type="button">
        Crear fecha pasada
      </button>
      <button onClick={() => onSelect('2026-08-10', true)} type="button">
        Ver fecha entrenada
      </button>
    </div>
  ),
}))

vi.mock('../hooks', () => ({
  useProgressDayOptions: () => [],
  useProgressExerciseOptions: () => [],
  useProgressSummary: () => ({
    averageVolumeKg: 0,
    currentPeriod: { end: '', start: '' },
    previousAverageVolumeKg: null,
    previousPeriod: null,
    previousSessionCount: 0,
    previousSessions: [],
    previousTotalSets: 0,
    previousVolumeKg: 0,
    sessionCount: 0,
    sessions: [],
    totalSets: 0,
    volumeKg: 0,
    weeklyVolume: [],
  }),
  useProgressHistory: () => [],
  useTrainingDates: () => ['2026-08-10'],
}))

vi.mock('../../settings/services', () => ({
  exportProgressCsv: vi.fn(),
  exportProgressJson: vi.fn(),
  getAppSettings: vi.fn(() => Promise.resolve(null)),
}))

vi.mock('../../health/hooks', () => ({
  useHealthProgressOverview: () => null,
}))

describe('ProgressPage', () => {
  afterEach(() => {
    cleanup()
    progressMocks.navigate.mockReset()
  })

  it('opens manual creation when the calendar selects an untrained past date', () => {
    renderPage()

    fireEvent.click(screen.getByRole('tab', { name: /Historial/i }))
    fireEvent.click(screen.getByRole('button', { name: /Crear fecha pasada/i }))

    expect(progressMocks.navigate).toHaveBeenCalledWith('/progreso/historial/2026-08-09?create=1')
  })

  it('opens history normally when the calendar selects a trained date', () => {
    renderPage()

    fireEvent.click(screen.getByRole('tab', { name: /Historial/i }))
    fireEvent.click(screen.getByRole('button', { name: /Ver fecha entrenada/i }))

    expect(progressMocks.navigate).toHaveBeenCalledWith('/progreso/historial/2026-08-10')
  })

  it('opens in Resumen and exposes the three progress views', () => {
    renderPage()

    expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Ejercicios' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Historial' })).toBeInTheDocument()
    expect(screen.queryByText(/Score|\/100/i)).not.toBeInTheDocument()
  })
})

function renderPage() {
  render(
    <MemoryRouter>
      <ProgressPage />
    </MemoryRouter>,
  )
}
