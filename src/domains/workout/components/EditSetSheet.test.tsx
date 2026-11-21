// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { EditSetSheet } from './EditSetSheet'
import { confirmDanger } from '../../../shared/utils/alerts'

vi.mock('../../../shared/utils/alerts', () => ({ confirmDanger: vi.fn(() => Promise.resolve(false)) }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

it('protects changes and exposes a focused edit dialog', async () => {
  const onClose = vi.fn()
  render(<EditSetSheet disabled={false} dropSets={[]} onClose={onClose} onDelete={async () => {}} onSave={async () => {}} set={{ id: 'set', order: 0, reps: 8, rir: 2, weightKg: 60 }} unit="kg" />)
  expect(screen.getByRole('dialog', { name: 'Editar serie' })).toContainElement(document.activeElement as HTMLElement)
  fireEvent.change(screen.getByLabelText('KG'), { target: { value: '70' } })
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
  await waitFor(() => expect(confirmDanger).toHaveBeenCalled())
  expect(onClose).not.toHaveBeenCalled()
})

it('adjusts edited weight and repetitions with steppers', () => {
  render(<EditSetSheet disabled={false} dropSets={[]} onClose={() => {}} onDelete={async () => {}} onSave={async () => {}} set={{ id: 'set', order: 0, reps: 8, rir: 2, weightKg: 60 }} unit="kg" />)
  fireEvent.click(screen.getByRole('button', { name: 'Aumentar KG' }))
  fireEvent.click(screen.getByRole('button', { name: 'Reducir Reps' }))
  expect(screen.getByLabelText('KG')).toHaveValue(62.5)
  expect(screen.getByLabelText('Reps')).toHaveValue(7)
})

it('allows editing a bodyweight set with zero external load', async () => {
  const onSave = vi.fn(async () => {})
  render(<EditSetSheet disabled={false} dropSets={[]} onClose={() => {}} onDelete={async () => {}} onSave={onSave} set={{ id: 'set', order: 0, reps: 8, rir: 2, weightKg: 0 }} unit="kg" />)
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ main: { weightKg: 0, reps: 8, rir: 2 } })))
})

it('blocks repeated saves while an edit is being saved', () => {
  const onSave = vi.fn(() => new Promise<void>(() => {}))
  render(<EditSetSheet disabled={false} dropSets={[]} onClose={() => {}} onDelete={async () => {}} onSave={onSave} set={{ id: 'set', order: 0, reps: 8, rir: 2, weightKg: 60 }} unit="kg" />)
  const save = screen.getByRole('button', { name: 'Guardar cambios' })
  fireEvent.click(save)
  expect(save).toBeDisabled()
  fireEvent.click(save)
  expect(onSave).toHaveBeenCalledOnce()
})
