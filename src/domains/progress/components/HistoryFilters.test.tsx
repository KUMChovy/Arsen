// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HistoryFilters } from './HistoryFilters'

describe('HistoryFilters', () => {
  it('updates search and exposes all-history as the default period', () => {
    const onChange = vi.fn()
    render(<HistoryFilters filters={{ period: 'all' }} onChange={onChange} onClear={vi.fn()} />)

    expect(screen.getByRole('combobox', { name: 'Periodo del historial' })).toHaveValue('all')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en historial' }), { target: { value: 'bíceps' } })

    expect(onChange).toHaveBeenCalledWith({ search: 'bíceps' })
  })
})
