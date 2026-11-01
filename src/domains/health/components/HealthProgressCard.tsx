import { Activity, ChevronDown, Flame, Footprints, HeartPulse } from 'lucide-react'
import { useState } from 'react'
import { Card } from '../../../shared/components/Card'
import type { HealthProgressOverview } from '../repository'

export function HealthProgressCard({ overview }: { overview: HealthProgressOverview }) {
  const [collapsed, setCollapsed] = useState(false)
  const recentPoints = [...overview.points].reverse().slice(0, 6)
  const recentExercisePoints = [...overview.exercisePoints].reverse().slice(0, 6)
  // Progreso muestra solo los puntos ya persistidos, ordenados del más reciente al más antiguo.

  return (
    <Card className="space-y-3 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-black">Tendencia de salud</h2>
          <p className="mt-1 text-xs text-arsen-muted">Resumen diario publicado en Health Connect</p>
        </div>
        <button
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expandir' : 'Contraer'} tendencia de salud`}
          className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-white/10 text-arsen-purple2"
          onClick={() => setCollapsed((current) => !current)}
          type="button"
        >
          {collapsed ? <Activity aria-hidden="true" className="size-5" /> : <ChevronDown aria-hidden="true" className="size-5" />}
        </button>
      </div>

      {!collapsed && overview.maxDayCalories ? (
        <div className="rounded-[10px] border border-arsen-acid/30 bg-arsen-acid/10 p-2 text-xs">
          <span className="text-arsen-muted">Mayor gasto diario</span>
          <strong className="ml-2 text-arsen-acid">
            {formatNumber(overview.maxDayCalories.dayCaloriesKcal)} kcal · {formatDate(overview.maxDayCalories.date)}
          </strong>
        </div>
      ) : null}

      {!collapsed ? <div className="space-y-2">
        {recentPoints.map((point) => (
          <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-[10px] border border-white/10 bg-arsen-bg/45 p-2" key={point.id}>
            <span className="text-xs font-black text-arsen-muted">{formatDate(point.date)}</span>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-arsen-muted">
              <span><HeartPulse aria-hidden="true" className="mr-1 inline size-3.5 text-arsen-purple2" />{formatValue(point.dayHeartRateAvgBpm, ' lpm')}</span>
              <span><Flame aria-hidden="true" className="mr-1 inline size-3.5 text-arsen-acid" />{formatValue(point.dayCaloriesKcal, ' kcal')}</span>
            </div>
            <span className="text-right text-xs text-arsen-dim">
              <Footprints aria-hidden="true" className="mr-1 inline size-3.5" />{formatInteger(point.daySteps)}
            </span>
          </div>
        ))}
      </div> : null}

      {!collapsed && recentExercisePoints.length > 0 ? (
        <section className="space-y-2 border-t border-white/10 pt-3">
          <div className="text-xs font-extrabold text-arsen-purple2">Estadísticas por ejercicio</div>
          {recentExercisePoints.map((point) => (
            <div className="grid grid-cols-[1fr_auto] gap-2 rounded-[10px] border border-white/10 bg-arsen-bg/45 p-2" key={point.id}>
              <div className="min-w-0">
                <strong className="block truncate text-sm">{point.exerciseName}</strong>
                <span className="text-xs text-arsen-muted">
                  {formatDate(point.date)} · {point.setCount} series · {point.durationMinutes} min
                </span>
              </div>
              <div className="text-right text-xs text-arsen-muted">
                <span className="block">{formatValue(point.metrics.heartRateAvgBpm, ' lpm')}</span>
                <span className="block">{formatValue(point.metrics.activeCaloriesKcal, ' kcal')}</span>
              </div>
            </div>
          ))}
        </section>
      ) : null}
    </Card>
  )
}

function formatValue(value: number | null, suffix: string) {
  return value === null ? '—' : `${formatNumber(value)}${suffix}`
}

function formatInteger(value: number | null) {
  return value === null ? '— pasos' : `${Math.round(value).toLocaleString('es-MX')} pasos`
}

function formatNumber(value: number | null) {
  return value === null ? '—' : value.toLocaleString('es-MX', { maximumFractionDigits: 1 })
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })
}
