import { Check, ChevronRight, Info, Pencil, Trash2, TrendingUp } from 'lucide-react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt, type ExerciseArtKind } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'
import type { WeightIncreaseRecommendation } from '../../../shared/calculations/progression'
import { totalVolume } from '../../../shared/calculations/workout'
import { buildWarmupSets } from '../../../shared/calculations/warmups'
import { localDateKey } from '../../../shared/utils/date'
import { confirmDanger } from '../../../shared/utils/alerts'
import { formatWeight } from '../../../shared/utils/weight'
import { useActiveRoutineBundle, useRoutines, useWorkoutDayById } from '../../routine/hooks'
import type { RoutineExercise } from '../../routine/types'
import { RegisterSetSheet } from '../components/RegisterSetSheet'
import { EditSetSheet } from '../components/EditSetSheet'
import { useWeightIncreaseRecommendations, useWorkoutProgress } from '../hooks'
import { completeSessionForDay, deleteMainSet, reactivateExercise, updateMainSet } from '../services'
import { setActiveRoutine } from '../../routine/services'
import type { ExerciseState, SetLog, WeightUnit } from '../types'

type ExerciseFilter = 'all' | 'pending' | 'in_progress' | 'skipped' | 'done'

export function WorkoutPage() {
  const today = useMemo(() => new Date(), [])
  const dateKey = useMemo(() => localDateKey(today), [today])
  const selectedDate = useMemo(() => new Date(`${dateKey}T12:00:00`), [dateKey])
  const bundle = useActiveRoutineBundle()
  const routines = useRoutines() ?? []
  const days = bundle?.days ?? []
  const defaultDayId = days.find((day) => day.weekday === selectedDate.getDay())?.id ?? days[0]?.id ?? null
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const workoutDay = useWorkoutDayById(selectedDayId)
  const dayExercises = workoutDay?.dayExercises ?? []
  const dailyProgress = useWorkoutProgress(dateKey, workoutDay?.day.id, dayExercises)
  const weightIncreaseRecommendations = useWeightIncreaseRecommendations(dayExercises)
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  const [exerciseFilter, setExerciseFilter] = useState<ExerciseFilter>('all')
  const [editingSet, setEditingSet] = useState<{ exercise: RoutineExercise; set: SetLog } | null>(null)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const currentExercise =
    dayExercises.find((exercise) => {
      const state = dailyProgress.stateByExerciseId.get(exercise.id)
      return state === 'pending' || state === 'in_progress'
    }) ??
    dayExercises.find((exercise) => dailyProgress.stateByExerciseId.get(exercise.id) === 'skipped') ??
    dayExercises[0]
  const selectedExercise = selectedExerciseId ? dayExercises.find((exercise) => exercise.id === selectedExerciseId) : null
  const selectedExerciseState = selectedExercise ? dailyProgress.stateByExerciseId.get(selectedExercise.id) ?? 'pending' : 'pending'
  const completedCount = dailyProgress.completedCount
  const totalCount = dayExercises.length
  const preferredUnit = workoutDay?.settings.preferredUnit ?? 'kg'
  const warmups = buildWarmupsForExercise(currentExercise, preferredUnit)
  const mainSets = dailyProgress.setLogs.filter((set) => set.kind === 'main')
  const dailyVolume = Math.round(totalVolume(mainSets, dailyProgress.dropSets))
  const visibleExercises = useMemo(
    () =>
      dayExercises.filter((exercise) => {
        if (exerciseFilter === 'all') return true
        return (dailyProgress.stateByExerciseId.get(exercise.id) ?? 'pending') === exerciseFilter
      }),
    [dailyProgress.stateByExerciseId, dayExercises, exerciseFilter],
  )
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
    if (selectedDayId && days.some((day) => day.id === selectedDayId)) return
    setSelectedDayId(defaultDayId)
  }, [days, defaultDayId, selectedDayId])

  function runSetAction(action: () => Promise<void>, success: string) {
    startTransition(() => {
      action()
        .then(() => setMessage(success))
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Accion no completada'))
    })
  }

  function completeSession() {
    if (!workoutDay) return

    startTransition(() => {
      completeSessionForDay({
        date: dateKey,
        dayId: workoutDay.day.id,
        displayUnit: workoutDay.settings.preferredUnit,
        routineId: workoutDay.routine.id,
      })
        .then(() => setMessage('Sesion finalizada'))
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo finalizar'))
    })
  }

  async function deleteSet(set: SetLog) {
    if (!(await confirmDanger('Eliminar serie', 'Se borrara esta serie y sus drop sets.'))) return

    runSetAction(() => deleteMainSet(set.id), 'Serie eliminada')
  }

  function changeRoutine(routineId: string) {
    startTransition(() => {
      setActiveRoutine(routineId)
        .then(() => {
          setSelectedDayId(null)
          setSelectedExerciseId(null)
          setMessage('Rutina activa cambiada')
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo cambiar rutina'))
    })
  }

  function retakeExercise() {
    const sessionId = dailyProgress.progress?.session?.id
    if (!selectedExercise || !sessionId) return

    startTransition(() => {
      reactivateExercise(sessionId, selectedExercise.id)
        .then(() => {
          setSelectedExerciseId(null)
          setMessage('Ejercicio retomado')
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo retomar'))
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={`${weekdayLabel(selectedDate)} - ${workoutDay?.day.name ?? 'Cargando'} - sesion activa`} title="Entreno de hoy" />

      <Card className="grid grid-cols-2 gap-2 p-3">
        <SelectField
          disabled={isPending}
          label="Rutina"
          onChange={changeRoutine}
          options={routines.map((routine) => ({ label: routine.name, value: routine.id }))}
          value={bundle?.routine.id ?? ''}
        />
        <SelectField
          disabled={isPending || days.length === 0}
          label="Dia"
          onChange={(dayId) => {
            setSelectedDayId(dayId)
            setSelectedExerciseId(null)
          }}
          options={days.map((day) => ({ label: day.name, value: day.id }))}
          value={workoutDay?.day.id ?? selectedDayId ?? ''}
        />
      </Card>

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
              ['Reps', currentExercise?.repRange ?? '-', 'text-arsen-ink'],
              ['RIR', currentExercise?.recommendedRir ?? '-', 'text-arsen-ink'],
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

      <WeightIncreaseCard recommendations={weightIncreaseRecommendations} unit={preferredUnit} />

      {message ? (
        <div className="rounded-[10px] border border-arsen-purple/40 bg-arsen-purple/15 px-3 py-2 text-xs text-arsen-purple2">
          {message}
        </div>
      ) : null}

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
          <span>{dailyProgress.progress?.session?.status === 'completed' ? 'Finalizada' : workoutDay?.day.description ?? 'Sin rutina activa'}</span>
        </div>
        <ActionButton className="mt-3 w-full" disabled={isPending || !workoutDay} onClick={completeSession} tone="ghost">
          <Check aria-hidden="true" className="size-5" />
          Finalizar sesion
        </ActionButton>
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
                    Serie {set.order + 1} - {formatWeight(set.weightKg, preferredUnit)} - {set.reps} reps - RIR {set.rir}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    className="grid size-9 place-items-center rounded-[10px] border border-white/10 text-arsen-purple2 disabled:opacity-40"
                    disabled={isPending}
                    onClick={() => setEditingSet({ exercise, set })}
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

      <section>
        <div className="mb-2 flex items-center justify-between text-xs font-extrabold">
          <span className="text-arsen-muted">Ejercicios del dia</span>
          <span className="text-arsen-purple2">{visibleExercises.length}</span>
        </div>
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {exerciseFilters.map((filter) => (
            <button
              className={[
                'shrink-0 rounded-[10px] border px-3 py-2 text-xs font-extrabold',
                exerciseFilter === filter.value
                  ? 'border-arsen-purple2 bg-arsen-purple/40 text-white'
                  : 'border-white/10 bg-arsen-surface text-arsen-muted',
              ].join(' ')}
              key={filter.value}
              onClick={() => setExerciseFilter(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {visibleExercises.map((exercise) => {
            const state = dailyProgress.stateByExerciseId.get(exercise.id) ?? 'pending'

            return (
              <button className="block w-full text-left" key={exercise.id} onClick={() => setSelectedExerciseId(exercise.id)} type="button">
                <Card className="content-auto grid grid-cols-[52px_1fr_auto] items-center gap-3 p-2">
                  <ExerciseArt alt={exercise.name} className="size-[52px]" kind={artForExercise(exercise)} />
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-extrabold">{exercise.name}</h3>
                    <span className="mt-1 block truncate text-xs text-arsen-muted">
                      {exercise.mainMuscle} - {exercise.targetSets}x{exercise.repRange} - RIR {exercise.recommendedRir}
                    </span>
                  </div>
                  <span className={['rounded-full px-2 py-1 text-[10px] font-bold', stateClassName(state)].join(' ')}>
                    {stateLabel(state)}
                  </span>
                </Card>
              </button>
            )
          })}
          {visibleExercises.length === 0 ? <Card className="p-4 text-sm text-arsen-muted">Sin ejercicios para este filtro.</Card> : null}
        </div>
      </section>

      {selectedExercise && workoutDay ? (
        <RegisterSetSheet
          date={dateKey}
          dayId={workoutDay.day.id}
          displayUnit={workoutDay.settings.preferredUnit}
          exercise={selectedExercise}
          isSkipped={selectedExerciseState === 'skipped'}
          onClose={() => setSelectedExerciseId(null)}
          onRetake={retakeExercise}
          routineId={workoutDay.routine.id}
        />
      ) : null}

      {editingSet ? (
        <EditSetSheet
          disabled={isPending}
          exerciseName={editingSet.exercise.name}
          onClose={() => setEditingSet(null)}
          onDelete={async () => {
            if (!(await confirmDanger('Eliminar serie', 'Se borrara esta serie y sus drop sets.'))) return false
            await deleteMainSet(editingSet.set.id)
            return true
          }}
          onSave={(input) => updateMainSet(editingSet.set.id, input)}
          set={editingSet.set}
          unit={preferredUnit}
        />
      ) : null}
    </div>
  )
}

const exerciseFilters: Array<{ label: string; value: ExerciseFilter }> = [
  { label: 'Todos', value: 'all' },
  { label: 'Pendientes', value: 'pending' },
  { label: 'En progreso', value: 'in_progress' },
  { label: 'Saltados', value: 'skipped' },
  { label: 'Hechos', value: 'done' },
]

function buildWarmupsForExercise(exercise: RoutineExercise | undefined, unit: WeightUnit) {
  if (!exercise) return []

  return buildWarmupSets(exercise.currentWeightKg, exercise.warmupProtocol).map((set) => ({
    reps: set.reps,
    rir: set.rir,
    weight: formatWeight(set.weightKg, unit),
  }))
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

function SelectField({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-bold text-arsen-muted">{label}</span>
      <select
        className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-sm font-extrabold text-arsen-ink"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function WeightIncreaseCard({
  recommendations,
  unit,
}: {
  recommendations: WeightIncreaseRecommendation[]
  unit: WeightUnit
}) {
  if (recommendations.length === 0) return null

  return (
    <Card className="border-arsen-acid/35 p-3">
      <div className="flex items-center gap-2">
        <TrendingUp aria-hidden="true" className="size-5 text-arsen-acid" />
        <div>
          <strong className="block text-sm text-arsen-acid">Listo para subir peso</strong>
          <span className="text-xs text-arsen-muted">{recommendations.length} recomendacion activa</span>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {recommendations.slice(0, 3).map((recommendation) => (
          <div className="rounded-[10px] border border-white/10 bg-arsen-bg/55 p-2" key={recommendation.exerciseId}>
            <div className="flex items-center justify-between gap-2">
              <strong className="truncate text-sm">{recommendation.exerciseName}</strong>
              <span className="shrink-0 text-xs font-extrabold text-arsen-acid">{recommendation.suggestedIncreaseLabel}</span>
            </div>
            <p className="mt-1 text-xs text-arsen-muted">
              Actual {formatWeight(recommendation.currentWeightKg, unit)} - {recommendation.reason}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}
