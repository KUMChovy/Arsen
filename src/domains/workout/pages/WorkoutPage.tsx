import {
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  History,
  Info,
  ListChecks,
  Pencil,
  Play,
  Square,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt, type ExerciseArtKind } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'
import { totalVolume } from '../../../shared/calculations/workout'
import { localDateKey } from '../../../shared/utils/date'
import { formatWeight } from '../../../shared/utils/weight'
import { useWorkoutDay } from '../../routine/hooks'
import type { RoutineExercise } from '../../routine/types'
import { RegisterSetSheet } from '../components/RegisterSetSheet'
import { useWorkoutProgress } from '../hooks'
import { deleteMainSet, updateMainSet, updateSessionNotesForDay } from '../services'
import type { ExerciseState, SetLog, WeightUnit } from '../types'

export function WorkoutPage() {
  const today = useMemo(() => new Date(), [])
  const [dateKey, setDateKey] = useState(() => localDateKey(today))
  const selectedDate = useMemo(() => new Date(`${dateKey}T12:00:00`), [dateKey])
  const workoutDay = useWorkoutDay(selectedDate)
  const dayExercises = workoutDay?.dayExercises ?? []
  const dailyProgress = useWorkoutProgress(dateKey, workoutDay?.day.id, dayExercises)
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [restRemaining, setRestRemaining] = useState(0)
  const [restRunning, setRestRunning] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const currentExercise = dayExercises.find((exercise) => dailyProgress.stateByExerciseId.get(exercise.id) !== 'done') ?? dayExercises[0]
  const selectedExercise = selectedExerciseId ? dayExercises.find((exercise) => exercise.id === selectedExerciseId) : null
  const completedCount = dailyProgress.completedCount
  const totalCount = dayExercises.length
  const preferredUnit = workoutDay?.settings.preferredUnit ?? 'kg'
  const warmups = buildWarmups(currentExercise, preferredUnit)
  const mainSets = dailyProgress.setLogs.filter((set) => set.kind === 'main')
  const dailyVolume = Math.round(totalVolume(mainSets, dailyProgress.dropSets))
  const loggedSetRows = useMemo(
    () =>
      dayExercises.flatMap((exercise) => {
        const log = dailyProgress.exerciseLogByExerciseId.get(exercise.id)
        if (!log) return []

        return dailyProgress.setLogs
          .filter((set) => set.kind === 'main' && set.exerciseLogId === log.id)
          .sort((a, b) => a.order - b.order)
          .map((set) => ({ exercise, set }))
      }),
    [dailyProgress.exerciseLogByExerciseId, dailyProgress.setLogs, dayExercises],
  )
  const statusSummary = [
    { label: 'Pendientes', value: dailyProgress.pendingCount },
    { label: 'En progreso', value: dailyProgress.inProgressCount, tone: 'text-arsen-purple2' },
    { label: 'Hechos', value: dailyProgress.completedCount, tone: 'text-arsen-acid' },
    { label: 'Saltados', value: dailyProgress.skippedCount, tone: 'text-arsen-dim' },
  ]

  useEffect(() => {
    setNotes(dailyProgress.progress?.session?.notes ?? '')
  }, [dailyProgress.progress?.session?.notes])

  useEffect(() => {
    if (!restRunning) return

    const id = window.setInterval(() => {
      setRestRemaining((current) => Math.max(current - 1, 0))
    }, 1000)

    return () => window.clearInterval(id)
  }, [restRunning])

  useEffect(() => {
    if (restRemaining === 0) setRestRunning(false)
  }, [restRemaining])

  function saveNotes() {
    if (!workoutDay) return

    startTransition(() => {
      updateSessionNotesForDay({
        date: dateKey,
        dayId: workoutDay.day.id,
        displayUnit: workoutDay.settings.preferredUnit,
        notes,
        routineId: workoutDay.routine.id,
      })
        .then(() => setMessage('Notas guardadas'))
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se guardaron las notas'))
    })
  }

  function runSetAction(action: () => Promise<void>, success: string) {
    startTransition(() => {
      action()
        .then(() => setMessage(success))
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Accion no completada'))
    })
  }

  function editSet(set: SetLog) {
    const value = window.prompt('Editar serie: peso kg, reps, RIR', `${set.weightKg},${set.reps},${set.rir}`)
    if (!value) return

    const values = value.split(',').map((item) => Number(item.trim()))
    const weightKg = values[0]
    const reps = values[1]
    const rir = values[2]
    if (weightKg === undefined || reps === undefined || rir === undefined || ![weightKg, reps, rir].every(Number.isFinite)) {
      setMessage('Formato invalido. Usa: 80,8,1')
      return
    }

    runSetAction(() => updateMainSet(set.id, { reps, rir, weightKg }), 'Serie editada')
  }

  function deleteSet(set: SetLog) {
    if (!window.confirm('Eliminar esta serie y sus drop sets?')) return

    runSetAction(() => deleteMainSet(set.id), 'Serie eliminada')
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={`${weekdayLabel(selectedDate)} · ${workoutDay?.day.name ?? 'Cargando'} · sesion activa`}
        title={dateKey === localDateKey(today) ? 'Entreno de hoy' : 'Entreno registrado'}
      >
        <label className="grid size-10 place-items-center rounded-[10px] text-arsen-muted">
          <CalendarDays aria-hidden="true" className="size-5" />
          <span className="sr-only">Cambiar fecha</span>
          <input className="sr-only" onChange={(event) => setDateKey(event.target.value)} type="date" value={dateKey} />
        </label>
      </PageHeader>

      <section className="grid grid-cols-4 gap-2">
        {[
          { icon: ListChecks, label: 'Plan', active: true },
          { icon: Clock3, label: 'Descanso' },
          { icon: StickyNote, label: 'Notas' },
          { icon: History, label: 'Historial' },
        ].map((item) => (
          <button
            className={[
              'grid min-h-[54px] place-items-center gap-1 rounded-[10px] border text-[10px] font-semibold',
              item.active
                ? 'border-arsen-purple2 bg-arsen-purple/35 text-white'
                : 'border-white/10 bg-arsen-surface text-arsen-muted',
            ].join(' ')}
            key={item.label}
            type="button"
          >
            <item.icon aria-hidden="true" className="size-5" />
            {item.label}
          </button>
        ))}
      </section>

      <RestTimerCard
        onPause={() => setRestRunning(false)}
        onResume={() => setRestRunning(true)}
        onStop={() => {
          setRestRemaining(0)
          setRestRunning(false)
        }}
        remaining={restRemaining}
        running={restRunning}
      />

      <Card className="p-3">
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Fecha de sesion</span>
            <input
              className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3 text-sm font-extrabold text-arsen-ink"
              onChange={(event) => setDateKey(event.target.value)}
              type="date"
              value={dateKey}
            />
          </label>
          <span className="pb-3 text-xs font-extrabold text-arsen-purple2">{preferredUnit.toUpperCase()}</span>
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs font-bold text-arsen-muted">Notas personales</span>
          <textarea
            className="min-h-20 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3 py-2 text-sm font-semibold text-arsen-ink"
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Sensaciones, tecnica, energia, molestias..."
            value={notes}
          />
        </label>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-arsen-muted">{message ?? 'Offline en IndexedDB'}</span>
          <button
            className="inline-flex min-h-10 items-center gap-2 rounded-[10px] bg-arsen-purple px-3 text-xs font-extrabold text-white disabled:opacity-50"
            disabled={isPending || !workoutDay}
            onClick={saveNotes}
            type="button"
          >
            <Check aria-hidden="true" className="size-4" />
            Guardar
          </button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <strong>{workoutDay ? `${workoutDay.routine.name} - ${workoutDay.day.name}` : 'Cargando rutina'}</strong>
          <span className="text-sm text-arsen-ink">{totalCount ? Math.round((completedCount / totalCount) * 100) : 0}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-arsen-acid to-arsen-acid2"
            style={{ width: `${totalCount ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-arsen-muted">
          <span>
            {completedCount} / {totalCount} ejercicios
          </span>
          <span>{workoutDay?.day.description ?? 'Sin rutina activa'}</span>
        </div>
      </Card>

      <section className="grid grid-cols-4 gap-2">
        {statusSummary.map((item) => (
          <Card className="p-2 text-center" key={item.label}>
            <strong className={['block text-base', item.tone ?? 'text-arsen-ink'].join(' ')}>{item.value}</strong>
            <span className="mt-1 block text-[10px] text-arsen-muted">{item.label}</span>
          </Card>
        ))}
      </section>

      <section>
        <div className="mb-2 text-xs font-extrabold text-arsen-muted">Resumen diario</div>
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-2 text-center">
            <strong className="block text-base text-arsen-acid">{mainSets.length}</strong>
            <span className="mt-1 block text-[10px] text-arsen-muted">Series</span>
          </Card>
          <Card className="p-2 text-center">
            <strong className="block text-base text-arsen-acid">{dailyProgress.dropSets.length}</strong>
            <span className="mt-1 block text-[10px] text-arsen-muted">Drops</span>
          </Card>
          <Card className="p-2 text-center">
            <strong className="block text-base text-arsen-acid">{dailyVolume}</strong>
            <span className="mt-1 block text-[10px] text-arsen-muted">Volumen kg</span>
          </Card>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between text-xs font-extrabold">
          <span className="text-arsen-muted">Series registradas</span>
          <span className="text-arsen-purple2">{loggedSetRows.length}</span>
        </div>
        <div className="space-y-2">
          {loggedSetRows.length > 0 ? (
            loggedSetRows.map(({ exercise, set }) => (
              <Card className="grid grid-cols-[1fr_auto] items-center gap-3 p-3" key={set.id}>
                <div className="min-w-0">
                  <strong className="block truncate text-sm">{exercise.name}</strong>
                  <span className="mt-1 block text-xs text-arsen-muted">
                    Serie {set.order + 1} · {formatWeight(set.weightKg, preferredUnit)} · {set.reps} reps · RIR {set.rir}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="grid size-9 place-items-center rounded-[10px] border border-white/10 text-arsen-purple2 disabled:opacity-40"
                    disabled={isPending}
                    onClick={() => editSet(set)}
                    type="button"
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                    <span className="sr-only">Editar serie</span>
                  </button>
                  <button
                    className="grid size-9 place-items-center rounded-[10px] border border-red-300/30 text-red-300 disabled:opacity-40"
                    disabled={isPending}
                    onClick={() => deleteSet(set)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    <span className="sr-only">Eliminar serie</span>
                  </button>
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-4 text-sm text-arsen-muted">Sin series registradas en esta sesion.</Card>
          )}
        </div>
      </section>

      <div>
        <div className="mb-2 text-xs font-extrabold text-arsen-purple2">Ejercicio actual</div>
        <Card className="p-3">
          <div className="grid grid-cols-[66px_1fr_28px] items-center gap-3 border-b border-white/10 pb-3">
            <ExerciseArt alt={currentExercise?.name ?? 'Ejercicio'} kind={artForExercise(currentExercise)} />
            <div className="min-w-0">
              <h2 className="truncate text-[22px] font-black leading-tight">{currentExercise?.name ?? 'Sin ejercicio'}</h2>
              <span className="mt-1 inline-flex rounded-full bg-arsen-purple/30 px-2 py-1 text-xs font-bold text-arsen-purple2">
                {currentExercise?.mainMuscle ?? 'Descanso'}
              </span>
            </div>
            <Info aria-hidden="true" className="size-5 text-arsen-muted" />
          </div>

          <div className="grid grid-cols-4 gap-0 py-3 text-center">
            {[
              ['Peso anterior', formatWeight(currentExercise?.currentWeightKg ?? 0, preferredUnit), 'text-arsen-acid'],
              ['Series', String(currentExercise?.targetSets ?? 0), 'text-arsen-ink'],
              ['RIR', currentExercise?.recommendedRir ?? '-', 'text-arsen-ink'],
              ['Descanso', `${currentExercise?.restSeconds ?? 0} s`, 'text-arsen-acid'],
            ].map(([label, value, tone]) => (
              <div className="border-r border-white/10 px-1 last:border-r-0" key={label}>
                <span className="block text-[10px] text-arsen-muted">{label}</span>
                <strong className={['mt-1 block text-lg', tone].join(' ')}>{value}</strong>
              </div>
            ))}
          </div>

          <ActionButton className="w-full" disabled={!currentExercise} onClick={() => setSelectedExerciseId(currentExercise?.id ?? null)}>
            Registrar
            <ChevronRight aria-hidden="true" className="size-5" />
          </ActionButton>
        </Card>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between text-xs font-extrabold">
          <span className="text-arsen-muted">Calentamiento</span>
          <span className="text-arsen-purple2">{warmups.length} series</span>
        </div>
        <div className="space-y-2">
          {warmups.map((set, index) => (
            <Card className="grid grid-cols-[28px_1fr_1fr_1fr] items-center gap-2 p-3 text-sm" key={`${set.weight}-${index}`}>
              <span className="grid size-6 place-items-center rounded-full border border-white/15 text-xs text-arsen-muted">
                {index + 1}
              </span>
              <strong className="text-arsen-acid">{set.weight}</strong>
              <span>{set.reps} reps</span>
              <span>RIR {set.rir}</span>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between text-xs font-extrabold">
          <span className="text-arsen-muted">Ejercicios del dia</span>
          <span className="text-arsen-purple2">Estado</span>
        </div>
        <div className="space-y-2">
          {dayExercises.slice(0, 8).map((exercise) => {
            const state = dailyProgress.stateByExerciseId.get(exercise.id) ?? 'pending'

            return (
              <button className="block w-full text-left" key={exercise.id} onClick={() => setSelectedExerciseId(exercise.id)} type="button">
                <Card className="content-auto grid grid-cols-[52px_1fr_auto] items-center gap-3 p-2">
                  <ExerciseArt alt={exercise.name} className="size-[52px]" kind={artForExercise(exercise)} />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-extrabold">{exercise.name}</h3>
                    <span className="mt-1 block truncate text-xs text-arsen-muted">
                      {exercise.mainMuscle} · {exercise.targetSets}x{exercise.repRange} · RIR {exercise.recommendedRir}
                    </span>
                  </div>
                  <span className={['rounded-full px-2 py-1 text-[10px] font-bold', stateClassName(state)].join(' ')}>
                    {stateLabel(state)}
                  </span>
                </Card>
              </button>
            )
          })}
        </div>
      </section>

      {selectedExercise && workoutDay ? (
        <RegisterSetSheet
          date={dateKey}
          dayId={workoutDay.day.id}
          displayUnit={workoutDay.settings.preferredUnit}
          exercise={selectedExercise}
          onClose={() => setSelectedExerciseId(null)}
          onSaved={(restSeconds) => {
            setRestRemaining(restSeconds)
            setRestRunning(restSeconds > 0)
          }}
          routineId={workoutDay.routine.id}
        />
      ) : null}
    </div>
  )
}

function buildWarmups(exercise: RoutineExercise | undefined, unit: WeightUnit) {
  if (!exercise) return []

  const workingWeight = exercise.currentWeightKg
  const warmupCount = exercise.warmupSets || 2
  if (warmupCount <= 0 || workingWeight <= 0) return []

  const percentages = warmupCount >= 3 ? [0.5, 0.65, 0.8] : [0.55, 0.75]
  const reps = warmupCount >= 3 ? [10, 6, 3] : [10, 6]
  return percentages.slice(0, warmupCount).map((percentage, index) => ({
    reps: reps[index] ?? 5,
    rir: Math.max(4 - index, 2),
    weight: formatWeight(Math.round(workingWeight * percentage * 2) / 2, unit),
  }))
}

function RestTimerCard({
  onPause,
  onResume,
  onStop,
  remaining,
  running,
}: {
  onPause: () => void
  onResume: () => void
  onStop: () => void
  remaining: number
  running: boolean
}) {
  if (remaining <= 0) return null

  const minutes = Math.floor(remaining / 60)
  const seconds = String(remaining % 60).padStart(2, '0')

  return (
    <Card className="grid grid-cols-[1fr_auto] items-center gap-3 border-arsen-acid/35 p-3">
      <div>
        <span className="text-xs font-extrabold text-arsen-muted">Descanso</span>
        <strong className="mt-1 block text-3xl leading-none text-arsen-acid">
          {minutes}:{seconds}
        </strong>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="grid size-10 place-items-center rounded-[10px] bg-arsen-purple text-white"
          onClick={running ? onPause : onResume}
          type="button"
        >
          {running ? <Square aria-hidden="true" className="size-4" /> : <Play aria-hidden="true" className="size-4" />}
          <span className="sr-only">{running ? 'Pausar descanso' : 'Reanudar descanso'}</span>
        </button>
        <button className="rounded-[10px] border border-white/10 px-3 py-2 text-xs font-extrabold text-arsen-muted" onClick={onStop} type="button">
          Cerrar
        </button>
      </div>
    </Card>
  )
}

function artForExercise(exercise: RoutineExercise | undefined): ExerciseArtKind {
  const value = exercise?.canonicalName ?? ''
  if (value.includes('pec-deck')) return 'pecDeck'
  if (value.includes('remo')) return 'row'
  if (value.includes('hack') || value.includes('prensa')) return 'hackSquat'
  if (value.includes('jalon') || value.includes('pullover')) return 'latPulldown'
  if (value.includes('militar') || value.includes('hombro')) return 'shoulderPress'

  return 'press'
}

function weekdayLabel(date: Date) {
  return new Intl.DateTimeFormat('es-MX', { weekday: 'long' }).format(date)
}

function stateLabel(state: ExerciseState) {
  const labels: Record<ExerciseState, string> = {
    done: 'Hecho',
    in_progress: 'En progreso',
    pending: 'Pendiente',
    skipped: 'Saltado',
  }

  return labels[state]
}

function stateClassName(state: ExerciseState) {
  const classes: Record<ExerciseState, string> = {
    done: 'bg-arsen-acid/20 text-arsen-acid',
    in_progress: 'bg-arsen-purple/25 text-arsen-purple2',
    pending: 'bg-white/10 text-arsen-muted',
    skipped: 'bg-white/5 text-arsen-dim',
  }

  return classes[state]
}
