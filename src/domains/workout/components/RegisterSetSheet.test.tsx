// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoutineExercise } from '../../routine/types'
import { registerMainSetForExercise } from '../services'
import { RegisterSetSheet } from './RegisterSetSheet'
import { confirmDanger } from '../../../shared/utils/alerts'

vi.mock('../services', () => ({
  registerMainSetForExercise: vi.fn(() => Promise.resolve({ exerciseLogId: 'log-1', sessionId: 'session-1', setLogId: 'set-1' })),
}))
vi.mock('../../../shared/utils/alerts', () => ({ confirmDanger: vi.fn(() => Promise.resolve(false)) }))

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

  it('reports successful saving to the parent before closing', async () => {
    const onSaved = vi.fn()
    render(<RegisterSetSheet date="2026-07-20" dayId="day-1" displayUnit="kg" exercise={exercise} onClose={vi.fn()} onSaved={onSaved} routineId="routine-1" />)
    fireEvent.click(screen.getByRole('button', { name: /Guardar serie/i }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
  })

  it('cancels and closes sheet', () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('prefills the most recent session values rather than routine defaults', () => {
    render(<RegisterSetSheet date="2026-07-20" dayId="day-1" displayUnit="kg" exercise={exercise} onClose={vi.fn()} routineId="routine-1" referenceSet={{ weightKg: 72.5, reps: 6, rir: 1 }} />)
    expect(screen.getByLabelText('KG')).toHaveValue(72.5)
    expect(screen.getByLabelText('Reps')).toHaveValue(6)
    expect(screen.getByLabelText('RIR')).toHaveValue(1)
  })

  it('adjusts weight and reps while preserving manual input', () => {
    render(<Sheet onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar KG' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reducir Reps' }))
    expect(screen.getByLabelText('KG')).toHaveValue(62.5)
    expect(screen.getByLabelText('Reps')).toHaveValue(7)
    fireEvent.change(screen.getByLabelText('KG'), { target: { value: '61' } })
    expect(screen.getByLabelText('KG')).toHaveValue(61)
  })

  it('does not submit twice while a save is pending', () => {
    vi.mocked(registerMainSetForExercise).mockImplementationOnce(() => new Promise(() => {}))
    render(<Sheet onClose={vi.fn()} />)
    const save = screen.getByRole('button', { name: /Guardar serie/i })
    fireEvent.click(save)
    expect(save).toBeDisabled()
    fireEvent.click(save)
    expect(registerMainSetForExercise).toHaveBeenCalledTimes(1)
  })

  it('does not treat an empty weight as zero', () => {
    render(<Sheet onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('KG'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Guardar serie/i }))
    expect(registerMainSetForExercise).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa')
    expect(screen.getByLabelText('KG')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('KG')).toHaveAccessibleDescription('Revisa el peso, las repeticiones y el RIR.')
  })

  it('gives the registration sheet an accessible dialog and moves focus into it', () => {
    render(<Sheet onClose={vi.fn()} />)
    const dialog = screen.getByRole('dialog', { name: /Registrar Press inclinado/ })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })

  it('closes an unchanged sheet with Escape and restores focus', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    const onClose = vi.fn()
    const view = render(<Sheet onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    view.unmount()
    expect(trigger).toHaveFocus()
    trigger.remove()
  })

  it('keeps unsaved values when discarding is declined', async () => {
    const onClose = vi.fn()
    render(<Sheet onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('KG'), { target: { value: '80' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(confirmDanger).toHaveBeenCalled())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('KG')).toHaveValue(80)
  })

  it('does not overwrite an edit when equivalent reference data is refreshed', () => {
    const props = { date: '2026-07-20', dayId: 'day-1', displayUnit: 'kg' as const, exercise, onClose: vi.fn(), routineId: 'routine-1' }
    const view = render(<RegisterSetSheet {...props} referenceSet={{ weightKg: 60, reps: 8, rir: 2 }} />)
    fireEvent.change(screen.getByLabelText('KG'), { target: { value: '70' } })
    view.rerender(<RegisterSetSheet {...props} referenceSet={{ weightKg: 60, reps: 8, rir: 2 }} />)
    expect(screen.getByLabelText('KG')).toHaveValue(70)
  })

  it('uses configured plates when recalculating the barbell note', () => {
    render(<Sheet availablePlateWeightsKg={[20, 10]} onClose={vi.fn()} />)

    expect(screen.getByText('Discos: 20 + 10 kg por lado - Total con barra: 80 kg')).toBeInTheDocument()
  })

  it('does not show plate calculator for dumbbells', () => {
    render(<Sheet exercise={{ ...exercise, equipment: 'Mancuerna', loadMode: 'single', barWeightKg: 0 }} onClose={vi.fn()} />)

    expect(screen.queryByText(/Discos:/i)).not.toBeInTheDocument()
  })

  it('recalculates the equipment load note from the entered weight', () => {
    render(<Sheet onClose={vi.fn()} />)

    expect(screen.getByText('Discos: 25 + 5 kg por lado - Total con barra: 80 kg')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('KG'), { target: { value: '40' } })

    expect(screen.getByText('Discos: 20 kg por lado - Total con barra: 60 kg')).toBeInTheDocument()
  })
})

function Sheet({
  availablePlateWeightsKg,
  exercise: sheetExercise = exercise,
  onClose,
}: {
  availablePlateWeightsKg?: number[]
  exercise?: RoutineExercise
  onClose: () => void
}) {
  return (
    <RegisterSetSheet
      date="2026-07-20"
      dayId="day-1"
      displayUnit="kg"
      availablePlateWeightsKg={availablePlateWeightsKg}
      exercise={sheetExercise}
      onClose={onClose}
      routineId="routine-1"
    />
  )
}

const exercise: RoutineExercise = {
  assetKind: null,
  bundledAssetId: null,
  canonicalName: 'press-inclinado',
  createdAt: '2026-07-20T00:00:00.000Z',
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
  updatedAt: '2026-07-20T00:00:00.000Z',
  warmupProtocol: '',
  warmupSets: 2,
}
