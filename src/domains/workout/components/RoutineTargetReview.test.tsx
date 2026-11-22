// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { RoutineTargetReview } from './RoutineTargetReview'

it('lets the user approve repetitions without also changing the number of sets', () => {
  const onConfirm = vi.fn()
  const proposals = [
    { exerciseId: 'a', name: 'Press', field: 'sets' as const, previous: '3', proposed: '2' },
    { exerciseId: 'a', name: 'Press', field: 'reps' as const, previous: '8–10', proposed: '6–7' },
  ]
  const { rerender } = render(<RoutineTargetReview disabled={false} onConfirm={onConfirm} proposals={proposals} />)
  fireEvent.click(screen.getByRole('checkbox', { name: /Press.*Repeticiones/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar objetivos' }))
  expect(onConfirm).toHaveBeenCalledWith([proposals[1]])
  rerender(<RoutineTargetReview disabled={false} onConfirm={onConfirm} proposals={[proposals[0]!]} />)
  expect(screen.getByRole('button', { name: 'Confirmar objetivos' })).toBeDisabled()
})
