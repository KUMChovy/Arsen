import {
  CalendarDays,
  ChevronRight,
  Clock3,
  History,
  Info,
  ListChecks,
  StickyNote,
} from 'lucide-react'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt, type ExerciseArtKind } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'

const statusSummary = [
  { label: 'Pendientes', value: 2 },
  { label: 'En progreso', value: 1, tone: 'text-arsen-purple2' },
  { label: 'Hechos', value: 3, tone: 'text-arsen-acid' },
  { label: 'Saltados', value: 0, tone: 'text-arsen-dim' },
]

const warmups = [
  { weight: '40 kg', reps: '10 reps', rir: 'RIR 4' },
  { weight: '50 kg', reps: '6 reps', rir: 'RIR 3' },
]

const exercises: Array<{
  art: ExerciseArtKind
  name: string
  meta: string
  state: string
}> = [
  { art: 'press', name: 'Press inclinado', meta: 'Pecho · 3x6-8 · RIR 1-2', state: 'En progreso' },
  { art: 'pecDeck', name: 'Pec deck', meta: 'Pecho · 2x8-10 · RIR 0-1', state: 'Pendiente' },
  { art: 'row', name: 'Remo T', meta: 'Espalda · 3x6-8 · RIR 1-2', state: 'Hecho' },
]

export function WorkoutPage() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Lunes · Dia 1 · sesión activa" title="Entreno de hoy">
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
          <strong>Mi rutina actual - Dia 1</strong>
          <span className="text-sm text-arsen-ink">50%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-arsen-acid to-arsen-acid2" />
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-arsen-muted">
          <span>3 / 6 ejercicios</span>
          <span>Upper</span>
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
            <ExerciseArt alt="Press inclinado" kind="press" />
            <div className="min-w-0">
              <h2 className="truncate text-[22px] font-black leading-tight">Press inclinado</h2>
              <span className="mt-1 inline-flex rounded-full bg-arsen-purple/30 px-2 py-1 text-xs font-bold text-arsen-purple2">
                Pecho
              </span>
            </div>
            <Info aria-hidden="true" className="size-5 text-arsen-muted" />
          </div>

          <div className="grid grid-cols-4 gap-0 py-3 text-center">
            {[
              ['Peso anterior', '60 kg', 'text-arsen-acid'],
              ['Series', '4', 'text-arsen-ink'],
              ['RIR', '2', 'text-arsen-ink'],
              ['Descanso', '120 s', 'text-arsen-acid'],
            ].map(([label, value, tone]) => (
              <div className="border-r border-white/10 px-1 last:border-r-0" key={label}>
                <span className="block text-[10px] text-arsen-muted">{label}</span>
                <strong className={['mt-1 block text-lg', tone].join(' ')}>{value}</strong>
              </div>
            ))}
          </div>

          <ActionButton className="w-full">
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
          {exercises.map((exercise) => (
            <Card className="content-auto grid grid-cols-[52px_1fr_auto] items-center gap-3 p-2" key={exercise.name}>
              <ExerciseArt alt={exercise.name} className="size-[52px]" kind={exercise.art} />
              <div className="min-w-0">
                <h3 className="truncate text-sm font-extrabold">{exercise.name}</h3>
                <span className="mt-1 block truncate text-xs text-arsen-muted">{exercise.meta}</span>
              </div>
              <span className="rounded-full bg-arsen-purple/25 px-2 py-1 text-[10px] font-bold text-arsen-purple2">
                {exercise.state}
              </span>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
