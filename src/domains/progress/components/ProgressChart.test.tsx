// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressChart } from './ProgressChart'

describe('ProgressChart', () => {
  it('exposes dated metric values as an accessible summary without Score semantics', () => {
    render(
      <ProgressChart
        data={[
          { date: '2026-08-10', sessionId: 'session-1', value: 80 },
          { date: '2026-08-17', sessionId: 'session-2', value: 85 },
        ]}
        metricLabel="1RM estimada"
        unit="kg"
      />,
    )

    expect(screen.getByRole('img', { name: /1RM estimada/i })).toBeInTheDocument()
    expect(screen.getByText(/2026-08-10.*80 kg/)).toBeInTheDocument()
    expect(screen.queryByText(/score|\/100/i)).not.toBeInTheDocument()
  })

  it('renders a clear empty state when no metric values are available', () => {
    render(<ProgressChart data={[]} metricLabel="Volumen" unit="kg" />)

    expect(screen.getByText('Sin datos suficientes para graficar esta métrica.')).toBeInTheDocument()
  })
})
