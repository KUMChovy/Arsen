// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProgressHistorySessionPage } from './ProgressHistorySessionPage'
import type { SessionDetail } from '../repository'

const mocks = vi.hoisted(() => ({ detail: null as SessionDetail | null | undefined, updateSession: vi.fn(), updateSet: vi.fn(), updateDrop: vi.fn(), addDrop: vi.fn(), deleteDrop: vi.fn(), deleteSet: vi.fn() }))

vi.mock('../hooks', () => ({
  useHistory: () => ({ sessions: [] }),
  useProgressEditOptions: () => ({ routines: [{ id: 'routine-a', name: 'Rutina A' }], days: [{ id: 'day-a', name: 'Día A', routineId: 'routine-a', routineName: 'Rutina A' }], exercises: [{ id: 'exercise-1', name: 'Press inclinado', routineId: 'routine-a', dayId: 'day-a' }] }),
  useSessionDetailById: () => mocks.detail,
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => ({ healthIntegrationEnabled: false, preferredUnit: 'kg' }),
}))

vi.mock('../../settings/services', () => ({ getAppSettings: vi.fn(() => Promise.resolve({ healthIntegrationEnabled: false, preferredUnit: 'kg' })) }))
vi.mock('../../workout/services', () => ({ addDropSet: mocks.addDrop, deleteDropSet: mocks.deleteDrop, deleteMainSet: mocks.deleteSet, updateDropSet: mocks.updateDrop, updateHistoricalSession: mocks.updateSession, updateHistoricalSet: mocks.updateSet }))

describe('ProgressHistorySessionPage', () => {
  afterEach(() => { cleanup(); mocks.detail = null; mocks.updateSession.mockReset(); mocks.updateSet.mockReset(); mocks.updateDrop.mockReset(); mocks.addDrop.mockReset(); mocks.deleteDrop.mockReset(); mocks.deleteSet.mockReset() })

  it('starts with exercise details collapsed and lets the user open them', () => {
    mocks.detail = detailFixture()
    renderPage()
    expect(screen.getByRole('button', { name: 'Expandir Press inclinado' })).toBeInTheDocument()
    expect(screen.queryByText('Resumen del ejercicio')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expandir Press inclinado' }))
    expect(screen.getByText('Resumen del ejercicio')).toBeInTheDocument()
  })

  it('renders one session with notes, status, drop sets and a progress link', () => {
    mocks.detail = detailFixture()
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Expandir Press inclinado' }))

    expect(screen.getByRole('heading', { name: /Rutina A/i })).toBeInTheDocument()
    expect(screen.getByText('Buena sesión')).toBeInTheDocument()
    expect(screen.getByText(/Drop 1 · 45 kg × 8 · RIR 1/)).toBeInTheDocument()
    expect(screen.getByText('Completada')).toBeInTheDocument()
    expect(screen.getByText('Resumen del ejercicio')).toBeInTheDocument()
    expect(screen.getAllByText('Series principales').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: /Ver progreso de Press inclinado/i })).toHaveAttribute('href', '/progreso/ejercicio/press-inclinado')
    expect(screen.getByRole('button', { name: 'Editar serie 1' }).querySelector('svg')).toHaveClass('lucide-pencil')
  })

  it('shows a recoverable state when the session no longer exists', () => {
    mocks.detail = null
    renderPage()

    expect(screen.getByRole('heading', { name: 'Sesión no encontrada' })).toBeInTheDocument()
    expect(screen.getByText(/volver al historial/i)).toBeInTheDocument()
  })

  it('shows warmups separately from main sets', () => {
    const detail = detailFixture()
    detail.exercises[0]!.warmupSets = [{ id: 'warmup-1', order: 0, displayUnit: 'kg', weightKg: 30, reps: 10, rir: 4 }]
    mocks.detail = detail
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Expandir Press inclinado' }))
    expect(screen.getByText(/Calentamiento 1.*30 kg.*10/)).toBeInTheDocument()
  })

  it('respects the exercise selected in the calendar and allows searching the session', () => {
    const detail = detailFixture()
    detail.exercises.push({ bundledAssetId: null, canonicalName: 'remo', exerciseLogId: 'log-2', exerciseName: 'Remo', mainMuscle: 'Espalda', routineExerciseId: 'exercise-2', sets: [] })
    mocks.detail = detail
    renderPage('/progreso/historial/sesion/session-1?exercise=remo')
    expect(screen.getByRole('heading', { name: 'Remo' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Press inclinado' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Buscar y filtrar ejercicios'))
    fireEvent.change(screen.getByLabelText('Filtrar ejercicio de la sesión'), { target: { value: '' } })
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar ejercicio en la sesión' }), { target: { value: 'press' } })
    expect(screen.getByRole('heading', { name: 'Press inclinado' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Remo' })).not.toBeInTheDocument()
  })

  it('opens the session editor from the action menu', () => {
    mocks.detail = detailFixture()
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Acciones de sesión' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar sesión' }))

    expect(screen.getByRole('heading', { name: 'Editar sesión' })).toBeInTheDocument()
    expect(screen.getByLabelText('Notas de la sesión')).toHaveValue('Buena sesión')
  })

  it('uses the workout editor contract for historical sets and existing drops', () => {
    mocks.detail = detailFixture()
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Expandir Press inclinado' }))

    fireEvent.click(screen.getByRole('button', { name: 'Editar serie 1' }))

    expect(screen.getByLabelText('KG')).toHaveValue(60)
    expect(screen.getByLabelText('KG drop')).toHaveValue(45)
    expect(screen.getByText(/Editar drop set/i)).toBeInTheDocument()
  })

  it('keeps the option to move a historical set to another exercise', () => {
    mocks.detail = detailFixture()
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Expandir Press inclinado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Mover serie 1' }))
    expect(screen.getByText('Rutina')).toBeInTheDocument()
    expect(screen.getByText('Ejercicio', { selector: 'span' })).toBeInTheDocument()
  })

  it('opens a mobile-friendly, unit-aware editor for a drop set', () => {
    mocks.detail = detailFixture()
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Expandir Press inclinado' }))

    fireEvent.click(screen.getByRole('button', { name: 'Editar drop 1' }))

    expect(screen.getByRole('heading', { name: 'Editar drop' })).toBeInTheDocument()
    expect(screen.getByLabelText('KG')).toHaveValue(45)
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })
})

function renderPage(path = '/progreso/historial/sesion/session-1') {
  render(<MemoryRouter initialEntries={[path]}><Routes><Route element={<ProgressHistorySessionPage />} path="/progreso/historial/sesion/:sessionId" /></Routes></MemoryRouter>)
}

function detailFixture(): SessionDetail {
  return {
    completedAt: '2026-08-10T18:00:00.000Z',
    createdAt: '2026-08-10T16:00:00.000Z',
    date: '2026-08-10',
    dayId: 'day-a',
    dayName: 'Día A',
    displayUnit: 'kg',
    exercises: [{ bundledAssetId: null, exerciseLogId: 'log-1', exerciseName: 'Press inclinado', mainMuscle: 'Pecho', routineExerciseId: 'exercise-1', sets: [{ displayUnit: 'kg', dropSets: [{ id: 'drop-1', order: 0, reps: 8, rir: 1, weightKg: 45 }], id: 'set-1', order: 0, reps: 10, rir: 2, weightKg: 60 }] }],
    id: 'session-1',
    lastExerciseAt: '2026-08-10T17:50:00.000Z',
    notes: 'Buena sesión',
    routineId: 'routine-a',
    routineName: 'Rutina A',
    startedAt: '2026-08-10T16:00:00.000Z',
    status: 'completed',
    updatedAt: '2026-08-10T18:00:00.000Z',
  }
}
