// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ExerciseActions } from './ExerciseActions'

afterEach(cleanup)

it('offers accessible ordering and moving to another day', () => {
  const onMove = vi.fn()
  const onReorder = vi.fn()
  render(<ExerciseActions days={[{ id: 'day-2', name: 'Pierna' }]} disabled={false} exerciseName="Press" onDelete={() => {}} onDuplicate={() => {}} onEdit={() => {}} onMove={onMove} onReorder={onReorder} canMoveDown canMoveUp />)
  const trigger = screen.getByRole('button', { name: 'Acciones de Press' })
  expect(trigger).toHaveAttribute('aria-label', 'Acciones de Press')
  trigger.focus()
  fireEvent.click(trigger)
  expect(screen.getByRole('dialog', { name: 'Acciones de Press' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Subir' }))
  fireEvent.click(trigger)
  fireEvent.change(screen.getByLabelText('Mover Press a otro día'), { target: { value: 'day-2' } })
  expect(onReorder).toHaveBeenCalledWith('up')
  expect(onMove).toHaveBeenCalledWith('day-2')
  fireEvent.click(trigger)
  fireEvent.keyDown(screen.getByRole('button', { name: 'Subir' }), { key: 'Escape' })
  expect(screen.queryByRole('dialog', { name: 'Acciones de Press' })).not.toBeInTheDocument()
  expect(trigger).toHaveFocus()
})

it('closes the menu after choosing an action', () => {
  const onEdit = vi.fn()
  render(<ExerciseActions days={[]} disabled={false} exerciseName="Remo" onDelete={() => {}} onDuplicate={() => {}} onEdit={onEdit} onMove={() => {}} onReorder={() => {}} canMoveDown={false} canMoveUp={false} />)
  fireEvent.click(screen.getByRole('button', { name: 'Acciones de Remo' }))
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  expect(onEdit).toHaveBeenCalledOnce()
  expect(screen.queryByRole('dialog', { name: 'Acciones de Remo' })).not.toBeInTheDocument()
})

it('keeps keyboard focus inside the action sheet', () => {
  render(<ExerciseActions days={[]} disabled={false} exerciseName="Remo" onDelete={() => {}} onDuplicate={() => {}} onEdit={() => {}} onMove={() => {}} onReorder={() => {}} canMoveDown canMoveUp />)
  fireEvent.click(screen.getByRole('button', { name: 'Acciones de Remo' }))
  const last = screen.getByRole('button', { name: 'Quitar ejercicio' })
  last.focus()
  fireEvent.keyDown(last, { key: 'Tab' })
  expect(screen.getByRole('button', { name: 'Cerrar' })).toHaveFocus()
})

it('sets the sheet foreground even when it is rendered outside the app shell', () => {
  render(<ExerciseActions days={[]} disabled={false} exerciseName="Remo" onDelete={() => {}} onDuplicate={() => {}} onEdit={() => {}} onMove={() => {}} onReorder={() => {}} canMoveDown canMoveUp />)
  fireEvent.click(screen.getByRole('button', { name: 'Acciones de Remo' }))
  expect(screen.getByRole('dialog', { name: 'Acciones de Remo' })).toHaveClass('text-arsen-ink')
})
