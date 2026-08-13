// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoutineExercise } from '../../routine/types'
import type { ProgressEditOptions } from '../repository'
import { CreateSessionSheet } from './CreateSessionSheet'

describe('CreateSessionSheet', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-12T12:00:00'))
  })

  it('blocks saving a future date', () => {
    const onSave = vi.fn()
    render(<Sheet date="2026-08-13" onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: /Agregar serie/i }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar sesion/i }))

    expect(screen.getByText('No puedes crear sesiones en fechas futuras.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('adds a set draft and saves it with an existing-session notice', () => {
    const onSave = vi.fn()
    render(
      <CreateSessionSheet
        date="2026-08-01"
        disabled={false}
        displayUnit="kg"
        existingSession={{
          bestSetId: 'set-1',
          bestSetLabel: '60 kg x 8',
          date: '2026-08-01',
          dayName: 'Dia A',
          exerciseCount: 1,
          id: 'session-1',
          routineName: 'Rutina A',
          setCount: 1,
          volumeKg: 480,
        }}
        exercisesForDay={[exercise]}
        maxDate="2026-08-12"
        onClose={vi.fn()}
        onDateChange={vi.fn()}
        onDayChange={vi.fn()}
        onSave={onSave}
        options={options}
      />,
    )

    expect(screen.getByText('Ya existe una sesion ese dia, se agregara a ella')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('KG'), { target: { value: '80' } })
    fireEvent.change(screen.getAllByLabelText('Reps')[0]!, { target: { value: '6' } })
    fireEvent.change(screen.getAllByLabelText('RIR')[0]!, { target: { value: '1' } })
    fireEvent.click(screen.getByLabelText('Agregar drop set'))
    fireEvent.change(screen.getByLabelText('KG drop'), { target: { value: '64' } })
    fireEvent.change(screen.getAllByLabelText('Reps')[1]!, { target: { value: '10' } })
    fireEvent.change(screen.getAllByLabelText('RIR')[1]!, { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /Agregar serie/i }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar sesion/i }))

    expect(onSave).toHaveBeenCalledWith({
      date: '2026-08-01',
      dayId: 'day-1',
      routineId: 'routine-1',
      sets: [
        expect.objectContaining({
          dropSet: { reps: 10, rir: 2, weightKg: 64 },
          exercise,
          reps: 6,
          rir: 1,
          weightKg: 80,
        }),
      ],
    })
  })
})

function Sheet({ date = '2026-08-01', onSave }: { date?: string; onSave: Parameters<typeof CreateSessionSheet>[0]['onSave'] }) {
  return (
    <CreateSessionSheet
      date={date}
      disabled={false}
      displayUnit="kg"
      existingSession={null}
      exercisesForDay={[exercise]}
      maxDate="2026-08-12"
      onClose={vi.fn()}
      onDateChange={vi.fn()}
      onDayChange={vi.fn()}
      onSave={onSave}
      options={options}
    />
  )
}

const options: ProgressEditOptions = {
  routines: [{ id: 'routine-1', name: 'Rutina A' }],
  days: [{ id: 'day-1', name: 'Dia A', routineId: 'routine-1', routineName: 'Rutina A' }],
  exercises: [{ dayId: 'day-1', id: 'exercise-1', name: 'Press inclinado', routineId: 'routine-1' }],
}

const exercise: RoutineExercise = {
  assetKind: null,
  bundledAssetId: null,
  canonicalName: 'press-inclinado',
  createdAt: '2026-08-01T00:00:00.000Z',
  currentWeightKg: 60,
  customAssetId: null,
  dayId: 'day-1',
  equipment: 'Barra',
  loadMode: 'split',
  barWeightKg: 20,
  id: 'exercise-1',
  mainMuscle: 'Pecho',
  name: 'Press inclinado',
  order: 0,
  recommendedRir: 2,
  repsMax: 10,
  repsMin: 8,
  rest: '90 seg',
  restSeconds: 90,
  routineId: 'routine-1',
  sourceExerciseId: null,
  targetSets: 4,
  technicalNotes: '',
  updatedAt: '2026-08-01T00:00:00.000Z',
  warmupProtocol: '',
  warmupSets: 0,
}
