// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseCatalogItem } from '../types'
import { RoutineWizard } from './RoutineWizard'

const catalog = [{ id: 'one', name: 'Sentadilla' }, { id: 'two', name: 'Remo' }] as ExerciseCatalogItem[]
describe('asistente de rutina', () => {
  afterEach(cleanup)
  it('collects and reviews the routine before saving', () => {
    const save = vi.fn()
    render(<RoutineWizard catalog={catalog} busy={false} onClose={vi.fn()} onSave={save} />)
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Nombre de la rutina'), { target: { value: 'Mi rutina' } })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.change(screen.getByLabelText('Nombre del día 1'), { target: { value: 'Día A' } })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Sentadilla' }))
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText('Mi rutina')).toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Crear rutina' }))
    expect(save).toHaveBeenCalledWith({ name: 'Mi rutina', days: [{ name: 'Día A', exerciseIds: ['one'] }] })
  })
  it('allows cancelling without saving', () => {
    const close = vi.fn(), save = vi.fn()
    render(<RoutineWizard catalog={catalog} busy={false} onClose={close} onSave={save} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(close).toHaveBeenCalledOnce()
    expect(save).not.toHaveBeenCalled()
  })
  it('offers Sinful Shell when the personal catalog is empty', () => {
    const open = vi.fn()
    render(<RoutineWizard catalog={[]} busy={false} onClose={vi.fn()} onSave={vi.fn()} onOpenSinfulShell={open} />)
    fireEvent.change(screen.getByLabelText('Nombre de la rutina'), { target: { value: 'Mi rutina' } })
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    fireEvent.click(screen.getByRole('button', { name: /explorar sinful shell/i }))
    expect(open).toHaveBeenCalledOnce()
  })
})
