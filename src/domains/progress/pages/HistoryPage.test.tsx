// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HistoryPage } from './HistoryPage'

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), sessions: [] as any[] }))

vi.mock('react-router-dom', async () => ({ ...(await vi.importActual<typeof import('react-router-dom')>('react-router-dom')), useNavigate: () => mocks.navigate }))
vi.mock('../hooks', () => ({
  useHistory: () => ({ sessions: mocks.sessions, summary: { distinctTrainingDays: 0, exercises: 0, mainSets: 0, sessions: 0, volumeKg: 0 } }),
  usePersonalRecords: () => [],
  useProgressDayOptions: () => [{ dayId: 'day-1', name: 'Día', routineId: 'routine-1', routineName: 'Rutina' }],
  useProgressExerciseOptions: () => [{ canonicalName: 'press', name: 'Press' }],
}))

describe('HistoryPage', () => {
  afterEach(() => { cleanup(); mocks.navigate.mockReset(); mocks.sessions = [] })

  it('is a standalone history workspace without the legacy calendar sheet', () => {
    render(<MemoryRouter><HistoryPage /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Historial' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Lista' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Calendario' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Calendario' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('button', { name: 'Abrir calendario' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Filtros'))
    expect(screen.getByRole('combobox', { name: 'Periodo del historial' })).toBeInTheDocument()
  })

  it('honors an explicit list mode from the URL', () => {
    render(<MemoryRouter initialEntries={['/historial?modo=list']}><HistoryPage /></MemoryRouter>)

    expect(screen.getByRole('tab', { name: 'Lista' })).toHaveAttribute('aria-selected', 'true')
  })

  it('opens with the routine filter passed from planning', () => {
    render(<MemoryRouter initialEntries={['/historial?rutina=routine-1']}><HistoryPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('Filtros'))
    expect(screen.getByRole('combobox', { name: 'Rutina del historial' })).toHaveValue('routine-1')
  })

  it('opens the selected calendar date as a day detail', () => {
    mocks.sessions = [{ sessionId: 'session-1', date: '2026-08-01', exerciseCount: 1, mainSetCount: 1, volumeKg: 20 }]
    render(<MemoryRouter><HistoryPage /></MemoryRouter>)
    fireEvent.click(screen.getByText('Filtros'))
    fireEvent.change(screen.getByRole('combobox', { name: 'Ejercicio del historial' }), { target: { value: 'press' } })
    fireEvent.click(screen.getByRole('button', { name: /Ver sesiones del 1 ago 2026/ }))
    expect(mocks.navigate).toHaveBeenCalledWith('/progreso/historial/2026-08-01?exercise=press')
  })
})
