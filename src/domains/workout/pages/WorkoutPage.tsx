import {
  CalendarDays,
  ChevronRight,
  Clock3,
  History,
  Info,
  ListChecks,
  StickyNote,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt, type ExerciseArtKind } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'
import { useWorkoutDay } from '../../routine/hooks'
import type { RoutineExercise } from '../../routine/types'
import { localDateKey } from '../../../shared/utils/date'
import { RegisterSetSheet } from '../components/RegisterSetSheet'
import { useWorkoutProgress } from '../hooks'
import type { ExerciseState } from '../types'

const warmups = [
  { weight: '40 kg', reps: '10 reps', rir: 'RIR 4' },
  { weight: '50 kg', reps: '6 reps', rir: 'RIR 3' },
]

export function WorkoutPage() {
  const today = useMemo(() => new Date(), [])
  const dateKey = localDateKey(today)
  const workoutDay = useWorkoutDay(today)
  const dayExercises = workoutDay?.dayExercises ?? []
  const dailyProgress = useWorkoutProgress(dateKey, workoutDay?.day.id, dayExercises)
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  const currentExercise = dayExercises.find((exercise) => dailyProgress.stateByExerciseId.get(exercise.id) !== 'done') ?? dayExercises[0]
  const selectedExercise = selectedExerciseId ? dayExercises.find((exercise) => exercise.id === selectedExerciseId) : null
  const completedCount = dailyProgress.completedCount
  const totalCount = dayExercises.length
  const statusSummary = [
    { label: 'Pendientes', value: dailyProgress.pendingCount },
    { label: 'En progreso', value: dailyProgress.inProgressCount, tone: 'text-arsen-purple2' },
    { label: 'Hechos', value: dailyProgress.completedCount, tone: 'text-arsen-acid' },
    { label: 'Saltados', value: dailyProgress.skippedCount, tone: 'text-arsen-dim' },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={`${weekdayLabel(today)} · ${workoutDay?.day.name ?? 'Cargando'} · sesión activa`}
        title="Entreno de hoy"
      >
        <button className="grid size-10 place-items-center rounded-[10px] text-arsen-muted">
          <CalendarDays aria-hidden="true" className="size-5" />
          <span className="sr-only">Cambiar fecha</span>
        </button>
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
          >
            <item.icon aria-hidden="true" className="size-5" />
            {item.label}
          </button>
        ))}
      </section>

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
              ['Peso anterior', `${currentExercise?.currentWeightKg ?? 0} kg`, 'text-arsen-acid'],
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
          <span className="text-arsen-purple2">2 series</span>
        </div>
        <div className="space-y-2">
          {warmups.map((set, index) => (
            <Card className="grid grid-cols-[28px_1fr_1fr_1fr] items-center gap-2 p-3 text-sm" key={set.weight}>
              <span className="grid size-6 place-items-center rounded-full border border-white/15 text-xs text-arsen-muted">
                {index + 1}
              </span>
              <strong className="text-arsen-acid">{set.weight}</strong>
              <span>{set.reps}</span>
              <span>{set.rir}</span>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between text-xs font-extrabold">
          <span className="text-arsen-muted">Ejercicios del día</span>
          <span className="text-arsen-purple2">Estado</span>
        </div>
        <div className="space-y-2">
          {dayExercises.slice(0, 6).map((exercise) => {
            const state = dailyProgress.stateByExerciseId.get(exercise.id) ?? 'pending'

            return (
            <button className="block text-left" key={exercise.name} onClick={() => setSelectedExerciseId(exercise.id)}>
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
          )})}
        </div>
      </section>

      {selectedExercise && workoutDay ? (
        <RegisterSetSheet
          date={dateKey}
          dayId={workoutDay.day.id}
          displayUnit={workoutDay.settings.preferredUnit}
          exercise={selectedExercise}
          onClose={() => setSelectedExerciseId(null)}
          routineId={workoutDay.routine.id}
        />
      ) : null}
    </div>
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
