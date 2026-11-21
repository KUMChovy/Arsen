import { Activity, BarChart3, Layers3, Timer } from 'lucide-react'
import { Card } from '../../../shared/components/Card'
import { kgToUnit, formatWeight } from '../../../shared/utils/weight'
import type { ProgressInsight } from '../analysis'
import type { ProgressSummary as ProgressSummaryData } from '../repository'
import { ProgressChart, type ProgressChartPoint } from './ProgressChart'
import { ProgressInsights } from './ProgressInsights'

export function ProgressSummary({ insights, summary, unit }: { insights: ProgressInsight[]; summary: ProgressSummaryData; unit: 'kg' | 'lb' }) {
  const chartData: ProgressChartPoint[] = summary.weeklyVolume.map((point) => ({
    date: point.start,
    sessionId: point.start,
    value: kgToUnit(point.volumeKg, unit),
  }))
  const stats = [
    { icon: Activity, label: 'Sesiones', value: String(summary.sessionCount), comparison: compare(summary.sessionCount, summary.previousSessionCount) },
    { icon: Layers3, label: 'Series', value: String(summary.totalSets), comparison: compare(summary.totalSets, summary.previousTotalSets) },
    { icon: BarChart3, label: `Volumen (${unit})`, value: formatWeight(summary.volumeKg, unit), comparison: compare(summary.volumeKg, summary.previousVolumeKg) },
    { icon: Timer, label: 'Promedio/sesión', value: formatWeight(summary.averageVolumeKg, unit), comparison: null },
  ]

  return (
    <div className="space-y-4">
      <section aria-label="Indicadores principales" className="grid grid-cols-2 gap-2">
        {stats.map(({ comparison, icon: Icon, label, value }) => (
          <Card className="p-3" key={label}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-arsen-muted">{label}</span>
              <Icon aria-hidden="true" className="size-4 text-arsen-purple2" />
            </div>
            <strong className="mt-2 block text-xl text-arsen-ink">{value}</strong>
            {comparison ? <span className={['mt-1 block text-xs font-bold', comparison.tone].join(' ')}>{comparison.label}</span> : null}
          </Card>
        ))}
      </section>

      <Card className="space-y-3 p-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-black">Volumen semanal</h2>
            <p className="mt-1 text-xs text-arsen-muted">Series principales y drop sets · {unit}</p>
          </div>
          <span className="text-xs font-bold text-arsen-muted">{chartData.length} semanas</span>
        </div>
        <div className="h-48 rounded-[10px] border border-white/10 bg-arsen-bg/50 p-2">
          <ProgressChart data={chartData} metricLabel="Volumen semanal" unit={unit} />
        </div>
      </Card>

      {insights.length > 0 ? <ProgressInsights insights={insights} /> : null}

      <Card className="grid grid-cols-2 gap-2 p-3 text-xs text-arsen-muted">
        <div><span className="block">Periodo actual</span><strong className="mt-1 block text-arsen-ink">{formatRange(summary.currentPeriod.start, summary.currentPeriod.end)}</strong></div>
        <div><span className="block">Periodo anterior</span><strong className="mt-1 block text-arsen-ink">{summary.previousPeriod ? formatRange(summary.previousPeriod.start, summary.previousPeriod.end) : 'Sin comparación'}</strong></div>
      </Card>
    </div>
  )
}

function compare(current: number, previous: number) {
  if (previous <= 0) return null
  const percent = ((current - previous) / previous) * 100
  if (Math.abs(percent) < 1) return { label: 'Estable frente al periodo anterior', tone: 'text-arsen-muted' }
  return { label: `${percent > 0 ? '↑' : '↓'} ${Math.abs(percent).toFixed(0)}% frente al periodo anterior`, tone: percent > 0 ? 'text-arsen-acid' : 'text-orange-300' }
}

function formatRange(start: string, end: string) {
  if (!start || !end) return 'Sin registros'
  return `${formatDate(start)} – ${formatDate(end)}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`))
}
