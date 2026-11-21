import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Download, X } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { PageHeader } from '../../../shared/components/PageHeader'
import { getAppSettings, exportProgressCsv, exportProgressJson } from '../../settings/services'
import { TrainingCalendarSheet } from '../components/TrainingCalendarSheet'
import { ExerciseExplorer } from '../components/ExerciseExplorer'
import { HistoryView } from '../components/HistoryView'
import { ProgressSummary } from '../components/ProgressSummary'
import { ProgressTabs, type ProgressView } from '../components/ProgressTabs'
import { analyzeProgress } from '../analysis'
import { useHealthProgressOverview } from '../../health/hooks'
import { useProgressDayOptions, useProgressExerciseOptions, useProgressHistory, useProgressSummary, useTrainingDates } from '../hooks'
import type { ProgressEditOptions, ProgressHistoryFilters } from '../repository'

export type EditSetState = {
  dayId: string
  date: string
  reps: number
  rir: number
  routineExerciseId: string
  routineId: string
  sessionId: string
  setLogId: string
  weightKg: number
}

type ProgressPeriod = '4w' | '8w' | '12w' | 'all'

export function ProgressPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [message, setMessage] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(searchParams.get('vista') === 'history')
  const [period, setPeriod] = useState<ProgressPeriod>((searchParams.get('period') as ProgressPeriod) || '4w')
  const view = parseView(searchParams.get('vista'))
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null)
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const settings = useLiveQuery(() => getAppSettings(), [], undefined)
  const unit = settings?.preferredUnit ?? 'kg'
  const dayOptions = useProgressDayOptions() ?? []
  const exerciseOptions = useProgressExerciseOptions({ dayId: selectedDayId, routineId: selectedRoutineId }) ?? []
  const filters = useMemo<ProgressHistoryFilters>(() => ({
    canonicalName: selectedExercise,
    dayId: selectedDayId,
    period,
    routineId: selectedRoutineId,
  }), [period, selectedDayId, selectedExercise, selectedRoutineId])
  const summary = useProgressSummary(filters)
  const history = useProgressHistory(filters) ?? []
  const trainingDates = useTrainingDates(filters) ?? []
  const healthEnabled = settings?.healthIntegrationEnabled === true
  const healthOverview = useHealthProgressOverview(selectedDayId, healthEnabled)
  const insights = summary ? analyzeProgress({
    current: {
      label: periodLabel(period),
      sessions: summary.sessions.map((session) => ({ date: session.date, estimatedOneRmKg: session.estimatedOneRmKg, volumeKg: session.volumeKg })),
    },
    previous: summary.previousSessions.length > 0 ? {
      label: summary.previousPeriod ? formatRange(summary.previousPeriod.start, summary.previousPeriod.end) : 'Periodo anterior',
      sessions: summary.previousSessions.map((session) => ({ date: session.date, estimatedOneRmKg: session.estimatedOneRmKg, volumeKg: session.volumeKg })),
    } : null,
    subject: selectedExercise ? exerciseOptions.find((option) => option.canonicalName === selectedExercise)?.name ?? 'este ejercicio' : 'tu entrenamiento',
  }) : []

  useEffect(() => {
    setHistoryOpen(view === 'history')
  }, [view])

  function changeView(nextView: ProgressView) {
    const next = new URLSearchParams(searchParams)
    next.set('vista', nextView)
    setSearchParams(next)
  }

  function updatePeriod(nextPeriod: ProgressPeriod) {
    setPeriod(nextPeriod)
    const next = new URLSearchParams(searchParams)
    next.set('period', nextPeriod)
    setSearchParams(next)
  }

  async function exportProgress(format: 'csv' | 'json') {
    try {
      if (format === 'csv') await exportProgressCsv(filters)
      else await exportProgressJson(filters)
      setMessage(`Exportado en ${format.toUpperCase()}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo exportar')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Seguimiento local" title="Progreso">
        <span className="rounded-full border border-white/10 bg-arsen-surface px-3 py-2 text-xs font-extrabold text-arsen-muted">Offline</span>
      </PageHeader>

      <ProgressTabs onChange={changeView} value={view} />

      <Card className="space-y-3 p-3">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Periodo</span>
            <select aria-label="Periodo de progreso" className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3 text-sm font-extrabold text-arsen-ink" onChange={(event) => updatePeriod(event.target.value as ProgressPeriod)} value={period}>
              <option value="4w">Últimas 4 semanas</option>
              <option value="8w">Últimas 8 semanas</option>
              <option value="12w">Últimas 12 semanas</option>
              <option value="all">Todo el historial</option>
            </select>
          </label>
          <div className="flex items-end gap-1">
            <button aria-label="Exportar CSV" className="grid size-11 place-items-center rounded-[10px] border border-white/10 bg-arsen-surface text-arsen-purple2" onClick={() => void exportProgress('csv')} type="button"><Download aria-hidden="true" className="size-4" /><span className="sr-only">CSV</span></button>
            <button aria-label="Exportar JSON" className="grid size-11 place-items-center rounded-[10px] border border-white/10 bg-arsen-surface text-arsen-purple2" onClick={() => void exportProgress('json')} type="button"><Download aria-hidden="true" className="size-4" /><span className="sr-only">JSON</span></button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Rutina (opcional)</span>
            <select aria-label="Filtrar por rutina" className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3 text-sm font-extrabold text-arsen-ink" onChange={(event) => { setSelectedRoutineId(event.target.value || null); setSelectedDayId(null); setSelectedExercise(null) }} value={selectedRoutineId ?? ''}>
              <option value="">Todas</option>
              {[...new Map(dayOptions.map((option) => [option.routineId, option.routineName])).entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Día (opcional)</span>
            <select aria-label="Filtrar por día" className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3 text-sm font-extrabold text-arsen-ink" onChange={(event) => setSelectedDayId(event.target.value || null)} value={selectedDayId ?? ''}>
              <option value="">Todos</option>
              {dayOptions.map((option) => <option key={option.dayId} value={option.dayId}>{option.name} · {option.routineName}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Ejercicio (opcional)</span>
            <select aria-label="Filtrar por ejercicio" className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3 text-sm font-extrabold text-arsen-ink" onChange={(event) => setSelectedExercise(event.target.value || null)} value={selectedExercise ?? ''}>
              <option value="">Todos</option>
              {exerciseOptions.map((option) => <option key={option.canonicalName} value={option.canonicalName}>{option.name}</option>)}
            </select>
          </label>
        </div>
      </Card>

      {message ? <div className="rounded-[10px] border border-arsen-purple/40 bg-arsen-purple/15 px-3 py-2 text-xs text-arsen-purple2">{message}</div> : null}

      {view === 'summary' ? (
        summary ? <ProgressSummary insights={insights} summary={summary} unit={unit} /> : <LoadingCard />
      ) : null}

      {view === 'exercises' ? <ExerciseExplorer options={exerciseOptions} onOpen={(canonicalName) => navigate(`/progreso/ejercicio/${encodeURIComponent(canonicalName)}`)} /> : null}

      {view === 'history' ? (
        <>
          <HistoryView
            filtersActive={Boolean(selectedDayId || selectedRoutineId || selectedExercise || period !== '4w')}
            onClearFilters={() => { setSelectedDayId(null); setSelectedRoutineId(null); setSelectedExercise(null); updatePeriod('4w') }}
            onOpenSession={(sessionId) => { const session = history.find((item) => item.id === sessionId); if (session) navigate(`/progreso/historial/${session.date}`) }}
            sessions={history}
            unit={unit}
          />
          <button className="min-h-11 w-full rounded-[10px] border border-white/10 px-3 text-xs font-bold text-arsen-purple2" onClick={() => setHistoryOpen(true)} type="button">Abrir calendario</button>
          {historyOpen ? <TrainingCalendarSheet dates={trainingDates} onClose={() => setHistoryOpen(false)} onSelect={(date, hasTraining) => { const params = new URLSearchParams(); if (selectedDayId) params.set('dayId', selectedDayId); if (selectedExercise) params.set('exercise', selectedExercise); if (!hasTraining) params.set('create', '1'); setHistoryOpen(false); navigate(`/progreso/historial/${date}${params.size ? `?${params.toString()}` : ''}`) }} /> : null}
        </>
      ) : null}

      {healthEnabled && healthOverview?.points.length && view === 'summary' ? <div className="text-xs text-arsen-muted">Health Connect: {healthOverview.points.length} días con resumen guardado.</div> : null}
    </div>
  )
}

function LoadingCard() { return <Card className="p-4 text-sm text-arsen-muted">Cargando progreso local...</Card> }
function parseView(value: string | null): ProgressView { return value === 'exercises' || value === 'history' ? value : 'summary' }
function periodLabel(period: ProgressPeriod) { return period === 'all' ? 'Todo el historial' : `Últimas ${period.replace('w', '')} semanas` }

function formatRange(start: string, end: string) { return `${formatDate(start)} – ${formatDate(end)}` }
function formatDate(value: string) { return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${value}T12:00:00`)) }

export function EditSetSheet({ disabled, editOptions, initial, onClose, onSave }: { disabled: boolean; editOptions: ProgressEditOptions; initial: EditSetState; onClose: () => void; onSave: (input: EditSetState) => void }) {
  const [form, setForm] = useState(() => ({ date: initial.date, dayId: initial.dayId, reps: String(initial.reps), rir: String(initial.rir), routineExerciseId: initial.routineExerciseId, routineId: initial.routineId, weightKg: String(initial.weightKg) }))
  const daysForRoutine = useMemo(() => editOptions.days.filter((day) => day.routineId === form.routineId), [editOptions.days, form.routineId])
  const exercisesForDay = useMemo(() => editOptions.exercises.filter((exercise) => exercise.dayId === form.dayId), [editOptions.exercises, form.dayId])
  useEffect(() => { const nextDay = daysForRoutine.find((day) => day.id === form.dayId) ?? daysForRoutine[0]; if (nextDay && nextDay.id !== form.dayId) setForm((current) => ({ ...current, dayId: nextDay.id })) }, [daysForRoutine, form.dayId])
  useEffect(() => { const nextExercise = exercisesForDay.find((exercise) => exercise.id === form.routineExerciseId) ?? exercisesForDay[0]; if (nextExercise && nextExercise.id !== form.routineExerciseId) setForm((current) => ({ ...current, routineExerciseId: nextExercise.id })) }, [exercisesForDay, form.routineExerciseId])
  return <div className="fixed inset-0 z-[60] mx-auto flex max-w-[430px] items-end bg-black/65"><button aria-label="Cerrar editor" className="absolute inset-0 cursor-default" onClick={onClose} type="button" /><section className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]"><div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" /><div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-xl font-black">Editar serie</h2><button aria-label="Cerrar" className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button"><X aria-hidden="true" className="size-5" /></button></div><div className="space-y-3"><label className="block"><span className="mb-1 block text-xs font-bold text-arsen-muted">Fecha</span><input className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink" onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} type="date" value={form.date} /></label><label className="block"><span className="mb-1 block text-xs font-bold text-arsen-muted">Rutina</span><select className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink" onChange={(event) => setForm((current) => ({ ...current, routineId: event.target.value }))} value={form.routineId}>{editOptions.routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}</select></label><label className="block"><span className="mb-1 block text-xs font-bold text-arsen-muted">Día</span><select className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink" onChange={(event) => setForm((current) => ({ ...current, dayId: event.target.value }))} value={form.dayId}>{daysForRoutine.map((day) => <option key={day.id} value={day.id}>{day.name} - {day.routineName}</option>)}</select></label><label className="block"><span className="mb-1 block text-xs font-bold text-arsen-muted">Ejercicio</span><select className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink" onChange={(event) => setForm((current) => ({ ...current, routineExerciseId: event.target.value }))} value={form.routineExerciseId}>{exercisesForDay.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}</select></label><div className="grid grid-cols-3 gap-2"><NumberField label="Peso kg" onChange={(value) => setForm((current) => ({ ...current, weightKg: value }))} value={form.weightKg} /><NumberField label="Reps" onChange={(value) => setForm((current) => ({ ...current, reps: value }))} value={form.reps} /><NumberField label="RIR" onChange={(value) => setForm((current) => ({ ...current, rir: value }))} value={form.rir} /></div></div><ActionButton className="mt-4 w-full" disabled={disabled || !form.dayId || !form.routineExerciseId} onClick={() => onSave({ date: form.date, dayId: form.dayId, reps: numberOrDefault(form.reps, initial.reps), rir: numberOrDefault(form.rir, initial.rir), routineExerciseId: form.routineExerciseId, routineId: form.routineId, sessionId: initial.sessionId, setLogId: initial.setLogId, weightKg: numberOrDefault(form.weightKg, initial.weightKg) })} tone="acid"><Check aria-hidden="true" className="size-5" />Guardar cambios</ActionButton></section></div>
}

function NumberField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) { return <label className="block"><span className="mb-1 block text-xs font-bold text-arsen-muted">{label}</span><input className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-2 text-center text-sm font-extrabold text-arsen-ink" inputMode="decimal" onChange={(event) => onChange(event.target.value)} type="number" value={value} /></label> }
export function formatSessionDate(date: string) { return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`)) }
function numberOrDefault(value: string, fallback: number) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback }
