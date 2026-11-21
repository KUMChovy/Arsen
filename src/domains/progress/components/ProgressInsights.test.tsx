// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressInsights } from './ProgressInsights'

describe('ProgressInsights', () => {
  it('shows the period label and a compact date range instead of every evidence date', () => {
    render(<ProgressInsights insights={[{
      evidenceDates: ['2026-08-01', '2026-08-08', '2026-08-15'],
      kind: 'improvement',
      message: 'Mejora observada.',
      periodLabel: 'Últimas 8 semanas',
      title: 'Mejora detectada',
      trend: 'up',
      values: { current: 100, reference: 90 },
    }]} />)

    const period = screen.getByText(/Últimas 8 semanas ·/)
    expect(period).toHaveTextContent(/–/)
    expect(period).not.toHaveTextContent('2026-08-01')
    expect(period).not.toHaveTextContent('2026-08-08')
  })
})
