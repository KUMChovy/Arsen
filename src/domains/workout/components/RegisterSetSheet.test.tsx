// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoutineExercise } from '../../routine/types'
import { registerMainSetForExercise, skipRoutineExerciseForDay } from '../services'
import { RegisterSetSheet } from './RegisterSetSheet'

vi.mock('../services', () => ({
  registerMainSetForExercise: vi.fn(() => Promise.resolve({ exerciseLogId: 'log-1', sessionId: 'session-1', setLogId: 'set-1' })),
  skipRoutineExerciseForDay: vi.fn(() => Promise.resolve('session-1')),
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
    const onSaved = vi.fn()
    render(<Sheet onClose={onClose} onSaved={onSaved} />)

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
      expect(onSaved).toHaveBeenCalledWith(90)
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('skips current exercise and closes sheet', async () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Saltar' }))

    await waitFor(() => {
      expect(skipRoutineExerciseForDay).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2026-07-20',
          dayId: 'day-1',
          displayUnit: 'kg',
          exercise,
          routineId: 'routine-1',
        }),
      )
      expect(onClose).toHaveBeenCalled()
    })
  })
})

function Sheet({ onClose, onSaved = vi.fn() }: { onClose: () => void; onSaved?: (restSeconds: number) => void }) {
  return (
    <RegisterSetSheet
      date="2026-07-20"
      dayId="day-1"
      displayUnit="kg"
      exercise={exercise}
      onClose={onClose}
      onSaved={onSaved}
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
  repRange: '8-10',
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
