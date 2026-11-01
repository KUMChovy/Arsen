// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { HealthProgressOverview } from '../repository'
import { HealthProgressCard } from './HealthProgressCard'

describe('HealthProgressCard', () => {
  afterEach(cleanup)

  it('shows daily trend and exercise windows', () => {
    render(<HealthProgressCard overview={overview()} />)

    expect(screen.getByText('Tendencia de salud')).toBeInTheDocument()
    expect(screen.getByText(/Estad.*sticas por ejercicio/i)).toBeInTheDocument()
    expect(screen.getByText('Press inclinado')).toBeInTheDocument()
    expect(screen.getByText(/15 min/)).toBeInTheDocument()
    expect(screen.getByText(/3 series/)).toBeInTheDocument()
  })

  it('can collapse the health progress panel', () => {
    render(<HealthProgressCard overview={overview()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Contraer tendencia de salud' }))

    expect(screen.getByRole('button', { name: 'Expandir tendencia de salud' })).toBeInTheDocument()
    expect(screen.queryByText('Press inclinado')).not.toBeInTheDocument()
  })
})

function overview(): HealthProgressOverview {
  return {
    exercisePoints: [
      {
        canonicalName: 'press-inclinado',
        date: '2026-07-20',
        durationMinutes: 15,
        exerciseName: 'Press inclinado',
        id: 'session-1:exercise-log-1',
        metrics: {
          activeCaloriesKcal: 40,
          heartRateAvgBpm: 130,
          heartRateMaxBpm: 168,
          heartRateMinBpm: 92,
          oxygenSaturationAvgPercent: 96,
          steps: 200,
        },
        rangeEnd: '2026-07-20T18:40:00.000Z',
        rangeStart: '2026-07-20T18:25:00.000Z',
        setCount: 3,
      },
    ],
    maxDayCalories: null,
    points: [],
  }
}
