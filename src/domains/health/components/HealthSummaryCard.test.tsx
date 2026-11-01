// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HealthSummary } from '../types'
import { HealthSummaryCard } from './HealthSummaryCard'

describe('HealthSummaryCard', () => {
  afterEach(cleanup)

  it('shows only the full-day window', () => {
    render(<HealthSummaryCard onSync={vi.fn()} summary={summary()} />)

    expect(screen.getByRole('heading', { name: /Resumen del/ })).toBeInTheDocument()
    expect(screen.queryByText(/Sesi/)).not.toBeInTheDocument()
    expect(screen.getAllByText('Pulso promedio')).toHaveLength(1)
    expect(screen.getByText('800 kcal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sincronizar salud' })).toBeInTheDocument()
  })

  it('labels unavailable values without replacing them with zero', () => {
    render(<HealthSummaryCard onSync={vi.fn()} summary={null} />)

    expect(screen.getByText(/A.*no hay una sincronizaci/)).toBeInTheDocument()
    expect(screen.getByText('Sin datos')).toBeInTheDocument()
  })

  it('shows day, session and current exercise views with compact and expanded states', () => {
    const { container } = render(
      <HealthSummaryCard
        currentExerciseId="exercise-log-1"
        currentExerciseName="Press inclinado"
        onSync={vi.fn()}
        summary={summaryWithExercise()}
      />,
    )

    expect(screen.getByRole('heading', { name: /Resumen del/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Siguiente vista de salud' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Ver Sesión de entrenamiento' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Información sobre disponibilidad' }))
    expect(screen.getByRole('menu', { name: 'Disponibilidad de datos' })).toHaveTextContent(/Mi Fitness, Samsung Health/i)
    expect(screen.queryByText(/Ox.*geno/)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente vista de salud' }))
    expect(screen.getByRole('heading', { name: /Sesi.*entrenamiento/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente vista de salud' }))
    expect(screen.getByRole('heading', { name: 'Press inclinado' })).toBeInTheDocument()
    expect(screen.getByText(/15 min/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver todos los datos' }))
    expect(screen.getByText(/Ox.*geno/)).toBeInTheDocument()

    const swipeSurface = container.querySelector('.touch-pan-y')
    expect(swipeSurface).not.toBeNull()
    fireEvent.touchStart(swipeSurface!, { touches: [{ clientX: 240 }] })
    fireEvent.touchEnd(swipeSurface!, { changedTouches: [{ clientX: 80 }] })
    expect(screen.getByRole('heading', { name: /Resumen del/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Ver Sesión de entrenamiento' }))
    expect(screen.getByRole('heading', { name: /Sesi.*entrenamiento/ })).toBeInTheDocument()
  })

  it('keeps the availability note inside a contextual menu and can collapse the module', () => {
    render(<HealthSummaryCard onSync={vi.fn()} summary={summary()} />)

    expect(screen.queryByText(/La disponibilidad y frecuencia/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Información sobre disponibilidad' }))
    expect(screen.getByRole('menu', { name: 'Disponibilidad de datos' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Contraer salud sincronizada' }))
    expect(screen.getByRole('button', { name: 'Expandir salud sincronizada' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Siguiente vista de salud' })).not.toBeInTheDocument()
  })
})

function summary(): HealthSummary {
  return {
    day: {
      metrics: {
        activeCaloriesKcal: 800,
        heartRateAvgBpm: 130,
        heartRateMaxBpm: 168,
        heartRateMinBpm: 92,
        oxygenSaturationAvgPercent: 97,
        steps: 7000,
      },
      rangeEnd: '2026-07-20T20:04:00.000Z',
      rangeStart: '2026-07-20T00:00:00.000Z',
    },
    syncedAt: '2026-07-20T20:04:00.000Z',
  }
}

function summaryWithExercise(): HealthSummary {
  return {
    ...summary(),
    exercises: [
      {
        ...summary().day,
        canonicalName: 'press-inclinado',
        exerciseLogId: 'exercise-log-1',
        exerciseName: 'Press inclinado',
        rangeEnd: '2026-07-20T18:40:00.000Z',
        rangeStart: '2026-07-20T18:25:00.000Z',
        routineExerciseId: 'exercise-1',
        setCount: 3,
      },
    ],
    session: {
      ...summary().day,
      rangeEnd: '2026-07-20T18:30:00.000Z',
      rangeStart: '2026-07-20T16:42:00.000Z',
    },
  }
}
