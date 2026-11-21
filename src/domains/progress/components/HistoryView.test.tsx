// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HistoryView } from './HistoryView'

describe('HistoryView', () => {
  afterEach(cleanup)

  it('shows chronological sessions and exposes a clear-filters action', () => {
    const onClear = vi.fn()
    const onOpen = vi.fn()
    render(<HistoryView filtersActive onClearFilters={onClear} onOpenSession={onOpen} sessions={[{ bestSetId: 'set-1', bestSetLabel: '80 kg x 6', date: '2026-08-10', dayName: 'Día A', exerciseCount: 2, id: 'session-1', routineName: 'Rutina A', setCount: 4, volumeKg: 1200 }]} />)

    expect(screen.getByRole('heading', { name: 'Historial cronológico' })).toBeInTheDocument()
    expect(screen.getByText(/Rutina A/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))
    fireEvent.click(screen.getByRole('button', { name: /10 ago/i }))

    expect(onClear).toHaveBeenCalledOnce()
    expect(onOpen).toHaveBeenCalledWith('session-1')
  })

  it('switches between list and calendar and opens the exact selected session', () => {
    const onModeChange = vi.fn()
    const onOpenDate = vi.fn()
    const onOpen = vi.fn()
    render(
      <HistoryView
        filtersActive={false}
        mode="list"
        onClearFilters={vi.fn()}
        onModeChange={onModeChange}
        onOpenDate={onOpenDate}
        onOpenSession={onOpen}
        sessions={[
          { bestSetId: 'set-a', bestSetLabel: '60 kg x 8', date: '2026-08-10', dayId: 'day-a', dayName: 'Día A', dropSetCount: 1, exerciseCount: 1, mainSetCount: 2, notes: '', routineId: 'routine-a', routineName: 'Rutina A', sessionId: 'session-a', status: 'completed', volumeKg: 1000 },
          { bestSetId: 'set-b', bestSetLabel: '70 kg x 6', date: '2026-08-10', dayId: 'day-b', dayName: 'Día B', dropSetCount: 0, exerciseCount: 2, mainSetCount: 3, notes: '', routineId: 'routine-b', routineName: 'Rutina B', sessionId: 'session-b', status: 'draft', volumeKg: 900 },
        ]}
        summary={{ distinctTrainingDays: 1, exercises: 3, mainSets: 5, sessions: 2, volumeKg: 1900 }}
      />,
    )

    expect(screen.getByRole('tab', { name: 'Calendario' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Calendario' }))
    fireEvent.click(screen.getByRole('button', { name: /10 ago/i }))

    expect(onModeChange).toHaveBeenCalledWith('calendar')
    expect(onOpenDate).toHaveBeenCalledWith('2026-08-10')
  })

  it('paginates long chronological histories without hiding the total', () => {
    const sessions = Array.from({ length: 21 }, (_, index) => ({
      bestSetId: `set-${index}`,
      bestSetLabel: '60 kg x 8',
      date: `2026-08-${String(index + 1).padStart(2, '0')}`,
      dayId: 'day-a',
      dayName: 'Día A',
      dropSetCount: 0,
      exerciseCount: 1,
      mainSetCount: 2,
      notes: '',
      routineId: 'routine-a',
      routineName: `Rutina ${index + 1}`,
      sessionId: `session-${index}`,
      status: 'completed' as const,
      volumeKg: 480,
    }))

    render(<HistoryView filtersActive={false} onClearFilters={vi.fn()} onOpenSession={vi.fn()} sessions={sessions} summary={{ distinctTrainingDays: 21, exercises: 21, mainSets: 42, sessions: 21, volumeKg: 10080 }} />)

    expect(screen.getByText('Mostrando 1–20 de 21')).toBeInTheDocument()
    expect(screen.queryByText('Rutina 21')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }))

    expect(screen.getByText('Mostrando 21–21 de 21')).toBeInTheDocument()
    expect(screen.getByText(/Rutina 21/)).toBeInTheDocument()
  })
})
