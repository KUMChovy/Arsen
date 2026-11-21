// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HistoryView } from './HistoryView'

describe('HistoryView', () => {
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
})
