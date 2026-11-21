// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExerciseExplorer } from './ExerciseExplorer'

describe('ExerciseExplorer', () => {
  it('searches the global exercise list and opens the canonical exercise', () => {
    const onOpen = vi.fn()
    render(
      <ExerciseExplorer
        onOpen={onOpen}
        options={[
          { bundledAssetId: null, canonicalName: 'press-banca', dayNames: ['Día A'], lastTrainedDate: '2026-08-10', mainMuscle: 'Pecho', name: 'Press banca', routineNames: ['Rutina A'], sessions: 3 },
          { bundledAssetId: null, canonicalName: 'sentadilla', dayNames: ['Día B'], lastTrainedDate: '2026-08-08', mainMuscle: 'Piernas', name: 'Sentadilla', routineNames: ['Rutina B'], sessions: 2 },
        ]}
      />,
    )

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar ejercicio' }), { target: { value: 'sentadilla' } })
    expect(screen.queryByRole('button', { name: /Press banca/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Sentadilla/i }))

    expect(onOpen).toHaveBeenCalledWith('sentadilla')
  })
})
