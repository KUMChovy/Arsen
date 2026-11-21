import { CircleHelp, Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { Card } from '../../../shared/components/Card'
import type { ProgressInsight } from '../analysis'

export function ProgressInsights({ insights }: { insights: ProgressInsight[] }) {
  return (
    <section aria-labelledby="progress-insights-title" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black" id="progress-insights-title">Lectura del periodo</h2>
        <span className="text-xs text-arsen-muted">Basada en tus registros</span>
      </div>
      {insights.map((insight, index) => {
        const Icon = insight.kind === 'improvement' ? TrendingUp : insight.kind === 'decline' ? TrendingDown : insight.kind === 'stable' ? Minus : CircleHelp
        return (
          <Card className="flex items-start gap-3 p-3" key={`${insight.kind}-${index}`}>
            <Icon aria-hidden="true" className={['mt-0.5 size-5 shrink-0', insight.kind === 'improvement' ? 'text-arsen-acid' : insight.kind === 'decline' ? 'text-orange-300' : 'text-arsen-purple2'].join(' ')} />
            <div className="min-w-0">
              <strong className="block text-sm">{insight.title}</strong>
              <p className="mt-1 text-xs leading-5 text-arsen-muted">{insight.message}</p>
              <span className="mt-2 block text-[11px] font-bold text-arsen-dim">{insight.periodLabel} · {insight.evidenceDates.join(' · ') || 'Sin fechas'}</span>
            </div>
          </Card>
        )
      })}
    </section>
  )
}
