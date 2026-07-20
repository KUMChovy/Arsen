import { useState, useTransition } from 'react'
import {
  ArrowUpDown,
  CalendarPlus,
  ChevronDown,
  Copy,
  Download,
  EllipsisVertical,
  FileJson,
  PlusCircle,
  Upload,
  UploadCloud,
} from 'lucide-react'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt, type ExerciseArtKind } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'
import { useActiveRoutineBundle } from '../hooks'
import { createDay, createRoutine, duplicateRoutine, setActiveRoutine } from '../services'


const quickActions = [
  { icon: CalendarPlus, label: 'Crear día', active: true },
  { icon: ArrowUpDown, label: 'Ordenar' },
  { icon: Copy, label: 'Duplicar' },
  { icon: FileJson, label: 'JSON' },
]

export function RoutinePage() {
  const bundle = useActiveRoutineBundle()
  const days = bundle?.days ?? []
  const [isPending, startTransition] = useTransition()
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  function runRoutineAction(action: () => Promise<string | void>, message: string) {
    startTransition(() => {
      action()
        .then(() => setActionMessage(message))
        .catch((error: unknown) => setActionMessage(error instanceof Error ? error.message : 'Acción no completada'))
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Gestión de rutinas y catálogo" title="Rutina">
        <button className="grid size-10 place-items-center rounded-[10px] text-arsen-purple2">
          <EllipsisVertical aria-hidden="true" className="size-5" />
          <span className="sr-only">Abrir menú de rutina</span>
        </button>
      </PageHeader>

      <section className="grid grid-cols-4 gap-2">
        {quickActions.map((item) => (
          <button
            className={[
              'grid min-h-[54px] place-items-center gap-1 rounded-[10px] border text-[10px] font-semibold',
              item.active
                ? 'border-arsen-purple2 bg-arsen-purple/35 text-white'
                : 'border-white/10 bg-arsen-surface text-arsen-muted',
            ].join(' ')}
            key={item.label}
            onClick={() => {
              if (!bundle) return
              if (item.label === 'Crear día') {
                runRoutineAction(() => createDay(bundle.routine.id, `Dia ${days.length + 1}`), 'Día creado')
              }
              if (item.label === 'Duplicar') {
                runRoutineAction(() => duplicateRoutine(bundle.routine.id), 'Rutina duplicada')
              }
            }}
          >
            <item.icon aria-hidden="true" className="size-5" />
            {item.label}
          </button>
        ))}
      </section>

      {actionMessage ? (
        <div className="rounded-[10px] border border-arsen-purple/40 bg-arsen-purple/15 px-3 py-2 text-xs text-arsen-purple2">
          {actionMessage}
        </div>
      ) : null}

      <div className="grid grid-cols-3 overflow-hidden rounded-[10px] border border-white/10 bg-arsen-surface">
        {['Ver', 'Editar', 'Catálogo'].map((tab, index) => (
          <button
            className={[
              'min-h-10 text-sm font-semibold',
              index === 0 ? 'bg-arsen-purple/55 text-white' : 'text-arsen-muted',
            ].join(' ')}
            key={tab}
          >
            {tab}
          </button>
        ))}
      </div>

      <Card className="flex items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-[10px] bg-arsen-purple/35 text-arsen-purple2">
            <CalendarPlus aria-hidden="true" className="size-5" />
          </div>
          <div>
            <strong>{bundle?.routine.name ?? 'Cargando rutina'}</strong>
            <p className="text-sm font-bold text-arsen-purple2">{days.length} días</p>
          </div>
        </div>
        <ChevronDown aria-hidden="true" className="size-5 text-arsen-muted" />
      </Card>

      <section className="grid grid-cols-2 gap-2">
        <Card className="flex items-center gap-2 p-3 text-xs font-semibold text-arsen-muted">
          <Download aria-hidden="true" className="size-4 text-arsen-purple2" />
          Exportar activa
        </Card>
        <Card className="flex items-center gap-2 p-3 text-xs font-semibold text-arsen-muted">
          <Upload aria-hidden="true" className="size-4 text-arsen-purple2" />
          Importar rutina
        </Card>
      </section>

      <section>
        <div className="mb-2 text-xs font-extrabold text-arsen-muted">Días de entrenamiento</div>
        <div className="space-y-3">
          {days.map((day) => {
            const dayExercises = bundle?.exercisesByDay.get(day.id) ?? []
            const previewExercises = dayExercises.slice(0, 3).map((exercise) => exercise.name)
            const remainingCount = Math.max(dayExercises.length - previewExercises.length, 0)

            return (
            <Card className="content-auto grid grid-cols-[1fr_74px] gap-3 p-4" key={day.name}>
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-2xl font-black">{day.name}</h2>
                  <span className="text-xs font-extrabold text-arsen-acid">{dayExercises.length} ejercicios</span>
                </div>
                <p className="font-extrabold text-arsen-purple2">{day.description}</p>
                <ul className="mt-2 space-y-1 text-xs text-arsen-muted">
                  {previewExercises.map((exercise) => (
                    <li key={exercise}>{exercise}</li>
                  ))}
                  {remainingCount > 0 ? <li>+ {remainingCount} más</li> : null}
                </ul>
              </div>
              <ExerciseArt alt={day.name} className="h-[106px] w-[74px]" kind={artForDay(day.name)} />
            </Card>
          )})}
        </div>
      </section>

      <div className="space-y-2">
        <ActionButton
          className="w-full"
          disabled={isPending}
          onClick={() =>
            runRoutineAction(async () => {
              const routineId = await createRoutine('Nueva rutina')
              await setActiveRoutine(routineId)
              return routineId
            }, 'Rutina creada y activada')
          }
        >
          <PlusCircle aria-hidden="true" className="size-5" />
          Crear rutina
        </ActionButton>
        <ActionButton className="w-full" tone="ghost">
          <UploadCloud aria-hidden="true" className="size-5 text-arsen-acid" />
          Subir JSON
        </ActionButton>
      </div>
    </div>
  )
}

function artForDay(dayName: string): ExerciseArtKind {
  if (dayName.includes('3')) return 'hackSquat'
  if (dayName.includes('5')) return 'row'
  if (dayName.includes('6')) return 'shoulderPress'

  return 'press'
}
