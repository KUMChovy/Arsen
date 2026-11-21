// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HistoryPage } from './HistoryPage'

const mocks = vi.hoisted(() => ({ navigate: vi.fn() }))

vi.mock('react-router-dom', async () => ({ ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')), useNavigate: () => mocks.navigate }))
vi.mock('../hooks', () => ({
  useHistory: () => ({ sessions: [], summary: { distinctTrainingDays: 0, exercises: 0, mainSets: 0, sessions: 0, volumeKg: 0 } }),
  usePersonalRecords: () => [],
  useProgressDayOptions: () => [],
  useProgressExerciseOptions: () => [],
}))

describe('HistoryPage', () => {
  afterEach(() => { cleanup(); mocks.navigate.mockReset() })

  it('is a standalone history workspace without the legacy calendar sheet', () => {
    render(<MemoryRouter><HistoryPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Historial' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Lista' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Calendario' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Calendario' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('button', { name: 'Abrir calendario' })).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en historial' }), { target: { value: 'press' } })
  })

  it('honors an explicit list mode from the URL', () => {
    render(<MemoryRouter initialEntries={['/historial?modo=list']}><HistoryPage /></MemoryRouter>)

    expect(screen.getByRole('tab', { name: 'Lista' })).toHaveAttribute('aria-selected', 'true')
  })
})
