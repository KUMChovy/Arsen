// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoutineExercise } from '../../routine/types'
import { registerMainSetForExercise } from '../services'
import { RegisterSetSheet } from './RegisterSetSheet'

vi.mock('../services', () => ({
  registerMainSetForExercise: vi.fn(() => Promise.resolve({ exerciseLogId: 'log-1', sessionId: 'session-1', setLogId: 'set-1' })),
}))

describe('RegisterSetSheet', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('saves main set with drop set and closes sheet', async () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)

    fireEvent.change(screen.getByLabelText('KG'), { target: { value: '80' } })
    fireEvent.change(screen.getAllByLabelText('Reps')[0]!, { target: { value: '6' } })
    fireEvent.change(screen.getAllByLabelText('RIR')[0]!, { target: { value: '1' } })
    fireEvent.click(screen.getByLabelText('Agregar drop set'))
    fireEvent.change(screen.getByLabelText('KG drop'), { target: { value: '64' } })
    fireEvent.change(screen.getAllByLabelText('Reps')[1]!, { target: { value: '10' } })
    fireEvent.change(screen.getAllByLabelText('RIR')[1]!, { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar serie/i }))

    await waitFor(() => {
      expect(registerMainSetForExercise).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2026-07-20',
          dayId: 'day-1',
          displayUnit: 'kg',
          dropSet: { reps: 10, rir: 2, weightKg: 64 },
          reps: 6,
          rir: 1,
          routineId: 'routine-1',
          weightKg: 80,
        }),
      )
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('cancels and closes sheet', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalled()
  })
})

function Sheet({ onClose }: { onClose: () => void }) {
  return (
    <RegisterSetSheet
      date="2026-07-20"
      dayId="day-1"
      displayUnit="kg"
      exercise={exercise}
      onClose={onClose}
      routineId="routine-1"
    />
  )
}

const exercise: RoutineExercise = {
  canonicalName: 'press-inclinado',
  createdAt: '2026-07-20T00:00:00.000Z',
  currentWeightKg: 60,
  dayId: 'day-1',
  equipment: 'Barra',
  id: 'exercise-1',
  mainMuscle: 'Pecho',
  name: 'Press inclinado',
  order: 0,
  progression: '',
  recommendedRir: '1-2',
  repsMax: 10,
  repsMin: 8,
  rest: '90 seg',
  restSeconds: 90,
  routineId: 'routine-1',
  sourceExerciseId: null,
  targetSets: 4,
  technicalNotes: '',
  updatedAt: '2026-07-20T00:00:00.000Z',
  warmupProtocol: '',
  warmupSets: 2,
}
