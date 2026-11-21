import { describe, expect, it } from 'vitest'
import { analyzeProgress, type ProgressAnalysisInput } from './analysis'

describe('progress analysis', () => {
  it('detects a meaningful improvement and includes evidence dates', () => {
    const insights = analyzeProgress(input([['2026-08-01', 100], ['2026-08-08', 110]]))

    expect(insights).toEqual([
      expect.objectContaining({
        evidenceDates: ['2026-08-01', '2026-08-08'],
        kind: 'improvement',
      }),
    ])
  })

  it('reports stable performance inside the tolerance', () => {
    const insights = analyzeProgress(input([['2026-08-01', 100], ['2026-08-08', 103], ['2026-08-15', 98]]))

    expect(insights[0]).toMatchObject({ kind: 'stable' })
  })

  it('reports a measurable decline without attributing a cause', () => {
    const insights = analyzeProgress(input([['2026-08-01', 100], ['2026-08-08', 90]]))

    expect(insights[0]).toMatchObject({ kind: 'decline' })
    expect(insights[0]?.message).not.toMatch(/fatiga|lesi[oó]n|sobreentrenamiento/i)
  })

  it('reports insufficient comparable data instead of inventing a trend', () => {
    const insights = analyzeProgress(input([['2026-08-08', 100]]))

    expect(insights).toEqual([expect.objectContaining({ kind: 'insufficient' })])
  })

  it('compares the current average against the previous period when available', () => {
    const insights = analyzeProgress({
      ...input([['2026-08-01', 90], ['2026-08-08', 92]]),
      previous: {
        label: 'Periodo anterior',
        sessions: [
          { date: '2026-07-01', estimatedOneRmKg: 105, volumeKg: 1000 },
          { date: '2026-07-08', estimatedOneRmKg: 104, volumeKg: 1000 },
        ],
      },
    })

    expect(insights).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'decline', periodLabel: 'Últimas 4 semanas' })]))
  })
})

function input(values: Array<[string, number | null]>): ProgressAnalysisInput {
  return {
    current: {
      label: 'Últimas 4 semanas',
      sessions: values.map(([date, estimatedOneRmKg]) => ({ date, estimatedOneRmKg, volumeKg: 1000 })),
    },
    subject: 'Press inclinado',
  }
}
