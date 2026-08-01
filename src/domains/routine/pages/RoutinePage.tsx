import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  CalendarPlus,
  Check,
  Copy,
  Download,
  EllipsisVertical,
  GripVertical,
  Info,
  ListPlus,
  Pencil,
  PlusCircle,
  Search,
  Trash2,
  TrendingUp,
  UploadCloud,
  X,
} from 'lucide-react'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'
import type { WeightIncreaseRecommendation } from '../../../shared/calculations/progression'
import { buildWarmupSets, normalizeWarmupProtocol, warmupProtocolLabel, type WarmupProtocol } from '../../../shared/calculations/warmups'
import { confirmDanger } from '../../../shared/utils/alerts'
import { formatRepRange } from '../../../shared/utils/reps'
import { useWeightIncreaseRecommendations } from '../../workout/hooks'
import type { Equipment, ExerciseCatalogItem, MuscleGroup, Routine, RoutineDay, RoutineExercise } from '../types'
import { useActiveRoutineBundle, useExerciseCatalog, useRoutines } from '../hooks'
import { exportRoutineJson, importRoutineJson } from '../importExport'
import {
  addCatalogExerciseToDay,
  createCatalogExercise,
  createDay,
  createRoutine,
  deleteCatalogExercise,
  deleteDay,
  deleteExercise,
  deleteRoutine,
  duplicateDay,
  duplicateExercise,
  duplicateRoutine,
  renameRoutine,
  reorderDays,
  reorderExercises,
  setActiveRoutine,
  updateCatalogExercise,
  updateDay,
  updateExercise,
  type CatalogExerciseInput,
  type ExerciseInput,
} from '../services'
import { dominantMuscleForExercises } from '../utils/dominantMuscle'
import { muscleGroups, normalizeMuscleGroup } from '../utils/muscles'

type Mode = 'view' | 'edit' | 'catalog'
type CatalogSheetState = { item: ExerciseCatalogItem | null } | null
type RecipeSheetState =
  | { catalogItem: ExerciseCatalogItem; exercise: null; mode: 'add' }
  | { catalogItem: null; exercise: RoutineExercise; mode: 'edit' }
  | null

const equipmentOptions: Equipment[] = ['Barra', 'Mancuerna', 'Maquina', 'Polea', 'Peso corporal', 'Otro']
const warmupProtocolOptions: WarmupProtocol[] = ['none', 'hypertrophy', 'strength', 'progressive', 'heavy_low_volume']
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
  const navigate = useNavigate()
  const bundle = useActiveRoutineBundle()
  const routines = useRoutines() ?? []
  const catalog = useExerciseCatalog() ?? []
  const days = bundle?.days ?? []
  const importInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('view')
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [catalogSheet, setCatalogSheet] = useState<CatalogSheetState>(null)
  const [recipeSheet, setRecipeSheet] = useState<RecipeSheetState>(null)
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const selectedDay = days.find((day) => day.id === selectedDayId) ?? days[0] ?? null
  const selectedExercises = selectedDay ? bundle?.exercisesByDay.get(selectedDay.id) ?? [] : []
  const recommendationByExerciseId = new Map(useWeightIncreaseRecommendations(selectedExercises).map((recommendation) => [recommendation.exerciseId, recommendation]))

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
        <RoutineActions
          disabled={isPending || !bundle}
          onCreate={() =>
            runRoutineAction(async () => {
              const routineId = await createRoutine('Nueva rutina')
              await setActiveRoutine(routineId)
              return routineId
            }, 'Rutina creada y activada')
          }
          onExport={() => {
            if (bundle) void exportRoutineJson(bundle.routine.id)
          }}
          onImport={() => importInputRef.current?.click()}
        />
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
        onSelect={(routineId) => runRoutineAction(() => setActiveRoutine(routineId), 'Rutina activa cambiada')}
        routines={routines}
      />

      {mode === 'view' ? (
        <RoutineView
          bundle={bundle}
          days={days}
          onSelectDay={(dayId) => navigate(`/rutina/dia/${dayId}`)}
        />
      ) : null}

      {mode === 'edit' && bundle ? (
        <RoutineEditor
          days={days}
          disabled={isPending}
          exercises={selectedExercises}
          onAddExercise={() => setCatalogPickerOpen(true)}
          onCreateDay={() => runRoutineAction(() => createDay(bundle.routine.id, `Dia ${days.length + 1}`), 'Dia creado')}
          onDeleteDay={async (dayId) => {
            if (!(await confirmDanger('Eliminar dia', 'Se borrara este dia y sus ejercicios.'))) return
            runRoutineAction(() => deleteDay(dayId), 'Dia eliminado')
          }}
          onDeleteExercise={async (exerciseId) => {
            if (!(await confirmDanger('Quitar ejercicio', 'Se quitara este ejercicio del dia.'))) return
            runRoutineAction(() => deleteExercise(exerciseId), 'Ejercicio quitado')
          }}
          onDeleteRoutine={async () => {
            if (!(await confirmDanger('Eliminar rutina', 'El historial queda intacto, pero la rutina se borrara.'))) return
            runRoutineAction(() => deleteRoutine(bundle.routine.id), 'Rutina eliminada')
          }}
          onDuplicateDay={(dayId) => runRoutineAction(() => duplicateDay(dayId), 'Dia duplicado')}
          onDuplicateExercise={(exerciseId) => runRoutineAction(() => duplicateExercise(exerciseId), 'Ejercicio duplicado')}
          onDuplicateRoutine={() => runRoutineAction(() => duplicateRoutine(bundle.routine.id), 'Rutina duplicada')}
          onEditExercise={(exercise) => setRecipeSheet({ catalogItem: null, exercise, mode: 'edit' })}
          onRenameRoutine={(name) => runRoutineAction(() => renameRoutine(bundle.routine.id, name), 'Rutina renombrada')}
          onReorderDays={(orderedIds) => runRoutineAction(() => reorderDays(bundle.routine.id, orderedIds), 'Dias reordenados')}
          onReorderExercises={(orderedIds) => {
            if (!selectedDay) return
            runRoutineAction(() => reorderExercises(selectedDay.id, orderedIds), 'Ejercicios reordenados')
          }}
          onSelectDay={setSelectedDayId}
          onUpdateDay={(dayId, input) => runRoutineAction(() => updateDay(dayId, input), 'Dia guardado')}
          recommendationByExerciseId={recommendationByExerciseId}
          routine={bundle.routine}
          selectedDay={selectedDay}
        />
      ) : null}

      {mode === 'catalog' ? (
        <CatalogPanel
          catalog={catalog}
          disabled={isPending}
          onCreate={() => setCatalogSheet({ item: null })}
          onDelete={async (catalogItemId) => {
            if (!(await confirmDanger('Eliminar del catalogo', 'Las rutinas existentes no se borran.'))) return
            runRoutineAction(() => deleteCatalogExercise(catalogItemId), 'Ejercicio eliminado del catalogo')
          }}
          onEdit={(item) => setCatalogSheet({ item })}
        />
      ) : null}

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

      {catalogPickerOpen && selectedDay && bundle ? (
        <CatalogPickerSheet
          catalog={catalog}
          onClose={() => setCatalogPickerOpen(false)}
          onCreateCatalog={() => setCatalogSheet({ item: null })}
          onSelect={(item) => {
            setCatalogPickerOpen(false)
            setRecipeSheet({ catalogItem: item, exercise: null, mode: 'add' })
          }}
          selectedDay={selectedDay}
        />
      ) : null}

      {catalogSheet ? (
        <CatalogExerciseEditorSheet
          disabled={isPending}
          item={catalogSheet.item}
          onClose={() => setCatalogSheet(null)}
          onSave={(input) => {
            const action = catalogSheet.item
              ? () => updateCatalogExercise(catalogSheet.item!.id, input)
              : () => createCatalogExercise(input)
            runRoutineAction(action, catalogSheet.item ? 'Ejercicio de catalogo guardado' : 'Ejercicio creado en catalogo')
            setCatalogSheet(null)
          }}
        />
      ) : null}

      {recipeSheet && selectedDay && bundle ? (
        <RoutineExerciseRecipeSheet
          catalogItem={recipeSheet.catalogItem}
          disabled={isPending}
          exercise={recipeSheet.exercise}
          onClose={() => setRecipeSheet(null)}
          onSave={(input) => {
            const action =
              recipeSheet.mode === 'edit' && recipeSheet.exercise
                ? () => updateExercise(recipeSheet.exercise!.id, input)
                : () => addCatalogExerciseToDay(bundle.routine.id, selectedDay.id, recipeSheet.catalogItem!.id, input)
            runRoutineAction(action, recipeSheet.mode === 'edit' ? 'Receta guardada' : 'Ejercicio agregado al dia')
            setRecipeSheet(null)
          }}
        />
      ) : null}
    </div>
  )
}

function RoutineActions({
  disabled,
  onCreate,
  onExport,
  onImport,
}: {
  disabled: boolean
  onCreate: () => void
  onExport: () => void
  onImport: () => void
}) {
  return (
    <details className="relative">
      <summary className="grid size-10 cursor-pointer list-none place-items-center rounded-[10px] text-arsen-purple2">
        <EllipsisVertical aria-hidden="true" className="size-5" />
        <span className="sr-only">Abrir acciones de rutina</span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-44 rounded-[10px] border border-white/10 bg-arsen-surface p-1 shadow-lg">
        <MenuButton disabled={disabled} icon={PlusCircle} label="Crear rutina" onClick={onCreate} />
        <MenuButton disabled={disabled} icon={UploadCloud} label="Importar JSON" onClick={onImport} />
        <MenuButton disabled={disabled} icon={Download} label="Exportar JSON" onClick={onExport} />
      </div>
    </details>
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
  onSelect,
  routines,
}: {
  activeRoutineId: string | null
  disabled: boolean
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
      </div>
    </section>
  )
}

function RoutineView({
  bundle,
  days,
  onSelectDay,
}: {
  bundle: ReturnType<typeof useActiveRoutineBundle>
  days: RoutineDay[]
  onSelectDay: (dayId: string) => void
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
      </Card>

      <section>
        <div className="mb-2 text-xs font-extrabold text-arsen-muted">Dias de entrenamiento</div>
        <div className="space-y-3">
          {days.map((day) => {
            const dayExercises = bundle?.exercisesByDay.get(day.id) ?? []
            const dominantMuscle = dominantMuscleForExercises(dayExercises)

            return (
              <button className="block w-full text-left" key={day.id} onClick={() => onSelectDay(day.id)} type="button">
                <Card className="content-auto grid grid-cols-[1fr_74px] items-center gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-2xl font-black">{day.name}</h2>
                      <span className="text-xs font-extrabold text-arsen-acid">{dayExercises.length} ejercicios</span>
                    </div>
                    <p className="font-extrabold text-arsen-purple2">{dominantMuscle}</p>
                    <p className="mt-1 text-sm text-arsen-muted">{day.description || 'Sin descripcion'}</p>
                  </div>
                  <ExerciseArt alt={day.name} className="size-[74px]" muscle={dominantMuscle} />
                </Card>
              </button>
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
  onAddExercise,
  onCreateDay,
  onDeleteDay,
  onDeleteExercise,
  onDeleteRoutine,
  onDuplicateDay,
  onDuplicateExercise,
  onDuplicateRoutine,
  onEditExercise,
  onRenameRoutine,
  onReorderDays,
  onReorderExercises,
  onSelectDay,
  onUpdateDay,
  recommendationByExerciseId,
  routine,
  selectedDay,
}: {
  days: RoutineDay[]
  disabled: boolean
  exercises: RoutineExercise[]
  onAddExercise: () => void
  onCreateDay: () => void
  onDeleteDay: (dayId: string) => void
  onDeleteExercise: (exerciseId: string) => void
  onDeleteRoutine: () => void
  onDuplicateDay: (dayId: string) => void
  onDuplicateExercise: (exerciseId: string) => void
  onDuplicateRoutine: () => void
  onEditExercise: (exercise: RoutineExercise) => void
  onRenameRoutine: (name: string) => void
  onReorderDays: (orderedIds: string[]) => void
  onReorderExercises: (orderedIds: string[]) => void
  onSelectDay: (dayId: string) => void
  onUpdateDay: (dayId: string, input: { description: string; name: string; weekday: RoutineDay['weekday'] }) => void
  recommendationByExerciseId: Map<string, WeightIncreaseRecommendation>
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
        <SortableList ids={days.map((day) => day.id)} onReorder={onReorderDays}>
          <div className="space-y-2">
            {days.map((day) => (
              <SortableRow id={day.id} key={day.id}>
                <button
                  className={[
                    'grid min-h-12 w-full grid-cols-[28px_1fr_auto] items-center gap-2 rounded-[10px] border px-3 text-left text-xs font-extrabold',
                    day.id === selectedDay?.id ? 'border-arsen-purple2 bg-arsen-purple/40 text-white' : 'border-white/10 bg-arsen-surface text-arsen-muted',
                  ].join(' ')}
                  onClick={() => onSelectDay(day.id)}
                  type="button"
                >
                  <GripVertical aria-hidden="true" className="size-4 text-arsen-dim" />
                  {day.name}
                  <span>{weekdayName(day.weekday)}</span>
                </button>
              </SortableRow>
            ))}
          </div>
        </SortableList>
      </section>

      {selectedDay ? (
        <DayEditorCard
          day={selectedDay}
          disabled={disabled}
          onDelete={() => onDeleteDay(selectedDay.id)}
          onDuplicate={() => onDuplicateDay(selectedDay.id)}
          onSave={(input) => onUpdateDay(selectedDay.id, input)}
        />
      ) : null}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-extrabold text-arsen-muted">Ejercicios del dia</span>
          <button className="text-xs font-extrabold text-arsen-acid" disabled={disabled || !selectedDay} onClick={onAddExercise} type="button">
            + Ejercicio
          </button>
        </div>
        <SortableList ids={exercises.map((exercise) => exercise.id)} onReorder={onReorderExercises}>
          <div className="space-y-2">
            {exercises.map((exercise) => (
              <SortableRow id={exercise.id} key={exercise.id}>
                <ExerciseEditRow
                  disabled={disabled}
                  exercise={exercise}
                  onDelete={() => onDeleteExercise(exercise.id)}
                  onDuplicate={() => onDuplicateExercise(exercise.id)}
                  onEdit={() => onEditExercise(exercise)}
                  recommendation={recommendationByExerciseId.get(exercise.id) ?? null}
                />
              </SortableRow>
            ))}
          </div>
        </SortableList>
        {exercises.length === 0 ? <Card className="p-4 text-sm text-arsen-muted">Este dia aun no tiene ejercicios.</Card> : null}
      </section>
    </>
  )
}

function DayEditorCard({
  day,
  disabled,
  onDelete,
  onDuplicate,
  onSave,
}: {
  day: RoutineDay
  disabled: boolean
  onDelete: () => void
  onDuplicate: () => void
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
        <TextField label="Nombre del dia" onChange={setName} value={name} />
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
      <div className="mt-3 grid grid-cols-3 gap-2">
        <IconButton disabled={disabled} icon={Check} label="Guardar" onClick={() => onSave({ description, name, weekday: weekday === '' ? null : (Number(weekday) as RoutineDay['weekday']) })} />
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
  recommendation,
}: {
  disabled: boolean
  exercise: RoutineExercise
  onDelete: () => void
  onDuplicate: () => void
  onEdit: () => void
  recommendation: WeightIncreaseRecommendation | null
}) {
  return (
    <Card className="grid grid-cols-[28px_52px_1fr_auto] items-center gap-2 p-2">
      <GripVertical aria-hidden="true" className="size-4 text-arsen-dim" />
      <ExerciseArt alt={exercise.name} className="size-[52px]" muscle={exercise.mainMuscle} />
      <div className="min-w-0">
        <h3 className="truncate text-sm font-extrabold">{exercise.name}</h3>
        <span className="mt-1 block truncate text-xs text-arsen-muted">
          {exercise.mainMuscle} - {exercise.targetSets}x{formatRepRange(exercise.repsMin, exercise.repsMax)} - RIR {exercise.recommendedRir}
        </span>
        {recommendation ? (
          <span className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-arsen-acid/15 px-2 py-1 text-[10px] font-extrabold text-arsen-acid">
            <TrendingUp aria-hidden="true" className="size-3 shrink-0" />
            <span className="truncate">Listo para subir peso: {recommendation.suggestedIncreaseLabel}</span>
          </span>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-1">
        <IconOnly disabled={disabled} icon={Pencil} label="Editar receta" onClick={onEdit} />
        <IconOnly disabled={disabled} icon={Copy} label="Duplicar" onClick={onDuplicate} />
        <IconOnly danger disabled={disabled} icon={Trash2} label="Quitar" onClick={onDelete} />
      </div>
    </Card>
  )
}

function CatalogPanel({
  catalog,
  disabled,
  onCreate,
  onDelete,
  onEdit,
}: {
  catalog: ExerciseCatalogItem[]
  disabled: boolean
  onCreate: () => void
  onDelete: (catalogItemId: string) => void
  onEdit: (item: ExerciseCatalogItem) => void
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => filterCatalog(catalog, query), [catalog, query])

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <SearchBox onChange={setQuery} placeholder="Buscar en catalogo" value={query} />
        <button
          className="grid size-12 place-items-center rounded-[10px] border border-arsen-acid/40 text-arsen-acid disabled:opacity-40"
          disabled={disabled}
          onClick={onCreate}
          type="button"
        >
          <PlusCircle aria-hidden="true" className="size-5" />
          <span className="sr-only">Crear ejercicio de catalogo</span>
        </button>
      </div>
      <div className="space-y-2">
        {filtered.map((item) => (
          <Card className="grid grid-cols-[52px_1fr_auto] items-center gap-3 p-2" key={item.id}>
            <ExerciseArt alt={item.name} className="size-[52px]" muscle={item.mainMuscle} />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-extrabold">{item.name}</h3>
              <span className="mt-1 block truncate text-xs text-arsen-muted">
                {normalizeMuscleGroup(item.mainMuscle)} - {item.equipment}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <IconOnly disabled={disabled} icon={Pencil} label="Editar catalogo" onClick={() => onEdit(item)} />
              <IconOnly danger disabled={disabled} icon={Trash2} label="Eliminar catalogo" onClick={() => onDelete(item.id)} />
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}

function CatalogPickerSheet({
  catalog,
  onClose,
  onCreateCatalog,
  onSelect,
  selectedDay,
}: {
  catalog: ExerciseCatalogItem[]
  onClose: () => void
  onCreateCatalog: () => void
  onSelect: (item: ExerciseCatalogItem) => void
  selectedDay: RoutineDay
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => filterCatalog(catalog, query), [catalog, query])

  return (
    <SheetFrame onClose={onClose} title={`Agregar a ${selectedDay.name}`}>
      <SearchBox onChange={setQuery} placeholder="Buscar ejercicio" value={query} />
      <div className="mt-3 space-y-2">
        {filtered.map((item) => (
          <button className="block w-full text-left" key={item.id} onClick={() => onSelect(item)} type="button">
            <Card className="grid grid-cols-[52px_1fr_auto] items-center gap-3 p-2">
              <ExerciseArt alt={item.name} className="size-[52px]" muscle={item.mainMuscle} />
              <div className="min-w-0">
                <h3 className="truncate text-sm font-extrabold">{item.name}</h3>
                <span className="mt-1 block truncate text-xs text-arsen-muted">
                  {normalizeMuscleGroup(item.mainMuscle)} - {item.equipment}
                </span>
              </div>
              <ListPlus aria-hidden="true" className="size-5 text-arsen-purple2" />
            </Card>
          </button>
        ))}
        <ActionButton className="w-full" onClick={onCreateCatalog} tone="ghost">
          <PlusCircle aria-hidden="true" className="size-5" />
          Crear nuevo en catalogo
        </ActionButton>
      </div>
    </SheetFrame>
  )
}

function CatalogExerciseEditorSheet({
  disabled,
  item,
  onClose,
  onSave,
}: {
  disabled: boolean
  item: ExerciseCatalogItem | null
  onClose: () => void
  onSave: (input: CatalogExerciseInput) => void
}) {
  const [form, setForm] = useState(() => ({
    aliases: item?.aliases.join(', ') ?? '',
    equipment: item?.equipment ?? 'Barra',
    mainMuscle: normalizeMuscleGroup(item?.mainMuscle),
    name: item?.name ?? '',
    technicalNotes: item?.technicalNotes ?? '',
  }))

  return (
    <SheetFrame onClose={onClose} title={item ? 'Editar catalogo' : 'Crear ejercicio'}>
      <div className="space-y-3">
        <TextField label="Nombre" onChange={(value) => setForm((current) => ({ ...current, name: value }))} value={form.name} />
        <div className="grid grid-cols-2 gap-2">
          <MuscleSelect onChange={(value) => setForm((current) => ({ ...current, mainMuscle: value }))} value={form.mainMuscle} />
          <EquipmentSelect onChange={(value) => setForm((current) => ({ ...current, equipment: value }))} value={form.equipment} />
        </div>
        <TextField label="Aliases" onChange={(value) => setForm((current) => ({ ...current, aliases: value }))} value={form.aliases} />
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-arsen-muted">Indicaciones</span>
          <textarea
            className="min-h-20 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 py-2 text-sm font-semibold text-arsen-ink"
            onChange={(event) => setForm((current) => ({ ...current, technicalNotes: event.target.value }))}
            value={form.technicalNotes}
          />
        </label>
      </div>
      <ActionButton
        className="mt-4 w-full"
        disabled={disabled}
        onClick={() =>
          onSave({
            aliases: form.aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
            equipment: form.equipment,
            mainMuscle: form.mainMuscle,
            name: form.name,
            technicalNotes: form.technicalNotes,
          })
        }
        tone="acid"
      >
        <Check aria-hidden="true" className="size-5" />
        Guardar
      </ActionButton>
    </SheetFrame>
  )
}

function RoutineExerciseRecipeSheet({
  catalogItem,
  disabled,
  exercise,
  onClose,
  onSave,
}: {
  catalogItem: ExerciseCatalogItem | null
  disabled: boolean
  exercise: RoutineExercise | null
  onClose: () => void
  onSave: (input: ExerciseInput) => void
}) {
  const [form, setForm] = useState(() => exerciseToForm(exercise, catalogItem))
  const [message, setMessage] = useState<string | null>(null)
  const [warmupInfoOpen, setWarmupInfoOpen] = useState(false)
  const selectedWarmupProtocol = normalizeWarmupProtocol(form.warmupProtocol)

  function update<K extends keyof ExerciseForm>(key: K, value: ExerciseForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <SheetFrame onClose={onClose} title={exercise ? 'Editar receta' : 'Receta del dia'}>
      <div className="space-y-3">
        <Card className="grid grid-cols-[52px_1fr] items-center gap-3 p-2">
          <ExerciseArt alt={form.name} className="size-[52px]" muscle={form.mainMuscle} />
          <div className="min-w-0">
            <strong className="block truncate text-sm">{form.name}</strong>
            <span className="text-xs text-arsen-muted">
              {form.mainMuscle} - {form.equipment}
            </span>
          </div>
        </Card>
        <div className="grid grid-cols-3 gap-2">
          <TextField label="Series" onChange={(value) => update('targetSets', value)} type="number" value={form.targetSets} />
          <TextField label="Reps min" onChange={(value) => update('repsMin', value)} type="number" value={form.repsMin} />
          <TextField label="Reps max" onChange={(value) => update('repsMax', value)} type="number" value={form.repsMax} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="RIR" onChange={(value) => update('recommendedRir', value)} type="number" value={form.recommendedRir} />
          <TextField label="Descanso s" onChange={(value) => update('restSeconds', value)} type="number" value={form.restSeconds} />
        </div>
        <div className="grid grid-cols-[1fr_42px] items-end gap-2">
          <WarmupProtocolSelect onChange={(value) => update('warmupProtocol', value)} value={selectedWarmupProtocol} />
          <button
            aria-label="Ver descripcion del calentamiento"
            className="grid min-h-11 place-items-center rounded-[10px] border border-white/10 bg-arsen-surface text-arsen-purple2"
            onClick={() => setWarmupInfoOpen(true)}
            type="button"
          >
            <Info aria-hidden="true" className="size-5" />
          </button>
        </div>
        <TextField label="Progresion" onChange={(value) => update('progression', value)} value={form.progression} />
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-arsen-muted">Notas tecnicas</span>
          <textarea
            className="min-h-20 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 py-2 text-sm font-semibold text-arsen-ink"
            onChange={(event) => update('technicalNotes', event.target.value)}
            value={form.technicalNotes}
          />
        </label>
        {message ? <p className="text-xs font-bold text-red-300">{message}</p> : null}
      </div>
      <ActionButton
        className="mt-4 w-full"
        disabled={disabled}
        onClick={() => {
          const input = formToExerciseInput(form)
          if (!input) {
            setMessage('Revisa reps y RIR')
            return
          }
          onSave(input)
        }}
        tone="acid"
      >
        <Check aria-hidden="true" className="size-5" />
        Guardar receta
      </ActionButton>
      {warmupInfoOpen ? <WarmupProtocolInfoSheet onClose={() => setWarmupInfoOpen(false)} protocol={selectedWarmupProtocol} /> : null}
    </SheetFrame>
  )
}

function WarmupProtocolInfoSheet({ onClose, protocol }: { onClose: () => void; protocol: WarmupProtocol }) {
  const exampleSets = buildWarmupSets(100, protocol)
  const description = warmupProtocolDescriptions[protocol]

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-[430px] items-end bg-black/60">
      <button aria-label="Cerrar descripcion" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative w-full rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">{warmupProtocolLabel(protocol)}</h2>
            <p className="mt-1 text-xs font-semibold text-arsen-muted">Ejemplo con 100 kg de peso de trabajo.</p>
          </div>
          <button className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>
        <Card className="p-3 text-sm text-arsen-muted">{description}</Card>
        <div className="mt-3 space-y-2">
          {exampleSets.length > 0 ? (
            exampleSets.map((set, index) => (
              <Card className="grid grid-cols-[28px_1fr_1fr_1fr] items-center gap-2 p-3 text-sm" key={`${set.percentage}-${index}`}>
                <span className="grid size-6 place-items-center rounded-full border border-white/15 text-xs text-arsen-muted">{index + 1}</span>
                <strong className="text-arsen-acid">{Math.round(set.percentage * 100)}%</strong>
                <span>{set.weightKg} kg</span>
                <span>
                  {set.reps} reps / RIR {set.rir}
                </span>
              </Card>
            ))
          ) : (
            <Card className="p-3 text-sm text-arsen-muted">No genera series previas.</Card>
          )}
        </div>
      </section>
    </div>
  )
}

const warmupProtocolDescriptions: Record<WarmupProtocol, string> = {
  heavy_low_volume: 'Una aproximacion corta para ejercicios pesados cuando quieres llegar rapido al peso de trabajo sin acumular fatiga.',
  hypertrophy: 'Dos aproximaciones moderadas para preparar articulaciones y patron de movimiento antes de series de 6 a 15 repeticiones.',
  none: 'No agrega calentamientos calculados. Usalo para ejercicios muy ligeros, accesorios simples o cuando ya vienes preparado.',
  progressive: 'Sube de forma gradual y conserva repeticiones controladas. Bueno cuando quieres sentir tecnica y rango antes de trabajar fuerte.',
  strength: 'Tres aproximaciones con menos repeticiones conforme sube el peso. Sirve para cargas altas sin gastar demasiada energia.',
}

type ExerciseForm = {
  equipment: Equipment
  mainMuscle: MuscleGroup
  name: string
  progression: string
  recommendedRir: string
  repsMax: string
  repsMin: string
  restSeconds: string
  targetSets: string
  technicalNotes: string
  warmupProtocol: string
}

function exerciseToForm(exercise: RoutineExercise | null, catalogItem: ExerciseCatalogItem | null): ExerciseForm {
  return {
    equipment: exercise?.equipment ?? catalogItem?.equipment ?? 'Barra',
    mainMuscle: normalizeMuscleGroup(exercise?.mainMuscle ?? catalogItem?.mainMuscle),
    name: exercise?.name ?? catalogItem?.name ?? '',
    progression: exercise?.progression ?? '',
    recommendedRir: String(exercise?.recommendedRir ?? catalogItem?.defaultRecommendedRir ?? 2),
    repsMax: String(exercise?.repsMax ?? catalogItem?.defaultRepsMax ?? 10),
    repsMin: String(exercise?.repsMin ?? catalogItem?.defaultRepsMin ?? 8),
    restSeconds: String(exercise?.restSeconds ?? catalogItem?.defaultRestSeconds ?? 90),
    targetSets: String(exercise?.targetSets ?? catalogItem?.defaultTargetSets ?? 3),
    technicalNotes: exercise?.technicalNotes ?? catalogItem?.technicalNotes ?? '',
    warmupProtocol: normalizeWarmupProtocol(exercise?.warmupProtocol ?? ''),
  }
}

function formToExerciseInput(form: ExerciseForm): ExerciseInput | null {
  const restSeconds = numberOrDefault(form.restSeconds, 90)
  const repsMin = numberOrDefault(form.repsMin, 8)
  const repsMax = numberOrDefault(form.repsMax, 10)
  const recommendedRir = numberOrDefault(form.recommendedRir, 2)
  if (repsMin <= 0 || repsMax <= 0 || repsMin > repsMax || recommendedRir < 0) return null

  return {
    equipment: form.equipment,
    mainMuscle: form.mainMuscle,
    name: form.name,
    progression: form.progression,
    recommendedRir,
    repsMax,
    repsMin,
    rest: `${restSeconds} seg`,
    restSeconds,
    targetSets: numberOrDefault(form.targetSets, 3),
    technicalNotes: form.technicalNotes,
    warmupProtocol: normalizeWarmupProtocol(form.warmupProtocol),
    warmupSets: 0,
  }
}

function SortableList({
  children,
  ids,
  onReorder,
}: {
  children: ReactNode
  ids: string[]
  onReorder: (orderedIds: string[]) => void
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = ids.indexOf(String(active.id))
    const newIndex = ids.indexOf(String(over.id))
    if (oldIndex < 0 || newIndex < 0) return

    onReorder(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ children, id }: { children: ReactNode; id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}

function SheetFrame({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
      <button aria-label="Cerrar" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-black">{title}</h2>
          <button className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>
        {children}
      </section>
    </div>
  )
}

function SearchBox({ onChange, placeholder, value }: { onChange: (value: string) => void; placeholder: string; value: string }) {
  return (
    <Card className="grid grid-cols-[36px_1fr] items-center gap-2 p-3">
      <Search aria-hidden="true" className="size-5 text-arsen-muted" />
      <input
        className="min-h-10 bg-transparent text-sm font-semibold outline-none placeholder:text-arsen-muted"
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </Card>
  )
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

function MuscleSelect({ onChange, value }: { onChange: (value: MuscleGroup) => void; value: MuscleGroup }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-arsen-muted">Musculo</span>
      <select
        className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink"
        onChange={(event) => onChange(event.target.value as MuscleGroup)}
        value={value}
      >
        {muscleGroups.map((group) => (
          <option key={group} value={group}>
            {group}
          </option>
        ))}
      </select>
    </label>
  )
}

function EquipmentSelect({ onChange, value }: { onChange: (value: Equipment) => void; value: Equipment }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-arsen-muted">Equipo</span>
      <select
        className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink"
        onChange={(event) => onChange(event.target.value as Equipment)}
        value={value}
      >
        {equipmentOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  )
}

function WarmupProtocolSelect({ onChange, value }: { onChange: (value: WarmupProtocol) => void; value: WarmupProtocol }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-arsen-muted">Calentamiento</span>
      <select
        className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink"
        onChange={(event) => onChange(event.target.value as WarmupProtocol)}
        value={value}
      >
        {warmupProtocolOptions.map((protocol) => (
          <option key={protocol} value={protocol}>
            {warmupProtocolLabel(protocol)}
          </option>
        ))}
      </select>
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

function MenuButton({
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  disabled: boolean
  icon: typeof Check
  label: string
  onClick: () => void
}) {
  return (
    <button
      className="flex min-h-10 w-full items-center gap-2 rounded-[8px] px-3 text-left text-xs font-extrabold text-arsen-muted hover:bg-white/5 disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" className="size-4" />
      {label}
    </button>
  )
}

function filterCatalog(catalog: ExerciseCatalogItem[], query: string) {
  const value = query.trim().toLowerCase()
  if (!value) return catalog

  return catalog.filter(
    (item) =>
      item.name.toLowerCase().includes(value) ||
      item.mainMuscle.toLowerCase().includes(value) ||
      item.equipment.toLowerCase().includes(value),
  )
}

function weekdayName(weekday: RoutineDay['weekday']) {
  return weekdayOptions.find((option) => option.value === (weekday === null ? '' : String(weekday)))?.label ?? 'Sin dia fijo'
}

function numberOrDefault(value: string, fallback: number) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback
}
