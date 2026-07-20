import { ChartLine, ChevronDown, Download, NotebookTabs, SlidersHorizontal, Trophy } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'
import { useProgressOverview } from '../hooks'

export function ProgressPage() {
  const overview = useProgressOverview()
  const chartData = overview?.chartData ?? []
  const latestScore = chartData.at(-1)?.score ?? 0
  const metrics = [
    { label: 'Volumen', value: `${Math.round((overview?.volumeKg ?? 0) / 100) / 10}t` },
    { label: 'Peso max.', value: String(overview?.maxWeightKg ?? 0) },
    { label: 'Sesiones', value: String(overview?.sessionCount ?? 0) },
    { label: 'Series', value: String(overview?.totalSets ?? 0) },
  ]

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Timeline global cronologico" title="Rendimiento">
        <button className="grid size-10 place-items-center rounded-[10px] text-arsen-muted">
          <SlidersHorizontal aria-hidden="true" className="size-5" />
          <span className="sr-only">Filtrar progreso</span>
        </button>
      </PageHeader>

      <div className="grid grid-cols-3 border-b border-white/10">
        {['General', 'Dia 1', 'Global'].map((tab, index) => (
          <button
            className={[
              'min-h-10 border-b-2 text-sm font-semibold',
              index === 1 ? 'border-arsen-purple2 text-arsen-ink' : 'border-transparent text-arsen-muted',
            ].join(' ')}
            key={tab}
          >
            {tab}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-4 gap-2">
        {[
          { icon: ChartLine, label: 'Score', active: true },
          { icon: Trophy, label: 'Mejores' },
          { icon: NotebookTabs, label: 'Historial' },
          { icon: Download, label: 'Exportar' },
        ].map((item) => (
          <button
            className={[
              'grid min-h-[54px] place-items-center gap-1 rounded-[10px] border text-[10px] font-semibold',
              item.active
                ? 'border-arsen-purple2 bg-arsen-purple/35 text-white'
                : 'border-white/10 bg-arsen-surface text-arsen-muted',
            ].join(' ')}
            key={item.label}
          >
            <item.icon aria-hidden="true" className="size-5" />
            {item.label}
          </button>
        ))}
      </section>

      <Card className="flex items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-3">
          <ExerciseArt alt={overview?.exerciseName ?? 'Ejercicio'} kind="press" />
          <div>
            <strong>{overview?.exerciseName ?? 'Cargando'}</strong>
            <p className="text-sm text-arsen-muted">Progreso unificado</p>
          </div>
        </div>
        <ChevronDown aria-hidden="true" className="size-5 text-arsen-muted" />
      </Card>

      <Card className="p-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <span className="text-sm text-arsen-muted">Puntaje de rendimiento</span>
            <div className="mt-1 flex items-end gap-1">
              <strong className="text-[44px] leading-none text-arsen-acid">{latestScore}</strong>
              <span className="pb-1 text-arsen-muted">/100</span>
            </div>
          </div>
          <span className="text-sm font-extrabold text-arsen-acid">{chartData.length} puntos</span>
        </div>

        <div className="h-48 rounded-[10px] border border-white/10 bg-arsen-bg/50 p-2">
          {chartData.length > 0 ? (
            <ResponsiveContainer height="100%" width="100%">
              <LineChart data={chartData} margin={{ bottom: 4, left: -28, right: 8, top: 8 }}>
                <XAxis dataKey="date" fontSize={10} stroke="oklch(0.73 0.012 280)" tickLine={false} />
                <YAxis domain={[0, 100]} fontSize={10} stroke="oklch(0.73 0.012 280)" tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'oklch(0.155 0.016 280)',
                    border: '1px solid rgb(255 255 255 / 0.12)',
                    borderRadius: '10px',
                    color: 'white',
                  }}
                />
                <Line
                  activeDot={{ fill: 'oklch(0.86 0.20 125)', r: 5 }}
                  dataKey="score"
                  dot={{ fill: 'oklch(0.86 0.20 125)', r: 4 }}
                  stroke="oklch(0.72 0.13 300)"
                  strokeWidth={3}
                  type="monotone"
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-center text-sm text-arsen-muted">
              Registra una serie para crear tu primera grafica.
            </div>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-xs font-extrabold text-arsen-acid">Ultima sesion</div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-arsen-muted">Mejor serie</span>
            <strong className="mt-1 block text-2xl text-arsen-acid">{overview?.bestSetLabel ?? 'Sin series'}</strong>
            <span className="text-sm">{overview?.lastSessionDate ?? 'Sin fecha'}</span>
          </div>
          <div>
            <span className="text-sm text-arsen-muted">Puntaje</span>
            <strong className="mt-1 block text-2xl text-arsen-acid">{latestScore}</strong>
            <span className="text-sm">/100</span>
          </div>
        </div>
      </Card>

      <section>
        <div className="mb-2 text-xs font-extrabold text-arsen-muted">Metricas clave</div>
        <div className="grid grid-cols-4 gap-2">
          {metrics.map((metric) => (
            <Card className="p-2 text-center" key={metric.label}>
              <strong className="block text-base text-arsen-ink">{metric.value}</strong>
              <span className="mt-1 block text-[10px] text-arsen-muted">{metric.label}</span>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
