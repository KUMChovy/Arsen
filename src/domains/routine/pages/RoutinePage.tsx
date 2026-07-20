import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  ArrowDown,
  ArrowUp,
  CalendarPlus,
  Check,
  Copy,
  Download,
  Dumbbell,
  EllipsisVertical,
  ListPlus,
  Pencil,
  PlusCircle,
  Search,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt, type ExerciseArtKind } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'
import type { Equipment, ExerciseCatalogItem, Routine, RoutineDay, RoutineExercise } from '../types'
import { useActiveRoutineBundle, useExerciseCatalog, useRoutines } from '../hooks'
import { exportRoutineJson, importRoutineJson } from '../importExport'
import {
  addCatalogExerciseToDay,
  createDay,
  createExercise,
  createRoutine,
  deleteDay,
  deleteExercise,
  deleteRoutine,
  duplicateDay,
  duplicateExercise,
  duplicateRoutine,
  moveDay,
  moveExercise,
  renameRoutine,
  setActiveRoutine,
  updateDay,
  updateExercise,
  type ExerciseInput,
} from '../services'

type Mode = 'view' | 'edit' | 'catalog'
type SheetState = { exercise: RoutineExercise | null; mode: 'create' | 'edit' } | null

const equipmentOptions: Equipment[] = ['Barra', 'Mancuerna', 'Maquina', 'Polea', 'Peso corporal', 'Otro']
const weekdayOptions = [
  { label: 'Sin dia fijo', value: '' },
  { label: 'Domingo', value: '0' },
  { label: 'Lunes', value: '1' },
  { label: 'Martes', value: '2' },
  { label: 'Miercoles', value: '3' },
  { label: 'Jueves', value: '4' },
  { label: 'Viernes', value: '5' },
  { label: 'Sabado', value: '6' },
]

export function RoutinePage() {
  const bundle = useActiveRoutineBundle()
  const routines = useRoutines() ?? []
  const catalog = useExerciseCatalog() ?? []
  const days = bundle?.days ?? []
  const importInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('view')
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [isPending, startTransition] = useTransition()
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const selectedDay = days.find((day) => day.id === selectedDayId) ?? days[0] ?? null
  const selectedExercises = selectedDay ? bundle?.exercisesByDay.get(selectedDay.id) ?? [] : []

  useEffect(() => {
    if (!selectedDayId && days[0]) setSelectedDayId(days[0].id)
    if (selectedDayId && !days.some((day) => day.id === selectedDayId)) setSelectedDayId(days[0]?.id ?? null)
  }, [days, selectedDayId])

  function runRoutineAction(action: () => Promise<string | void>, message: string) {
    startTransition(() => {
      action()
        .then(() => setActionMessage(message))
        .catch((error: unknown) => setActionMessage(error instanceof Error ? error.message : 'Accion no completada'))
    })
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Gestion de rutinas y catalogo" title="Rutina">
        <button className="grid size-10 place-items-center rounded-[10px] text-arsen-purple2" type="button">
          <EllipsisVertical aria-hidden="true" className="size-5" />
          <span className="sr-only">Abrir menu de rutina</span>
        </button>
      </PageHeader>

      <ModeTabs mode={mode} onModeChange={setMode} />

      {actionMessage ? (
        <div className="rounded-[10px] border border-arsen-purple/40 bg-arsen-purple/15 px-3 py-2 text-xs text-arsen-purple2">
          {actionMessage}
        </div>
      ) : null}

      <RoutineSwitcher
        activeRoutineId={bundle?.routine.id ?? null}
        disabled={isPending}
        onCreate={() =>
          runRoutineAction(async () => {
            const routineId = await createRoutine('Nueva rutina')
            await setActiveRoutine(routineId)
            return routineId
          }, 'Rutina creada y activada')
        }
        onSelect={(routineId) => runRoutineAction(() => setActiveRoutine(routineId), 'Rutina activa cambiada')}
        routines={routines}
      />

      {mode === 'view' ? <RoutineView bundle={bundle} days={days} /> : null}

      {mode === 'edit' && bundle ? (
        <RoutineEditor
          days={days}
          disabled={isPending}
          exercises={selectedExercises}
          onCreateDay={() => runRoutineAction(() => createDay(bundle.routine.id, `Dia ${days.length + 1}`), 'Dia creado')}
          onDeleteDay={(dayId) => {
            if (!window.confirm('Eliminar este dia y sus ejercicios?')) return
            runRoutineAction(() => deleteDay(dayId), 'Dia eliminado')
          }}
          onDeleteExercise={(exerciseId) => {
            if (!window.confirm('Eliminar este ejercicio?')) return
            runRoutineAction(() => deleteExercise(exerciseId), 'Ejercicio eliminado')
          }}
          onDeleteRoutine={() => {
            if (!window.confirm('Eliminar rutina activa? El historial queda intacto.')) return
            runRoutineAction(() => deleteRoutine(bundle.routine.id), 'Rutina eliminada')
          }}
          onDuplicateDay={(dayId) => runRoutineAction(() => duplicateDay(dayId), 'Dia duplicado')}
          onDuplicateExercise={(exerciseId) => runRoutineAction(() => duplicateExercise(exerciseId), 'Ejercicio duplicado')}
          onDuplicateRoutine={() => runRoutineAction(() => duplicateRoutine(bundle.routine.id), 'Rutina duplicada')}
          onEditExercise={(exercise) => setSheet({ exercise, mode: 'edit' })}
          onMoveDay={(dayId, direction) => runRoutineAction(() => moveDay(dayId, direction), 'Dia movido')}
          onMoveExercise={(exerciseId, direction) => runRoutineAction(() => moveExercise(exerciseId, direction), 'Ejercicio movido')}
          onNewExercise={() => setSheet({ exercise: null, mode: 'create' })}
          onRenameRoutine={(name) => runRoutineAction(() => renameRoutine(bundle.routine.id, name), 'Rutina renombrada')}
          onSelectDay={setSelectedDayId}
          onUpdateDay={(dayId, input) => runRoutineAction(() => updateDay(dayId, input), 'Dia guardado')}
          routine={bundle.routine}
          selectedDay={selectedDay}
        />
      ) : null}

      {mode === 'catalog' && bundle && selectedDay ? (
        <CatalogPanel
          catalog={catalog}
          disabled={isPending}
          onAdd={(catalogItemId) =>
            runRoutineAction(() => addCatalogExerciseToDay(bundle.routine.id, selectedDay.id, catalogItemId), 'Ejercicio agregado')
          }
          selectedDay={selectedDay}
        />
      ) : null}

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
        <ActionButton className="w-full" disabled={isPending} onClick={() => importInputRef.current?.click()} tone="ghost">
          <UploadCloud aria-hidden="true" className="size-5 text-arsen-acid" />
          Subir JSON
        </ActionButton>
      </div>

      <input
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          runRoutineAction(() => importRoutineJson(file), 'Rutina importada y activada')
        }}
        ref={importInputRef}
        type="file"
      />

      {sheet && bundle && selectedDay ? (
        <ExerciseEditorSheet
          disabled={isPending}
          exercise={sheet.exercise}
          key={sheet.exercise?.id ?? 'new'}
          onClose={() => setSheet(null)}
          onSave={(input) => {
            const action =
              sheet.mode === 'edit' && sheet.exercise
                ? () => updateExercise(sheet.exercise!.id, input)
                : () => createExercise(bundle.routine.id, selectedDay.id, input)
            runRoutineAction(action, sheet.mode === 'edit' ? 'Ejercicio guardado' : 'Ejercicio creado')
            setSheet(null)
          }}
        />
      ) : null}
    </div>
  )
}

function ModeTabs({ mode, onModeChange }: { mode: Mode; onModeChange: (mode: Mode) => void }) {
  const tabs: Mode[] = ['view', 'edit', 'catalog']
  const labels: Record<Mode, string> = { catalog: 'Catalogo', edit: 'Editar', view: 'Ver' }

  return (
    <div className="grid grid-cols-3 overflow-hidden rounded-[10px] border border-white/10 bg-arsen-surface">
      {tabs.map((tab) => (
        <button
          className={['min-h-10 text-sm font-semibold', mode === tab ? 'bg-arsen-purple/55 text-white' : 'text-arsen-muted'].join(' ')}
          key={tab}
          onClick={() => onModeChange(tab)}
          type="button"
        >
          {labels[tab]}
        </button>
      ))}
    </div>
  )
}

function RoutineSwitcher({
  activeRoutineId,
  disabled,
  onCreate,
  onSelect,
  routines,
}: {
  activeRoutineId: string | null
  disabled: boolean
  onCreate: () => void
  onSelect: (routineId: string) => void
  routines: Routine[]
}) {
  return (
    <section>
      <div className="mb-2 text-xs font-extrabold text-arsen-muted">Rutinas guardadas</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {routines.map((routine) => (
          <button
            className={[
              'shrink-0 rounded-[10px] border px-3 py-2 text-xs font-extrabold',
              routine.id === activeRoutineId
                ? 'border-arsen-purple2 bg-arsen-purple/40 text-white'
                : 'border-white/10 bg-arsen-surface text-arsen-muted',
            ].join(' ')}
            disabled={disabled || routine.id === activeRoutineId}
            key={routine.id}
            onClick={() => onSelect(routine.id)}
            type="button"
          >
            {routine.name}
          </button>
        ))}
        <button
          className="shrink-0 rounded-[10px] border border-arsen-acid/40 px-3 py-2 text-xs font-extrabold text-arsen-acid"
          disabled={disabled}
          onClick={onCreate}
          type="button"
        >
          + Nueva
        </button>
      </div>
    </section>
  )
}

function RoutineView({
  bundle,
  days,
}: {
  bundle: ReturnType<typeof useActiveRoutineBundle>
  days: RoutineDay[]
}) {
  return (
    <>
      <Card className="flex items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-[10px] bg-arsen-purple/35 text-arsen-purple2">
            <CalendarPlus aria-hidden="true" className="size-5" />
          </div>
          <div>
            <strong>{bundle?.routine.name ?? 'Cargando rutina'}</strong>
            <p className="text-sm font-bold text-arsen-purple2">{days.length} dias</p>
          </div>
        </div>
        <button
          className="grid size-10 place-items-center rounded-[10px] text-arsen-purple2"
          disabled={!bundle}
          onClick={() => {
            if (bundle) void exportRoutineJson(bundle.routine.id)
          }}
          type="button"
        >
          <Download aria-hidden="true" className="size-5" />
          <span className="sr-only">Exportar rutina activa</span>
        </button>
      </Card>

      <section>
        <div className="mb-2 text-xs font-extrabold text-arsen-muted">Dias de entrenamiento</div>
        <div className="space-y-3">
          {days.map((day) => {
            const dayExercises = bundle?.exercisesByDay.get(day.id) ?? []
            const previewExercises = dayExercises.slice(0, 3).map((exercise) => exercise.name)
            const remainingCount = Math.max(dayExercises.length - previewExercises.length, 0)

            return (
              <Card className="content-auto grid grid-cols-[1fr_74px] gap-3 p-4" key={day.id}>
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
                    {remainingCount > 0 ? <li>+ {remainingCount} mas</li> : null}
                  </ul>
                </div>
                <ExerciseArt alt={day.name} className="h-[106px] w-[74px]" kind={artForDay(day.name)} />
              </Card>
            )
          })}
        </div>
      </section>
    </>
  )
}

function RoutineEditor({
  days,
  disabled,
  exercises,
  onCreateDay,
  onDeleteDay,
  onDeleteExercise,
  onDeleteRoutine,
  onDuplicateDay,
  onDuplicateExercise,
  onDuplicateRoutine,
  onEditExercise,
  onMoveDay,
  onMoveExercise,
  onNewExercise,
  onRenameRoutine,
  onSelectDay,
  onUpdateDay,
  routine,
  selectedDay,
}: {
  days: RoutineDay[]
  disabled: boolean
  exercises: RoutineExercise[]
  onCreateDay: () => void
  onDeleteDay: (dayId: string) => void
  onDeleteExercise: (exerciseId: string) => void
  onDeleteRoutine: () => void
  onDuplicateDay: (dayId: string) => void
  onDuplicateExercise: (exerciseId: string) => void
  onDuplicateRoutine: () => void
  onEditExercise: (exercise: RoutineExercise) => void
  onMoveDay: (dayId: string, direction: 'up' | 'down') => void
  onMoveExercise: (exerciseId: string, direction: 'up' | 'down') => void
  onNewExercise: () => void
  onRenameRoutine: (name: string) => void
  onSelectDay: (dayId: string) => void
  onUpdateDay: (dayId: string, input: { description: string; name: string; weekday: RoutineDay['weekday'] }) => void
  routine: Routine
  selectedDay: RoutineDay | null
}) {
  const [routineName, setRoutineName] = useState(routine.name)

  useEffect(() => setRoutineName(routine.name), [routine.name])

  return (
    <>
      <Card className="p-3">
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-arsen-muted">Nombre de rutina</span>
          <input
            className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3 text-sm font-extrabold text-arsen-ink"
            onChange={(event) => setRoutineName(event.target.value)}
            value={routineName}
          />
        </label>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <IconButton disabled={disabled} icon={Check} label="Guardar" onClick={() => onRenameRoutine(routineName)} />
          <IconButton disabled={disabled} icon={Copy} label="Duplicar" onClick={onDuplicateRoutine} />
          <IconButton danger disabled={disabled} icon={Trash2} label="Borrar" onClick={onDeleteRoutine} />
        </div>
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-extrabold text-arsen-muted">Dias</span>
          <button className="text-xs font-extrabold text-arsen-acid" disabled={disabled} onClick={onCreateDay} type="button">
            + Crear dia
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => (
            <button
              className={[
                'shrink-0 rounded-[10px] border px-3 py-2 text-xs font-extrabold',
                day.id === selectedDay?.id ? 'border-arsen-purple2 bg-arsen-purple/40 text-white' : 'border-white/10 bg-arsen-surface text-arsen-muted',
              ].join(' ')}
              key={day.id}
              onClick={() => onSelectDay(day.id)}
              type="button"
            >
              {day.name}
            </button>
          ))}
        </div>
      </section>

      {selectedDay ? (
        <DayEditorCard
          day={selectedDay}
          disabled={disabled}
          onDelete={() => onDeleteDay(selectedDay.id)}
          onDuplicate={() => onDuplicateDay(selectedDay.id)}
          onMoveDown={() => onMoveDay(selectedDay.id, 'down')}
          onMoveUp={() => onMoveDay(selectedDay.id, 'up')}
          onSave={(input) => onUpdateDay(selectedDay.id, input)}
        />
      ) : null}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-extrabold text-arsen-muted">Ejercicios del dia</span>
          <button className="text-xs font-extrabold text-arsen-acid" disabled={disabled || !selectedDay} onClick={onNewExercise} type="button">
            + Ejercicio
          </button>
        </div>
        <div className="space-y-2">
          {exercises.map((exercise) => (
            <ExerciseEditRow
              disabled={disabled}
              exercise={exercise}
              key={exercise.id}
              onDelete={() => onDeleteExercise(exercise.id)}
              onDuplicate={() => onDuplicateExercise(exercise.id)}
              onEdit={() => onEditExercise(exercise)}
              onMoveDown={() => onMoveExercise(exercise.id, 'down')}
              onMoveUp={() => onMoveExercise(exercise.id, 'up')}
            />
          ))}
          {exercises.length === 0 ? <Card className="p-4 text-sm text-arsen-muted">Este dia aun no tiene ejercicios.</Card> : null}
        </div>
      </section>
    </>
  )
}

function DayEditorCard({
  day,
  disabled,
  onDelete,
  onDuplicate,
  onMoveDown,
  onMoveUp,
  onSave,
}: {
  day: RoutineDay
  disabled: boolean
  onDelete: () => void
  onDuplicate: () => void
  onMoveDown: () => void
  onMoveUp: () => void
  onSave: (input: { description: string; name: string; weekday: RoutineDay['weekday'] }) => void
}) {
  const [name, setName] = useState(day.name)
  const [description, setDescription] = useState(day.description)
  const [weekday, setWeekday] = useState(day.weekday === null ? '' : String(day.weekday))

  useEffect(() => {
    setName(day.name)
    setDescription(day.description)
    setWeekday(day.weekday === null ? '' : String(day.weekday))
  }, [day])

  return (
    <Card className="p-3">
      <div className="grid grid-cols-[1fr_118px] gap-2">
        <TextField label="Dia" onChange={setName} value={name} />
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-arsen-muted">Semana</span>
          <select
            className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-sm font-extrabold text-arsen-ink"
            onChange={(event) => setWeekday(event.target.value)}
            value={weekday}
          >
            {weekdayOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TextField label="Descripcion" onChange={setDescription} value={description} />
      <div className="mt-3 grid grid-cols-5 gap-2">
        <IconButton disabled={disabled} icon={Check} label="Guardar" onClick={() => onSave({ description, name, weekday: weekday === '' ? null : (Number(weekday) as RoutineDay['weekday']) })} />
        <IconButton disabled={disabled} icon={ArrowUp} label="Subir" onClick={onMoveUp} />
        <IconButton disabled={disabled} icon={ArrowDown} label="Bajar" onClick={onMoveDown} />
        <IconButton disabled={disabled} icon={Copy} label="Copiar" onClick={onDuplicate} />
        <IconButton danger disabled={disabled} icon={Trash2} label="Borrar" onClick={onDelete} />
      </div>
    </Card>
  )
}

function ExerciseEditRow({
  disabled,
  exercise,
  onDelete,
  onDuplicate,
  onEdit,
  onMoveDown,
  onMoveUp,
}: {
  disabled: boolean
  exercise: RoutineExercise
  onDelete: () => void
  onDuplicate: () => void
  onEdit: () => void
  onMoveDown: () => void
  onMoveUp: () => void
}) {
  return (
    <Card className="grid grid-cols-[52px_1fr_auto] items-center gap-3 p-2">
      <ExerciseArt alt={exercise.name} className="size-[52px]" kind={artForExercise(exercise)} />
      <div className="min-w-0">
        <h3 className="truncate text-sm font-extrabold">{exercise.name}</h3>
        <span className="mt-1 block truncate text-xs text-arsen-muted">
          {exercise.mainMuscle} · {exercise.targetSets}x{exercise.repRange} · RIR {exercise.recommendedRir}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <IconOnly disabled={disabled} icon={Pencil} label="Editar" onClick={onEdit} />
        <IconOnly disabled={disabled} icon={ArrowUp} label="Subir" onClick={onMoveUp} />
        <IconOnly disabled={disabled} icon={ArrowDown} label="Bajar" onClick={onMoveDown} />
        <IconOnly disabled={disabled} icon={Copy} label="Duplicar" onClick={onDuplicate} />
        <IconOnly danger disabled={disabled} icon={Trash2} label="Borrar" onClick={onDelete} />
      </div>
    </Card>
  )
}

function CatalogPanel({
  catalog,
  disabled,
  onAdd,
  selectedDay,
}: {
  catalog: ExerciseCatalogItem[]
  disabled: boolean
  onAdd: (catalogItemId: string) => void
  selectedDay: RoutineDay
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return catalog

    return catalog.filter(
      (item) =>
        item.name.toLowerCase().includes(value) ||
        item.mainMuscle.toLowerCase().includes(value) ||
        item.equipment.toLowerCase().includes(value),
    )
  }, [catalog, query])

  return (
    <section className="space-y-3">
      <Card className="grid grid-cols-[36px_1fr] items-center gap-2 p-3">
        <Search aria-hidden="true" className="size-5 text-arsen-muted" />
        <input
          className="min-h-10 bg-transparent text-sm font-semibold outline-none placeholder:text-arsen-muted"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Agregar a ${selectedDay.name}`}
          value={query}
        />
      </Card>
      <div className="space-y-2">
        {filtered.map((item) => (
          <Card className="grid grid-cols-[52px_1fr_auto] items-center gap-3 p-2" key={item.id}>
            <ExerciseArt alt={item.name} className="size-[52px]" kind={artForCatalogItem(item)} />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-extrabold">{item.name}</h3>
              <span className="mt-1 block truncate text-xs text-arsen-muted">
                {item.mainMuscle} · {item.equipment} · {item.defaultTargetSets}x{item.defaultRepRange}
              </span>
            </div>
            <button
              className="grid size-10 place-items-center rounded-[10px] border border-arsen-purple2/45 text-arsen-purple2 disabled:opacity-40"
              disabled={disabled}
              onClick={() => onAdd(item.id)}
              type="button"
            >
              <ListPlus aria-hidden="true" className="size-5" />
              <span className="sr-only">Agregar ejercicio</span>
            </button>
          </Card>
        ))}
      </div>
    </section>
  )
}

function ExerciseEditorSheet({
  disabled,
  exercise,
  onClose,
  onSave,
}: {
  disabled: boolean
  exercise: RoutineExercise | null
  onClose: () => void
  onSave: (input: ExerciseInput) => void
}) {
  const [form, setForm] = useState(() => exerciseToForm(exercise))

  function update<K extends keyof ExerciseForm>(key: K, value: ExerciseForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
      <button aria-label="Cerrar editor" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Dumbbell aria-hidden="true" className="size-5 text-arsen-purple2" />
              {exercise ? 'Editar ejercicio' : 'Crear ejercicio'}
            </h2>
            <p className="mt-1 text-xs text-arsen-muted">Objetivo, descanso, calentamiento y notas.</p>
          </div>
          <button className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        <div className="space-y-3">
          <TextField label="Nombre" onChange={(value) => update('name', value)} value={form.name} />
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Musculo" onChange={(value) => update('mainMuscle', value)} value={form.mainMuscle} />
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-arsen-muted">Equipo</span>
              <select
                className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink"
                onChange={(event) => update('equipment', event.target.value as Equipment)}
                value={form.equipment}
              >
                {equipmentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <TextField label="Series" onChange={(value) => update('targetSets', value)} type="number" value={form.targetSets} />
            <TextField label="Reps" onChange={(value) => update('repRange', value)} value={form.repRange} />
            <TextField label="RIR" onChange={(value) => update('recommendedRir', value)} value={form.recommendedRir} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <TextField label="Peso kg" onChange={(value) => update('currentWeightKg', value)} type="number" value={form.currentWeightKg} />
            <TextField label="Descanso s" onChange={(value) => update('restSeconds', value)} type="number" value={form.restSeconds} />
            <TextField label="Warmups" onChange={(value) => update('warmupSets', value)} type="number" value={form.warmupSets} />
          </div>
          <TextField label="Protocolo calentamiento" onChange={(value) => update('warmupProtocol', value)} value={form.warmupProtocol} />
          <TextField label="Progresion" onChange={(value) => update('progression', value)} value={form.progression} />
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Notas tecnicas</span>
            <textarea
              className="min-h-20 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 py-2 text-sm font-semibold text-arsen-ink"
              onChange={(event) => update('technicalNotes', event.target.value)}
              value={form.technicalNotes}
            />
          </label>
        </div>

        <ActionButton
          className="mt-4 w-full"
          disabled={disabled}
          onClick={() => onSave(formToExerciseInput(form))}
          tone="acid"
        >
          <Check aria-hidden="true" className="size-5" />
          Guardar ejercicio
        </ActionButton>
      </section>
    </div>
  )
}

type ExerciseForm = {
  currentWeightKg: string
  equipment: Equipment
  mainMuscle: string
  name: string
  progression: string
  recommendedRir: string
  repRange: string
  restSeconds: string
  targetSets: string
  technicalNotes: string
  warmupProtocol: string
  warmupSets: string
}

function exerciseToForm(exercise: RoutineExercise | null): ExerciseForm {
  return {
    currentWeightKg: String(exercise?.currentWeightKg ?? 0),
    equipment: exercise?.equipment ?? 'Barra',
    mainMuscle: exercise?.mainMuscle ?? '',
    name: exercise?.name ?? '',
    progression: exercise?.progression ?? '',
    recommendedRir: exercise?.recommendedRir ?? '1-2',
    repRange: exercise?.repRange ?? '8-10',
    restSeconds: String(exercise?.restSeconds ?? 90),
    targetSets: String(exercise?.targetSets ?? 3),
    technicalNotes: exercise?.technicalNotes ?? '',
    warmupProtocol: exercise?.warmupProtocol ?? '',
    warmupSets: String(exercise?.warmupSets ?? 0),
  }
}

function formToExerciseInput(form: ExerciseForm): ExerciseInput {
  const restSeconds = numberOrDefault(form.restSeconds, 90)

  return {
    currentWeightKg: numberOrDefault(form.currentWeightKg, 0),
    equipment: form.equipment,
    mainMuscle: form.mainMuscle,
    name: form.name,
    progression: form.progression,
    recommendedRir: form.recommendedRir,
    repRange: form.repRange,
    rest: `${restSeconds} seg`,
    restSeconds,
    targetSets: numberOrDefault(form.targetSets, 3),
    technicalNotes: form.technicalNotes,
    warmupProtocol: form.warmupProtocol,
    warmupSets: numberOrDefault(form.warmupSets, 0),
  }
}

function TextField({
  label,
  onChange,
  type = 'text',
  value,
}: {
  label: string
  onChange: (value: string) => void
  type?: 'number' | 'text'
  value: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-arsen-muted">{label}</span>
      <input
        className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink"
        inputMode={type === 'number' ? 'decimal' : undefined}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  )
}

function IconButton({
  danger = false,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  danger?: boolean
  disabled: boolean
  icon: typeof Check
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={[
        'grid min-h-11 place-items-center gap-1 rounded-[10px] border px-1 text-[10px] font-extrabold disabled:opacity-40',
        danger ? 'border-red-300/30 text-red-300' : 'border-white/10 text-arsen-muted',
      ].join(' ')}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  )
}

function IconOnly({
  danger = false,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  danger?: boolean
  disabled: boolean
  icon: typeof Check
  label: string
  onClick: () => void
}) {
  return (
    <button
      className={[
        'grid size-8 place-items-center rounded-[9px] border disabled:opacity-40',
        danger ? 'border-red-300/30 text-red-300' : 'border-white/10 text-arsen-muted',
      ].join(' ')}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="size-4" />
      <span className="sr-only">{label}</span>
    </button>
  )
}

function artForDay(dayName: string): ExerciseArtKind {
  if (dayName.includes('3')) return 'hackSquat'
  if (dayName.includes('5')) return 'row'
  if (dayName.includes('6')) return 'shoulderPress'

  return 'press'
}

function artForExercise(exercise: RoutineExercise): ExerciseArtKind {
  return artForCatalogValue(exercise.canonicalName)
}

function artForCatalogItem(item: ExerciseCatalogItem): ExerciseArtKind {
  return artForCatalogValue(item.canonicalName)
}

function artForCatalogValue(value: string): ExerciseArtKind {
  if (value.includes('pec-deck')) return 'pecDeck'
  if (value.includes('remo')) return 'row'
  if (value.includes('hack') || value.includes('prensa')) return 'hackSquat'
  if (value.includes('jalon') || value.includes('pullover')) return 'latPulldown'
  if (value.includes('militar') || value.includes('hombro')) return 'shoulderPress'

  return 'press'
}

function numberOrDefault(value: string, fallback: number) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback
}
