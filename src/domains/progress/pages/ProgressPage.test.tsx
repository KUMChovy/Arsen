// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProgressPage } from './ProgressPage'

const progressMocks = vi.hoisted(() => ({
  history: [] as Array<{ bestSetId: string | null; bestSetLabel: string; date: string; dayName: string; exerciseCount: number; id: string; routineName: string; setCount: number; volumeKg: number }>,
  navigate: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')

  return {
    ...actual,
    useNavigate: () => progressMocks.navigate,
  }
})

vi.mock('../hooks', () => ({
  useProgressDayOptions: () => [],
  useProgressExerciseOptions: () => [],
  useHistory: () => ({
    sessions: progressMocks.history.map((session) => ({ ...session, dayId: 'day-1', dropSetCount: 0, mainSetCount: session.setCount, notes: '', routineId: 'routine-1', sessionId: session.id, status: 'completed' as const })),
    summary: { distinctTrainingDays: new Set(progressMocks.history.map((session) => session.date)).size, exercises: progressMocks.history.reduce((total, session) => total + session.exerciseCount, 0), mainSets: progressMocks.history.reduce((total, session) => total + session.setCount, 0), sessions: progressMocks.history.length, volumeKg: progressMocks.history.reduce((total, session) => total + session.volumeKg, 0) },
  }),
  usePersonalRecords: () => [],
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
  useProgressHistory: () => progressMocks.history,
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
    progressMocks.history = []
    progressMocks.navigate.mockReset()
  })

  it('opens in Resumen and exposes the progress views without Historial', () => {
    renderPage()

    expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Ejercicios' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Historial' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Score|\/100/i)).not.toBeInTheDocument()
  })
})

function renderPage(options: { history?: Array<{ bestSetId: string | null; bestSetLabel: string; date: string; dayName: string; exerciseCount: number; id: string; routineName: string; setCount: number; volumeKg: number }> } = {}) {
  progressMocks.history = options.history ?? []
  render(
    <MemoryRouter>
      <ProgressPage />
    </MemoryRouter>,
  )
}
