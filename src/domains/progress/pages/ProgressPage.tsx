import { useState, useTransition } from 'react'
import { ChartLine, ChevronDown, Download, NotebookTabs, Pencil, SlidersHorizontal, Trash2, Trophy } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'
import { deleteWorkoutSession, updateMainSet } from '../../workout/services'
import { useProgressExerciseOptions, useProgressOverview } from '../hooks'
import type { RecentSessionSummary } from '../repository'

export function ProgressPage() {
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const overview = useProgressOverview(selectedExercise)
  const exerciseOptions = useProgressExerciseOptions() ?? []
  const chartData = overview?.chartData ?? []
  const recentSessions = overview?.recentSessions ?? []
  const latestScore = chartData.at(-1)?.score ?? 0
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const metrics = [
    { label: 'Volumen', value: `${Math.round((overview?.volumeKg ?? 0) / 100) / 10}t` },
    { label: 'Peso max.', value: String(overview?.maxWeightKg ?? 0) },
    { label: 'Sesiones', value: String(overview?.sessionCount ?? 0) },
    { label: 'Series', value: String(overview?.totalSets ?? 0) },
  ]

  function runHistoryAction(action: () => Promise<void>, success: string) {
    startTransition(() => {
      action()
        .then(() => setMessage(success))
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Accion no completada'))
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={selectedExercise ? 'Timeline por ejercicio' : 'Timeline global cronologico'} title="Rendimiento">
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

      {message ? (
        <div className="rounded-[10px] border border-arsen-purple/40 bg-arsen-purple/15 px-3 py-2 text-xs text-arsen-purple2">
          {message}
        </div>
      ) : null}

      <Card className="grid grid-cols-[52px_1fr] items-center gap-3 p-3">
        <ExerciseArt alt={overview?.exerciseName ?? 'Ejercicio'} kind="press" />
        <div className="min-w-0">
          <strong className="block truncate">{selectedExercise ? overview?.exerciseName ?? 'Cargando' : 'Global'}</strong>
          <label className="mt-2 block">
            <span className="sr-only">Filtrar ejercicio</span>
            <select
              className="min-h-10 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3 text-sm font-extrabold text-arsen-ink"
              onChange={(event) => setSelectedExercise(event.target.value || null)}
              value={selectedExercise ?? ''}
            >
              <option value="">Todos los ejercicios</option>
              {exerciseOptions.map((option) => (
                <option key={option.canonicalName} value={option.canonicalName}>
                  {option.name} ({option.sessions})
                </option>
              ))}
            </select>
          </label>
        </div>
      </Card>

      <Card className="flex items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-3">
          <ExerciseArt alt={overview?.exerciseName ?? 'Ejercicio'} kind="press" />
          <div>
            <strong>{overview?.exerciseName ?? 'Cargando'}</strong>
            <p className="text-sm text-arsen-muted">{selectedExercise ? 'Progreso por ejercicio' : 'Progreso unificado'}</p>
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

      <section>
        <div className="mb-2 text-xs font-extrabold text-arsen-muted">Sesiones recientes</div>
        <div className="space-y-2">
          {recentSessions.length > 0 ? (
            recentSessions.map((session) => (
              <SessionRow
                disabled={isPending}
                key={session.id}
                onDelete={() => {
                  if (!window.confirm('Eliminar esta sesion y sus series?')) return
                  runHistoryAction(() => deleteWorkoutSession(session.id), 'Sesion eliminada')
                }}
                onEdit={() => {
                  if (!session.bestSetId) return
                  const value = window.prompt('Editar mejor serie: peso kg, reps, RIR', session.bestSetLabel.replace(' kg x ', ',') + ',1')
                  if (!value) return
                  const values = value.split(',').map((item) => Number(item.trim()))
                  const weightKg = values[0]
                  const reps = values[1]
                  const rir = values[2]
                  if (
                    weightKg === undefined ||
                    reps === undefined ||
                    rir === undefined ||
                    ![weightKg, reps, rir].every(Number.isFinite)
                  ) {
                    setMessage('Formato invalido. Usa: 80,8,1')
                    return
                  }
                  runHistoryAction(() => updateMainSet(session.bestSetId!, { reps, rir, weightKg }), 'Serie editada')
                }}
                session={session}
              />
            ))
          ) : (
            <Card className="p-4 text-sm text-arsen-muted">Sin sesiones todavia.</Card>
          )}
        </div>
      </section>
    </div>
  )
}

function SessionRow({
  disabled,
  onDelete,
  onEdit,
  session,
}: {
  disabled: boolean
  onDelete: () => void
  onEdit: () => void
  session: RecentSessionSummary
}) {
  return (
    <Card className="grid grid-cols-[1fr_auto] items-center gap-3 p-3">
      <div>
        <div className="flex items-center gap-2">
          <strong>{formatSessionDate(session.date)}</strong>
          <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-arsen-muted">
            {session.setCount} series
          </span>
        </div>
        <p className="mt-1 text-xs text-arsen-muted">
          Mejor {session.bestSetLabel} · {Math.round(session.volumeKg)} kg volumen · {session.exerciseCount} ejercicios
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          className="grid size-9 place-items-center rounded-[10px] border border-white/10 text-arsen-purple2 disabled:opacity-40"
          disabled={disabled || !session.bestSetId}
          onClick={onEdit}
          type="button"
        >
          <Pencil aria-hidden="true" className="size-4" />
          <span className="sr-only">Editar sesion</span>
        </button>
        <button
          className="grid size-9 place-items-center rounded-[10px] border border-red-300/25 text-red-300 disabled:opacity-40"
          disabled={disabled}
          onClick={onDelete}
          type="button"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          <span className="sr-only">Eliminar sesion</span>
        </button>
      </div>
    </Card>
  )
}

function formatSessionDate(date: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${date}T12:00:00`),
  )
}
