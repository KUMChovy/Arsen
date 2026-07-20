import { ChartLine, ChevronDown, Download, NotebookTabs, SlidersHorizontal, Trophy } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'

const progressData = [
  { date: '20 abr.', score: 45 },
  { date: '27 abr.', score: 50 },
  { date: '4 may.', score: 58 },
  { date: '11 may.', score: 64 },
  { date: '18 may.', score: 74 },
  { date: '25 may.', score: 72 },
  { date: '1 jun.', score: 82 },
]

const metrics = [
  { label: 'Volumen', value: '4.4t' },
  { label: 'Peso máx.', value: '80' },
  { label: 'Reps prom.', value: '7.2' },
  { label: 'Semanas', value: '6' },
]

export function ProgressPage() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Timeline global cronológico" title="Rendimiento">
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
              index === 1
                ? 'border-arsen-purple2 text-arsen-ink'
                : 'border-transparent text-arsen-muted',
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
          <ExerciseArt alt="Press inclinado" kind="press" />
          <div>
            <strong>Press inclinado</strong>
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
              <strong className="text-[44px] leading-none text-arsen-acid">82</strong>
              <span className="pb-1 text-arsen-muted">/100</span>
            </div>
          </div>
          <span className="text-sm font-extrabold text-arsen-acid">+12 pts</span>
        </div>

        <div className="h-48 rounded-[10px] border border-white/10 bg-arsen-bg/50 p-2">
          <ResponsiveContainer height="100%" width="100%">
            <LineChart data={progressData} margin={{ bottom: 4, left: -28, right: 8, top: 8 }}>
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
        </div>
      </Card>

      <Card className="p-4">
        <div className="text-xs font-extrabold text-arsen-acid">Última sesión</div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-arsen-muted">Mejor serie</span>
            <strong className="mt-1 block text-2xl text-arsen-acid">72.5 kg x 8</strong>
            <span className="text-sm">RIR 1</span>
          </div>
          <div>
            <span className="text-sm text-arsen-muted">Puntaje</span>
            <strong className="mt-1 block text-2xl text-arsen-acid">86</strong>
            <span className="text-sm">/100</span>
          </div>
        </div>
      </Card>

      <section>
        <div className="mb-2 text-xs font-extrabold text-arsen-muted">Métricas clave</div>
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
