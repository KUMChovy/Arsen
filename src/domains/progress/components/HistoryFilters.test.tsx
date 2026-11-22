// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HistoryFilters } from './HistoryFilters'

describe('HistoryFilters', () => {
  it('keeps filters compact and applies a single date', () => {
    const onChange = vi.fn()
    render(<HistoryFilters filters={{ period: 'all' }} onChange={onChange} onClear={vi.fn()} />)

    expect(screen.getByText('Filtros').closest('details')).not.toHaveAttribute('open')
    fireEvent.click(screen.getByText('Filtros'))
    expect(screen.getByRole('combobox', { name: 'Periodo del historial' })).toHaveValue('all')
    fireEvent.change(screen.getByLabelText('Fecha del historial'), { target: { value: '2026-08-01' } })

    expect(onChange).toHaveBeenCalledWith({ startDate: '2026-08-01', endDate: '2026-08-01' })
  })
})
