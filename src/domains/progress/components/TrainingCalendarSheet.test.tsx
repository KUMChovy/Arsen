// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TrainingCalendarSheet } from './TrainingCalendarSheet'

describe('TrainingCalendarSheet', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-12T12:00:00'))
  })

  it('selects an untrained past date for manual session creation', () => {
    const onSelect = vi.fn()
    render(<TrainingCalendarSheet dates={['2026-08-10']} onClose={vi.fn()} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Crear sesion del 9 ago 2026' }))

    expect(onSelect).toHaveBeenCalledWith('2026-08-09', false)
  })

  it('keeps trained dates selectable as history dates', () => {
    const onSelect = vi.fn()
    render(<TrainingCalendarSheet dates={['2026-08-10']} onClose={vi.fn()} onSelect={onSelect} />)

    fireEvent.click(screen.getByRole('button', { name: 'Ver sesiones del 10 ago 2026' }))

    expect(onSelect).toHaveBeenCalledWith('2026-08-10', true)
  })

  it('does not allow selecting future dates', () => {
    const onSelect = vi.fn()
    render(<TrainingCalendarSheet dates={['2026-08-10']} onClose={vi.fn()} onSelect={onSelect} />)

    expect(screen.getByRole('button', { name: 'Crear sesion del 13 ago 2026' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Crear sesion del 13 ago 2026' }))

    expect(onSelect).not.toHaveBeenCalled()
  })
})
