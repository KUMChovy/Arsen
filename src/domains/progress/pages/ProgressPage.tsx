import { lazy, Suspense, useEffect, useMemo, useState, useTransition } from 'react'
import { ChartLine, Check, ChevronDown, Download, NotebookTabs, Pencil, SlidersHorizontal, Trash2, Trophy, X } from 'lucide-react'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'
import { ActionButton } from '../../../shared/components/ActionButton'
import { confirmDanger } from '../../../shared/utils/alerts'
import { exportProgressCsv, exportProgressJson } from '../../settings/services'
import { deleteMainSet, deleteWorkoutSession, moveMainSetToExercise, updateMainSet, updateWorkoutSession } from '../../workout/services'
import { useProgressDayOptions, useProgressEditOptions, useProgressExerciseOptions, useProgressOverview, useSessionDetail } from '../hooks'
import type { ProgressEditOptions, RecentSessionSummary, SessionDetail } from '../repository'

type ProgressMode = 'general' | 'day' | 'exercise' | 'global'
type EditSetState = {
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

const ProgressChart = lazy(() =>
  import('../components/ProgressChart').then((module) => ({ default: module.ProgressChart })),
)

export function ProgressPage() {
  const [mode, setMode] = useState<ProgressMode>('general')
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const dayOptions = useProgressDayOptions() ?? []
  const exerciseOptions = useProgressExerciseOptions() ?? []
  const selectedDay = dayOptions.find((day) => day.dayId === selectedDayId) ?? dayOptions[0] ?? null
  const overview = useProgressOverview({
    canonicalName: mode === 'exercise' ? selectedExercise : null,
    dayId: mode === 'day' ? selectedDay?.dayId : null,
  })
  const chartData = overview?.chartData ?? []
  const recentSessions = overview?.recentSessions ?? []
  const latestScore = chartData.at(-1)?.score ?? 0
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const selectedSessionDetail = useSessionDetail(selectedSessionId)
  const editOptions = useProgressEditOptions()
  const [editingSet, setEditingSet] = useState<EditSetState | null>(null)
  const metrics = [
    { label: 'Volumen', value: `${Math.round((overview?.volumeKg ?? 0) / 100) / 10}t` },
    { label: 'Peso max.', value: String(overview?.maxWeightKg ?? 0) },
    { label: 'Sesiones', value: String(overview?.sessionCount ?? 0) },
    { label: 'Series', value: String(overview?.totalSets ?? 0) },
  ]
  const currentTitle =
    mode === 'day'
      ? selectedDay
        ? selectedDay.name
        : 'Sin dias con registros'
      : mode === 'exercise'
        ? overview?.exerciseName ?? 'Ejercicio'
        : mode === 'global'
          ? 'Global entre rutinas'
          : 'General'
  const currentDescription =
    mode === 'day'
      ? selectedDay
        ? selectedDay.routineName
        : 'Registra una sesion para activar este filtro'
      : mode === 'exercise'
        ? 'Progreso por ejercicio'
        : mode === 'global'
          ? 'Progreso unificado por historial'
          : 'Resumen de todo el entrenamiento'

  function runHistoryAction(action: () => Promise<void>, success: string) {
    startTransition(() => {
      action()
        .then(() => setMessage(success))
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Accion no completada'))
    })
  }

  function exportProgress() {
    runHistoryAction(
      async () => {
        await exportProgressJson()
        await exportProgressCsv()
      },
      'Progreso exportado',
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={currentDescription} title="Rendimiento">
        <button className="grid size-10 place-items-center rounded-[10px] text-arsen-muted">
          <SlidersHorizontal aria-hidden="true" className="size-5" />
          <span className="sr-only">Filtrar progreso</span>
        </button>
      </PageHeader>

      <div className="grid grid-cols-4 border-b border-white/10">
        {[
          { label: 'General', value: 'general' },
          { label: 'Dia', value: 'day' },
          { label: 'Ejercicio', value: 'exercise' },
          { label: 'Global', value: 'global' },
        ].map((tab) => (
          <button
            className={[
              'min-h-10 border-b-2 text-sm font-semibold',
              mode === tab.value ? 'border-arsen-purple2 text-arsen-ink' : 'border-transparent text-arsen-muted',
            ].join(' ')}
            key={tab.value}
            onClick={() => {
              const nextMode = tab.value as ProgressMode
              setMode(nextMode)
              if (nextMode === 'day' && !selectedDayId) setSelectedDayId(dayOptions[0]?.dayId ?? null)
            }}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="grid grid-cols-4 gap-2">
        {[
          { icon: ChartLine, label: 'Score', active: true },
          { icon: Trophy, label: 'Mejores' },
          { icon: NotebookTabs, label: 'Historial' },
          { icon: Download, label: 'Exportar', onClick: exportProgress },
        ].map((item) => (
          <button
            className={[
              'grid min-h-[54px] place-items-center gap-1 rounded-[10px] border text-[10px] font-semibold',
              item.active
                ? 'border-arsen-purple2 bg-arsen-purple/35 text-white'
                : 'border-white/10 bg-arsen-surface text-arsen-muted',
            ].join(' ')}
            key={item.label}
            onClick={item.onClick}
            type="button"
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
          <strong className="block truncate">{currentTitle}</strong>
          {mode === 'day' ? (
            <label className="mt-2 block">
              <span className="sr-only">Filtrar dia</span>
              <select
                className="min-h-10 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3 text-sm font-extrabold text-arsen-ink"
                onChange={(event) => setSelectedDayId(event.target.value || null)}
                value={selectedDay?.dayId ?? ''}
              >
                {dayOptions.length === 0 ? <option value="">Sin dias con registros</option> : null}
                {dayOptions.map((option) => (
                  <option key={option.dayId} value={option.dayId}>
                    {option.name} - {option.routineName} ({option.sessions})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {mode === 'exercise' ? (
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
          ) : null}
          {mode === 'general' || mode === 'global' ? (
            <p className="mt-2 text-sm font-semibold text-arsen-muted">
              {mode === 'global' ? 'Une sesiones aunque cambies de rutina.' : 'Todas las sesiones registradas.'}
            </p>
          ) : null}
        </div>
      </Card>

      <Card className="flex items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-3">
          <ExerciseArt alt={overview?.exerciseName ?? 'Ejercicio'} kind="press" />
          <div>
            <strong>{currentTitle}</strong>
            <p className="text-sm text-arsen-muted">{currentDescription}</p>
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
            <Suspense fallback={<div className="h-full animate-pulse rounded-[10px] bg-white/5" />}>
              <ProgressChart data={chartData} />
            </Suspense>
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
                onDelete={async () => {
                  if (!(await confirmDanger('Eliminar sesion', 'Se borrara esta sesion con sus series y drop sets.'))) return
                  runHistoryAction(() => deleteWorkoutSession(session.id), 'Sesion eliminada')
                }}
                onOpen={() => setSelectedSessionId(session.id)}
                session={session}
              />
            ))
          ) : (
            <Card className="p-4 text-sm text-arsen-muted">Sin sesiones todavia.</Card>
          )}
        </div>
      </section>

      {selectedSessionId ? (
        <SessionDetailSheet
          detail={selectedSessionDetail}
          disabled={isPending}
          onClose={() => setSelectedSessionId(null)}
          onDeleteSet={async (setLogId) => {
            if (!(await confirmDanger('Eliminar serie', 'Se borrara esta serie desde la sesion.'))) return
            runHistoryAction(() => deleteMainSet(setLogId), 'Serie eliminada')
          }}
          onEditSet={(set) => setEditingSet(set)}
        />
      ) : null}

      {editingSet && editOptions ? (
        <EditSetSheet
          disabled={isPending}
          editOptions={editOptions}
          initial={editingSet}
          onClose={() => setEditingSet(null)}
          onSave={(input) => {
            runHistoryAction(async () => {
              await updateWorkoutSession(input.sessionId, {
                date: input.date,
                dayId: input.dayId,
                routineId: input.routineId,
              })
              await moveMainSetToExercise(input.setLogId, input.routineExerciseId)
              await updateMainSet(input.setLogId, {
                reps: input.reps,
                rir: input.rir,
                weightKg: input.weightKg,
              })
            }, 'Serie actualizada')
            setEditingSet(null)
          }}
        />
      ) : null}
    </div>
  )
}

function SessionRow({
  disabled,
  onDelete,
  onOpen,
  session,
}: {
  disabled: boolean
  onDelete: () => void
  onOpen: () => void
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
          onClick={onOpen}
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

function SessionDetailSheet({
  detail,
  disabled,
  onClose,
  onDeleteSet,
  onEditSet,
}: {
  detail: SessionDetail | null | undefined
  disabled: boolean
  onClose: () => void
  onDeleteSet: (setLogId: string) => void
  onEditSet: (set: EditSetState) => void
}) {
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
      <button aria-label="Cerrar detalle" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Detalle de sesion</h2>
            <p className="mt-1 text-xs text-arsen-muted">
              {detail ? `${formatSessionDate(detail.date)} - ${detail.routineName} - ${detail.dayName}` : 'Cargando...'}
            </p>
          </div>
          <button className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        <div className="space-y-3">
          {detail?.exercises.map((exercise) => (
            <Card className="p-3" key={exercise.exerciseLogId}>
              <div className="mb-2 flex items-center gap-2">
                <ExerciseArt alt={exercise.exerciseName} className="size-10" muscle={exercise.mainMuscle} />
                <div className="min-w-0">
                  <strong className="block truncate text-sm">{exercise.exerciseName}</strong>
                  <span className="text-xs text-arsen-muted">{exercise.sets.length} series principales</span>
                </div>
              </div>
              <div className="space-y-2">
                {exercise.sets.map((set) => (
                  <div className="rounded-[10px] border border-white/10 bg-arsen-bg/55 p-2" key={set.id}>
                    <div className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <div>
                        <strong className="text-sm">
                          Serie {set.order + 1}: {set.weightKg} kg x {set.reps}
                        </strong>
                        <span className="ml-2 text-xs text-arsen-muted">RIR {set.rir}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          className="grid size-8 place-items-center rounded-[9px] border border-white/10 text-arsen-purple2 disabled:opacity-40"
                          disabled={disabled}
                          onClick={() =>
                            onEditSet({
                              date: detail.date,
                              dayId: detail.dayId,
                              reps: set.reps,
                              rir: set.rir,
                              routineExerciseId: exercise.routineExerciseId,
                              routineId: detail.routineId,
                              sessionId: detail.id,
                              setLogId: set.id,
                              weightKg: set.weightKg,
                            })
                          }
                          type="button"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                          <span className="sr-only">Editar serie</span>
                        </button>
                        <button
                          className="grid size-8 place-items-center rounded-[9px] border border-red-300/25 text-red-300 disabled:opacity-40"
                          disabled={disabled}
                          onClick={() => onDeleteSet(set.id)}
                          type="button"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                          <span className="sr-only">Eliminar serie</span>
                        </button>
                      </div>
                    </div>
                    {set.dropSets.length > 0 ? (
                      <div className="mt-2 space-y-1 text-xs text-arsen-muted">
                        {set.dropSets.map((dropSet) => (
                          <div key={dropSet.id}>
                            Drop {dropSet.order + 1}: {dropSet.weightKg} kg x {dropSet.reps} - RIR {dropSet.rir}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ))}
          {detail && detail.exercises.length === 0 ? <Card className="p-4 text-sm text-arsen-muted">Sesion sin series.</Card> : null}
        </div>
      </section>
    </div>
  )
}

function EditSetSheet({
  disabled,
  editOptions,
  initial,
  onClose,
  onSave,
}: {
  disabled: boolean
  editOptions: ProgressEditOptions
  initial: EditSetState
  onClose: () => void
  onSave: (input: EditSetState) => void
}) {
  const [form, setForm] = useState(() => ({
    date: initial.date,
    dayId: initial.dayId,
    reps: String(initial.reps),
    rir: String(initial.rir),
    routineExerciseId: initial.routineExerciseId,
    routineId: initial.routineId,
    weightKg: String(initial.weightKg),
  }))
  const daysForRoutine = useMemo(
    () => editOptions.days.filter((day) => day.routineId === form.routineId),
    [editOptions.days, form.routineId],
  )
  const exercisesForDay = useMemo(
    () => editOptions.exercises.filter((exercise) => exercise.dayId === form.dayId),
    [editOptions.exercises, form.dayId],
  )

  useEffect(() => {
    const nextDay = daysForRoutine.find((day) => day.id === form.dayId) ?? daysForRoutine[0]
    if (nextDay && nextDay.id !== form.dayId) {
      setForm((current) => ({ ...current, dayId: nextDay.id }))
    }
  }, [daysForRoutine, form.dayId])

  useEffect(() => {
    const nextExercise = exercisesForDay.find((exercise) => exercise.id === form.routineExerciseId) ?? exercisesForDay[0]
    if (nextExercise && nextExercise.id !== form.routineExerciseId) {
      setForm((current) => ({ ...current, routineExerciseId: nextExercise.id }))
    }
  }, [exercisesForDay, form.routineExerciseId])

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-[430px] items-end bg-black/65">
      <button aria-label="Cerrar editor" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">Editar serie</h2>
          <button className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Fecha</span>
            <input
              className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink"
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              type="date"
              value={form.date}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Rutina</span>
            <select
              className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink"
              onChange={(event) => setForm((current) => ({ ...current, routineId: event.target.value }))}
              value={form.routineId}
            >
              {editOptions.routines.map((routine) => (
                <option key={routine.id} value={routine.id}>
                  {routine.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Dia</span>
            <select
              className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink"
              onChange={(event) => setForm((current) => ({ ...current, dayId: event.target.value }))}
              value={form.dayId}
            >
              {daysForRoutine.map((day) => (
                <option key={day.id} value={day.id}>
                  {day.name} - {day.routineName}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Ejercicio</span>
            <select
              className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink"
              onChange={(event) => setForm((current) => ({ ...current, routineExerciseId: event.target.value }))}
              value={form.routineExerciseId}
            >
              {exercisesForDay.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="Peso kg" onChange={(value) => setForm((current) => ({ ...current, weightKg: value }))} value={form.weightKg} />
            <NumberField label="Reps" onChange={(value) => setForm((current) => ({ ...current, reps: value }))} value={form.reps} />
            <NumberField label="RIR" onChange={(value) => setForm((current) => ({ ...current, rir: value }))} value={form.rir} />
          </div>
        </div>

        <ActionButton
          className="mt-4 w-full"
          disabled={disabled || !form.dayId || !form.routineExerciseId}
          onClick={() =>
            onSave({
              date: form.date,
              dayId: form.dayId,
              reps: numberOrDefault(form.reps, initial.reps),
              rir: numberOrDefault(form.rir, initial.rir),
              routineExerciseId: form.routineExerciseId,
              routineId: form.routineId,
              sessionId: initial.sessionId,
              setLogId: initial.setLogId,
              weightKg: numberOrDefault(form.weightKg, initial.weightKg),
            })
          }
          tone="acid"
        >
          <Check aria-hidden="true" className="size-5" />
          Guardar cambios
        </ActionButton>
      </section>
    </div>
  )
}

function NumberField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-arsen-muted">{label}</span>
      <input
        className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-2 text-center text-sm font-extrabold text-arsen-ink"
        inputMode="decimal"
        onChange={(event) => onChange(event.target.value)}
        type="number"
        value={value}
      />
    </label>
  )
}

function formatSessionDate(date: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${date}T12:00:00`),
  )
}

function numberOrDefault(value: string, fallback: number) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback
}
