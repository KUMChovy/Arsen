// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProgressExercisePage } from './ProgressExercisePage'

vi.mock('../hooks', () => ({
  useProgressExerciseDetail: () => ({
    bestEstimatedOneRmKg: 90,
    bundledAssetId: null,
    canonicalName: 'press-inclinado',
    lastSessionDate: '2026-08-10',
    mainMuscle: 'Pecho',
    maxWeightKg: 80,
    name: 'Press inclinado',
    sessionCount: 3,
    sessions: [
      { bestSetId: 'set-1', bestSetLabel: '70 kg x 8', date: '2026-08-01', dayName: 'Día A', estimatedOneRmKg: 88.6, mainSetCount: 2, maxReps: 8, maxWeightKg: 70, routineName: 'Rutina A', sessionId: 'session-1', volumeKg: 900 },
      { bestSetId: 'set-2', bestSetLabel: '80 kg x 6', date: '2026-08-10', dayName: 'Día A', estimatedOneRmKg: 96, mainSetCount: 2, maxReps: 6, maxWeightKg: 80, routineName: 'Rutina A', sessionId: 'session-2', volumeKg: 1000 },
      { bestSetId: null, bestSetLabel: 'Sin series', date: '2026-08-15', dayName: 'Día A', estimatedOneRmKg: null, mainSetCount: 0, maxReps: null, maxWeightKg: null, routineName: 'Rutina A', sessionId: 'session-3', volumeKg: 0 },
    ],
  }),
}))

vi.mock('../../settings/services', () => ({ getAppSettings: () => Promise.resolve({ preferredUnit: 'kg' }) }))

describe('ProgressExercisePage', () => {
  afterEach(() => cleanup())

  it('shows metric choices, latest comparison and original session links', () => {
    render(<MemoryRouter initialEntries={['/progreso/ejercicio/press-inclinado']}><Routes><Route element={<ProgressExercisePage />} path="/progreso/ejercicio/:canonicalName" /></Routes></MemoryRouter>)

    expect(screen.getByRole('heading', { name: 'Press inclinado' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Métrica de progreso' })).toBeInTheDocument()
    expect(screen.getByText(/Comparación con sesión anterior/i)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Ver sesión/i })).toHaveLength(3)
  })

  it('does not plot unavailable metric values as zero', () => {
    render(<MemoryRouter initialEntries={['/progreso/ejercicio/press-inclinado']}><Routes><Route element={<ProgressExercisePage />} path="/progreso/ejercicio/:canonicalName" /></Routes></MemoryRouter>)

    fireEvent.change(screen.getByRole('combobox', { name: 'Métrica de progreso' }), { target: { value: 'weight' } })

    expect(screen.queryByText(/2026-08-15: 0 kg/)).not.toBeInTheDocument()
  })
})
