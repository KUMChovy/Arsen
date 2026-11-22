// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { RoutineWeightReview } from './RoutineWeightReview'

it('only submits the changes explicitly selected for confirmation', () => {
  const onConfirm = vi.fn()
  const proposals = [
    { exerciseId: 'a', name: 'Press', previousWeightKg: 60, proposedWeightKg: 70, setId: 'one' },
    { exerciseId: 'b', name: 'Remo', previousWeightKg: 30, proposedWeightKg: 40, setId: 'two' },
  ]
  render(<RoutineWeightReview disabled={false} onConfirm={onConfirm} proposals={proposals} unit="kg" />)
  expect(screen.getByRole('button', { name: 'Confirmar cambios' })).toBeDisabled()
  fireEvent.click(screen.getByRole('checkbox', { name: /Press/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar cambios' }))
  expect(onConfirm).toHaveBeenCalledWith([proposals[0]])
})
