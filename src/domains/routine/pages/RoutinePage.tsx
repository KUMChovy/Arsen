import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
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
  ChevronDown,
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
import { getBundledExerciseAsset } from '../../../shared/assets/exerciseImages'
import type { WeightIncreaseRecommendation } from '../../../shared/calculations/progression'
import { defaultLoadSettingsForEquipment, loadSettingsForEquipment } from '../../../shared/calculations/equipmentLoad'
import { normalizeWarmupProtocol, warmupProtocolLabel, type WarmupProtocol } from '../../../shared/calculations/warmups'
import { confirmAction, confirmDanger } from '../../../shared/utils/alerts'
import { formatRepRange } from '../../../shared/utils/reps'
import { kgToUnit, unitToKg } from '../../../shared/utils/weight'
import { useWeightIncreaseRecommendations } from '../../workout/hooks'
import type { WeightUnit } from '../../workout/types'
import { WarmupProtocolInfoSheet } from '../components/WarmupProtocolInfoSheet'
import { ExerciseImageSelector, type ExerciseImageSelection } from '../components/ExerciseImageSelector'
import { ExerciseActions } from '../components/ExerciseActions'
import { SinfulShellBrowserSheet } from '../components/SinfulShellBrowserSheet'
import { sinfulShellCatalog, type SinfulShellExercise } from '../data/sinfulShellCatalog'
import type { Equipment, ExerciseAsset, ExerciseCatalogItem, LoadMode, MuscleGroup, Routine, RoutineDay, RoutineExercise } from '../types'
import { useActiveRoutineBundle, useExerciseAssets, useExerciseCatalog, useRoutineSummaries } from '../hooks'
import { exportRoutineJson, importRoutineJson } from '../importExport'
import {
  addCatalogExerciseToDay,
  createCatalogExercise,
  createExerciseAsset,
  createDay,
  createRoutine,
  deleteCatalogExercise,
  deleteDay,
  deleteExercise,
  deleteRoutine,
  duplicateDay,
  duplicateExercise,
  duplicateRoutine,
  moveExerciseToDay,
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
import { catalogMuscleFilters, filterCatalogByQueryAndMuscle, type CatalogMuscleFilter } from '../utils/catalogFilters'
import { dominantMuscleForExercises } from '../utils/dominantMuscle'
import { muscleGroups, normalizeMuscleGroup } from '../utils/muscles'

type Mode = 'view' | 'edit' | 'catalog'
type CatalogSheetState =
  | { item: ExerciseCatalogItem | null; sourceSinfulShellExercise?: null }
  | { item: null; sourceSinfulShellExercise: SinfulShellExercise }
  | null
type RecipeSheetState =
  | { catalogItem: ExerciseCatalogItem; exercise: null; mode: 'add' }
  | { catalogItem: null; exercise: RoutineExercise; mode: 'edit' }
  | null
type SinfulShellSheetState = { mode: 'catalog' | 'routine-add' } | null

const equipmentOptions: Equipment[] = ['Barra', 'Mancuerna', 'Maquina', 'Maquina de polea', 'Peso corporal', 'Otro']
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
  const summaries = useRoutineSummaries()
  const catalog = useExerciseCatalog() ?? []
  const exerciseAssets = useExerciseAssets() ?? []
  const imageSrcByAssetId = useMemo(() => new Map(exerciseAssets.map((asset) => [asset.id, asset.dataUrl])), [exerciseAssets])
  const days = bundle?.days ?? []
  const importInputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('view')
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [catalogSheet, setCatalogSheet] = useState<CatalogSheetState>(null)
  const [recipeSheet, setRecipeSheet] = useState<RecipeSheetState>(null)
  const [catalogPickerOpen, setCatalogPickerOpen] = useState(false)
  const [sinfulShellOpen, setSinfulShellOpen] = useState<SinfulShellSheetState>(null)
  const [transitionPending, startTransition] = useTransition()
  const [actionBusy, setActionBusy] = useState(false)
  const actionPending = useRef(false)
  const isPending = transitionPending || actionBusy
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [sheetError, setSheetError] = useState<string | null>(null)

  const selectedDay = days.find((day) => day.id === selectedDayId) ?? days[0] ?? null
  const selectedExercises = selectedDay ? bundle?.exercisesByDay.get(selectedDay.id) ?? [] : []
  const recommendationByExerciseId = new Map(useWeightIncreaseRecommendations(selectedExercises).map((recommendation) => [recommendation.exerciseId, recommendation]))

  useEffect(() => {
    if (!selectedDayId && days[0]) setSelectedDayId(days[0].id)
    if (selectedDayId && !days.some((day) => day.id === selectedDayId)) setSelectedDayId(days[0]?.id ?? null)
  }, [days, selectedDayId])

  function runRoutineAction(action: () => Promise<string | void>, message: string, onSuccess?: () => void, onError?: (message: string) => void) {
    if (actionPending.current) return
    actionPending.current = true
    setActionBusy(true)
    startTransition(() => {
      action()
        .then(() => { setActionMessage(message); onSuccess?.() })
        .catch((error: unknown) => { const text = error instanceof Error ? error.message : 'Accion no completada'; if (onError) onError(text); else setActionMessage(text) })
        .finally(() => { actionPending.current = false; setActionBusy(false) })
    })
  }

  function createAndActivateRoutine() {
    runRoutineAction(async () => {
      const routineId = await createRoutine('Nueva rutina')
      await setActiveRoutine(routineId)
      return routineId
    }, 'Rutina creada y activada')
  }

  const hasNoRoutines = summaries?.length === 0

  if (summaries === undefined) return <p className="py-6 text-sm text-arsen-muted" role="status">Cargando rutinas…</p>

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Gestion de rutinas y catalogo" title="Rutina">
        <RoutineActions
          createDisabled={isPending}
          exportDisabled={isPending || !bundle}
          importDisabled={isPending}
          onCreate={createAndActivateRoutine}
          onExport={() => {
            if (bundle) void exportRoutineJson(bundle.routine.id)
          }}
          onImport={() => importInputRef.current?.click()}
        />
      </PageHeader>

      {!hasNoRoutines ? <ModeTabs mode={mode} onModeChange={setMode} /> : null}

      {actionMessage ? (
        <div className="rounded-[10px] border border-arsen-purple/40 bg-arsen-purple/15 px-3 py-2 text-xs text-arsen-purple2" role="status">
          {actionMessage}
        </div>
      ) : null}

      {!hasNoRoutines ? (
        <RoutineSwitcher
          activeRoutineId={bundle?.routine.id ?? null}
          disabled={isPending}
          onSelect={(routineId) => runRoutineAction(() => setActiveRoutine(routineId), 'Rutina activa cambiada')}
          onEdit={(routineId) => { if (routineId === bundle?.routine.id) setMode('edit'); else runRoutineAction(() => setActiveRoutine(routineId), 'Rutina activa cambiada', () => setMode('edit')) }}
          onDuplicate={(routineId) => runRoutineAction(() => duplicateRoutine(routineId), 'Rutina duplicada')}
          onDelete={async (routineId) => { if (await confirmDanger('Eliminar rutina', 'El historial se conserva.')) runRoutineAction(() => deleteRoutine(routineId), 'Rutina eliminada') }}
          summaries={summaries ?? []}
        />
      ) : null}

      {!hasNoRoutines ? (
        <ActionButton className="w-full" disabled={isPending} onClick={createAndActivateRoutine} type="button">
          <PlusCircle aria-hidden="true" className="size-5" />
          Crear rutina
        </ActionButton>
      ) : null}

      {hasNoRoutines ? <EmptyRoutineState disabled={isPending} onCreate={createAndActivateRoutine} /> : null}

      {mode === 'view' && !hasNoRoutines ? (
        <RoutineView
          bundle={bundle}
          days={days}
          onSelectDay={(dayId) => navigate(`/rutina/dia/${dayId}`)}
          onViewHistory={() => { if (bundle) navigate(`/historial?modo=list&rutina=${encodeURIComponent(bundle.routine.id)}`) }}
          onOrganize={() => setMode('edit')}
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
          onMoveExercise={(exerciseId, dayId) => runRoutineAction(() => moveExerciseToDay(exerciseId, dayId), 'Ejercicio movido')}
          onRenameRoutine={(name) => runRoutineAction(() => renameRoutine(bundle.routine.id, name), 'Rutina renombrada')}
          onReorderDays={(orderedIds) => runRoutineAction(() => reorderDays(bundle.routine.id, orderedIds), 'Dias reordenados')}
          onReorderExercises={(orderedIds) => {
            if (!selectedDay) return
            runRoutineAction(() => reorderExercises(selectedDay.id, orderedIds), 'Ejercicios reordenados')
          }}
          onSelectDay={setSelectedDayId}
          onUpdateDay={(dayId, input) => runRoutineAction(() => updateDay(dayId, input), 'Dia guardado', () => { try { window.sessionStorage.removeItem(`arsen:day-draft:${dayId}`) } catch { /* Storage can be unavailable. */ } })}
          imageSrcByAssetId={imageSrcByAssetId}
          recommendationByExerciseId={recommendationByExerciseId}
          routine={bundle.routine}
          selectedDay={selectedDay}
        />
      ) : null}

      {mode === 'catalog' ? (
        <CatalogPanel
          catalog={catalog}
          disabled={isPending}
          imageSrcByAssetId={imageSrcByAssetId}
          onCreate={() => setCatalogSheet({ item: null })}
          onDelete={async (catalogItemId) => {
            if (!(await confirmDanger('Eliminar del catalogo', 'Las rutinas existentes no se borran.'))) return
            runRoutineAction(() => deleteCatalogExercise(catalogItemId), 'Ejercicio eliminado del catalogo')
          }}
          onEdit={(item) => setCatalogSheet({ item })}
          onOpenSinfulShell={() => setSinfulShellOpen({ mode: 'catalog' })}
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
          imageSrcByAssetId={imageSrcByAssetId}
          onClose={() => setCatalogPickerOpen(false)}
          onCreateCatalog={() => setCatalogSheet({ item: null })}
          onOpenSinfulShell={() => setSinfulShellOpen({ mode: 'routine-add' })}
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
          displayUnit={bundle?.settings.preferredUnit ?? 'kg'}
          assets={exerciseAssets}
          item={catalogSheet.item}
          saveError={sheetError}
          onClose={() => { setSheetError(null); setCatalogSheet(null) }}
          onSave={(input) => {
            const action = catalogSheet.item
              ? () => updateCatalogExercise(catalogSheet.item!.id, input)
              : () => createCatalogExercise(input)
            setSheetError(null)
            runRoutineAction(action, catalogSheet.item ? 'Ejercicio de catalogo guardado' : 'Ejercicio creado en catalogo', () => setCatalogSheet(null), setSheetError)
          }}
          sourceSinfulShellExercise={catalogSheet.sourceSinfulShellExercise ?? null}
        />
      ) : null}

      {sinfulShellOpen ? (
        <SinfulShellBrowserSheet
          catalog={catalog}
          disabled={isPending}
          mode={sinfulShellOpen.mode}
          onAddCopy={(exercise) => {
            setSinfulShellOpen(null)
            setCatalogPickerOpen(false)
            setCatalogSheet({ item: null, sourceSinfulShellExercise: exercise })
          }}
          onAddCopyToRoutine={(item) => {
            setSinfulShellOpen(null)
            setCatalogPickerOpen(false)
            setRecipeSheet({ catalogItem: item, exercise: null, mode: 'add' })
          }}
          onClose={() => setSinfulShellOpen(null)}
          onViewCatalogCopy={(item) => {
            setSinfulShellOpen(null)
            setCatalogSheet({ item })
          }}
        />
      ) : null}

      {recipeSheet && selectedDay && bundle ? (
        <RoutineExerciseRecipeSheet
          catalogItem={recipeSheet.catalogItem}
          disabled={isPending}
          displayUnit={bundle.settings.preferredUnit}
          exercise={recipeSheet.exercise}
          imageSrcByAssetId={imageSrcByAssetId}
          saveError={sheetError}
          onClose={() => { setSheetError(null); setRecipeSheet(null) }}
          onSave={(input) => {
            const action =
              recipeSheet.mode === 'edit' && recipeSheet.exercise
                ? () => updateExercise(recipeSheet.exercise!.id, input)
                : () => addCatalogExerciseToDay(bundle.routine.id, selectedDay.id, recipeSheet.catalogItem!.id, input)
            setSheetError(null)
            runRoutineAction(action, recipeSheet.mode === 'edit' ? 'Receta guardada' : 'Ejercicio agregado al dia', () => setRecipeSheet(null), setSheetError)
          }}
        />
      ) : null}
    </div>
  )
}

function RoutineActions({
  createDisabled,
  exportDisabled,
  importDisabled,
  onCreate,
  onExport,
  onImport,
}: {
  createDisabled: boolean
  exportDisabled: boolean
  importDisabled: boolean
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
        <MenuButton disabled={createDisabled} icon={PlusCircle} label="Crear rutina" onClick={onCreate} />
        <MenuButton disabled={importDisabled} icon={UploadCloud} label="Importar JSON" onClick={onImport} />
        <MenuButton disabled={exportDisabled} icon={Download} label="Exportar JSON" onClick={onExport} />
      </div>
    </details>
  )
}

function EmptyRoutineState({ disabled, onCreate }: { disabled: boolean; onCreate: () => void }) {
  return (
    <Card className="space-y-4 p-4 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-[12px] bg-arsen-purple/25 text-arsen-purple2">
        <CalendarPlus aria-hidden="true" className="size-6" />
      </div>
      <div>
        <h2 className="text-xl font-black">Crea tu primera rutina</h2>
        <p className="mt-1 text-sm font-semibold text-arsen-muted">Empieza con una rutina vacia y agrega dias cuando quieras entrenar.</p>
      </div>
      <ActionButton className="w-full" disabled={disabled} onClick={onCreate} tone="acid" type="button">
        <PlusCircle aria-hidden="true" className="size-5" />
        Crear rutina
      </ActionButton>
    </Card>
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
  onEdit,
  onDuplicate,
  onDelete,
  summaries,
}: {
  activeRoutineId: string | null
  disabled: boolean
  onSelect: (routineId: string) => void
  onEdit: (routineId: string) => void
  onDuplicate: (routineId: string) => void
  onDelete: (routineId: string) => void
  summaries: NonNullable<ReturnType<typeof useRoutineSummaries>>
}) {
  return (
    <section>
      <div className="mb-2 text-xs font-extrabold text-arsen-muted">Rutinas guardadas</div>
      <div className="space-y-2">
        {summaries.map(({ routine, days, exerciseCount }) => (
          <details className={`rounded-[12px] border bg-arsen-surface ${routine.id === activeRoutineId ? 'border-arsen-purple/60' : 'border-white/10'}`} key={routine.id}>
            <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-3 p-3">
              <span className="min-w-0"><strong className="block truncate text-sm">{routine.name}</strong><span className="mt-1 block text-xs text-arsen-muted">{days.length} {days.length === 1 ? 'día' : 'días'} · {exerciseCount} ejercicios</span></span>
              <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-bold ${routine.id === activeRoutineId ? 'bg-arsen-acid/15 text-arsen-acid' : 'bg-white/5 text-arsen-muted'}`}>{routine.id === activeRoutineId ? 'Activa' : 'Inactiva'}</span>
            </summary>
            <div className="space-y-2 border-t border-white/10 p-3">
              <p className="text-sm text-arsen-muted">{days.length ? days.map((day) => day.name).join(' · ') : 'Aún no tiene días configurados.'}</p>
              <div className="flex flex-wrap gap-2">
                {routine.id !== activeRoutineId ? <button aria-label={`Activar ${routine.name}`} className="min-h-11 rounded-[10px] bg-arsen-purple/30 px-3 text-sm font-bold" disabled={disabled} onClick={() => onSelect(routine.id)} type="button">Activar</button> : null}
                <button aria-label={`Editar ${routine.name}`} className="min-h-11 rounded-[10px] border border-white/10 px-3 text-sm font-bold" disabled={disabled} onClick={() => onEdit(routine.id)} type="button">{routine.id === activeRoutineId ? 'Editar' : 'Activar y editar'}</button>
                <button aria-label={`Duplicar ${routine.name}`} className="min-h-11 rounded-[10px] border border-white/10 px-3 text-sm font-bold" disabled={disabled} onClick={() => onDuplicate(routine.id)} type="button">Duplicar</button>
                <button aria-label={`Eliminar ${routine.name}`} className="min-h-11 rounded-[10px] border border-white/10 px-3 text-sm font-bold text-red-300" disabled={disabled} onClick={() => onDelete(routine.id)} type="button">Eliminar</button>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}

function RoutineView({
  bundle,
  days,
  onSelectDay,
  onViewHistory,
  onOrganize,
}: {
  bundle: ReturnType<typeof useActiveRoutineBundle>
  days: RoutineDay[]
  onSelectDay: (dayId: string) => void
  onViewHistory: () => void
  onOrganize: () => void
}) {
  return (
    <>
      <button className="min-h-11 w-full rounded-[10px] border border-white/10 px-3 text-sm font-bold text-arsen-purple2" disabled={!bundle} onClick={onViewHistory} type="button">Ver historial de esta rutina</button>

      <section>
        <div className="mb-2 text-xs font-extrabold text-arsen-muted">Dias de entrenamiento</div>
        {bundle && days.length === 0 ? <div className="rounded-[12px] border border-white/10 bg-arsen-surface p-4"><p className="text-sm font-bold">Esta rutina aún no tiene días.</p><p className="mt-1 text-sm text-arsen-muted">Crea un día para organizar tus ejercicios.</p><button className="mt-3 min-h-11 rounded-[10px] bg-arsen-purple/30 px-3 text-sm font-bold" onClick={onOrganize} type="button">Organizar días</button></div> : null}
        <div className="space-y-3">
          {days.map((day) => {
            const dayExercises = bundle?.exercisesByDay.get(day.id) ?? []
            const dominantMuscle = dominantMuscleForExercises(dayExercises)

            return (
              <button className="block w-full text-left" key={day.id} onClick={() => onSelectDay(day.id)} type="button">
                <Card className="content-auto grid grid-cols-[minmax(0,1fr)_78px] items-center gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-2xl font-black">{day.name}</h2>
                      <span className="text-xs font-extrabold text-arsen-acid">{dayExercises.length} ejercicios</span>
                    </div>
                    <p className="font-extrabold text-arsen-purple2">{dominantMuscle}</p>
                    <p className="mt-1 text-sm text-arsen-muted">{day.description || 'Sin descripcion'}</p>
                  </div>
                  <ExerciseArt alt={day.name} className="size-[74px] justify-self-center" muscle={dominantMuscle} />
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
  onMoveExercise,
  onRenameRoutine,
  onReorderDays,
  onReorderExercises,
  onSelectDay,
  onUpdateDay,
  imageSrcByAssetId,
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
  onMoveExercise: (exerciseId: string, dayId: string) => void
  onRenameRoutine: (name: string) => void
  onReorderDays: (orderedIds: string[]) => void
  onReorderExercises: (orderedIds: string[]) => void
  onSelectDay: (dayId: string) => void
  onUpdateDay: (dayId: string, input: { description: string; name: string; weekday: RoutineDay['weekday'] }) => void
  imageSrcByAssetId: Map<string, string>
  recommendationByExerciseId: Map<string, WeightIncreaseRecommendation>
  routine: Routine
  selectedDay: RoutineDay | null
}) {
  const [routineName, setRoutineName] = useState(routine.name)

  useEffect(() => setRoutineName(routine.name), [routine.name])

  return (
    <>
      <Card className="p-3">
        <details>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold"><span>Ajustes de rutina</span><ChevronDown aria-hidden="true" className="size-5 text-arsen-purple2" /></summary>
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
        </details>
      </Card>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-extrabold text-arsen-muted">Dias</span>
          <button className="text-xs font-extrabold text-arsen-acid" disabled={disabled} onClick={onCreateDay} type="button">
            + Crear dia
          </button>
        </div>
        <div aria-label="Seleccionar día" className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {days.map((day) => <button aria-pressed={day.id === selectedDay?.id} className={`min-h-11 max-w-40 shrink-0 truncate rounded-[10px] border px-3 text-sm font-bold ${day.id === selectedDay?.id ? 'border-arsen-purple2 bg-arsen-purple/30 text-arsen-ink' : 'border-white/10 bg-arsen-surface text-arsen-muted'}`} disabled={disabled} key={day.id} onClick={() => onSelectDay(day.id)} type="button">{day.name}</button>)}
        </div>
        {days.length ? <details className="mt-2 rounded-[10px] border border-white/10 bg-arsen-surface">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-3 text-xs font-bold text-arsen-muted"><span>Reordenar días</span><ChevronDown aria-hidden="true" className="size-4 text-arsen-purple2" /></summary>
        <SortableList ids={days.map((day) => day.id)} onReorder={onReorderDays}>
          <div className="space-y-2">
            {days.map((day) => (
              <SortableRow id={day.id} key={day.id}>
                <div className="flex items-center gap-1">
                <DragHandle label={`Reordenar ${day.name}`} />
                <button
                  className={[
                    'grid min-h-12 w-full grid-cols-[1fr_auto] items-center gap-2 rounded-[10px] border px-3 text-left text-xs font-extrabold',
                    day.id === selectedDay?.id ? 'border-arsen-purple2 bg-arsen-purple/40 text-white' : 'border-white/10 bg-arsen-surface text-arsen-muted',
                  ].join(' ')}
                  onClick={() => onSelectDay(day.id)}
                  type="button"
                >
                  {day.name}
                  <span>{weekdayName(day.weekday)}</span>
                </button>
                </div>
              </SortableRow>
            ))}
          </div>
        </SortableList>
        </details> : null}
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
            {exercises.map((exercise, index) => (
              <SortableRow id={exercise.id} key={exercise.id}>
                <ExerciseEditRow
                  disabled={disabled}
                  exercise={exercise}
                  imageSrcByAssetId={imageSrcByAssetId}
                  onDelete={() => onDeleteExercise(exercise.id)}
                  onDuplicate={() => onDuplicateExercise(exercise.id)}
                  onEdit={() => onEditExercise(exercise)}
                  days={days.filter((day) => day.id !== selectedDay?.id)}
                  canMoveUp={index > 0}
                  canMoveDown={index < exercises.length - 1}
                  onMove={(dayId) => onMoveExercise(exercise.id, dayId)}
                  onReorder={(direction) => onReorderExercises(arrayMove(exercises.map((item) => item.id), index, index + (direction === 'up' ? -1 : 1)))}
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
  const [draft, setDraft] = useState(() => readDayDraft(day))
  const [draftError, setDraftError] = useState(false)

  useEffect(() => {
    setDraft(readDayDraft(day))
  }, [day])

  function updateDraft(change: Partial<typeof draft>) {
    const next = { ...draft, ...change }
    setDraft(next)
    try { window.sessionStorage.setItem(`arsen:day-draft:${day.id}`, JSON.stringify(next)); setDraftError(false) } catch { setDraftError(true) }
  }

  return (
    <Card className="p-3">
      <details>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold text-arsen-ink"><span>Ajustes del día</span><ChevronDown aria-hidden="true" className="size-5 text-arsen-purple2" /></summary>
      <div className="grid grid-cols-[1fr_118px] gap-2">
        <TextField disabled={disabled} label="Nombre del dia" onChange={(name) => updateDraft({ name })} value={draft.name} />
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-arsen-muted">Semana</span>
          <select
            className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-sm font-extrabold text-arsen-ink"
            disabled={disabled}
            onChange={(event) => updateDraft({ weekday: event.target.value })}
            value={draft.weekday}
          >
            {weekdayOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <TextField disabled={disabled} label="Descripcion" onChange={(description) => updateDraft({ description })} value={draft.description} />
      {draftError ? <p className="text-sm text-red-300" role="alert">No se pudo conservar el borrador; guarda antes de cambiar de día.</p> : null}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <IconButton disabled={disabled} icon={Check} label="Guardar" onClick={() => onSave({ description: draft.description, name: draft.name, weekday: draft.weekday === '' ? null : (Number(draft.weekday) as RoutineDay['weekday']) })} />
        <IconButton disabled={disabled} icon={Copy} label="Copiar" onClick={onDuplicate} />
        <IconButton danger disabled={disabled} icon={Trash2} label="Borrar" onClick={onDelete} />
      </div>
      </details>
    </Card>
  )
}

function readDayDraft(day: RoutineDay) {
  const fallback = { name: day.name, description: day.description, weekday: day.weekday === null ? '' : String(day.weekday) }
  try {
    const stored = window.sessionStorage.getItem(`arsen:day-draft:${day.id}`)
    if (!stored) return fallback
    const value: unknown = JSON.parse(stored)
    if (typeof value !== 'object' || value === null) return fallback
    const draft = value as Record<string, unknown>
    if (typeof draft.name !== 'string' || typeof draft.description !== 'string' || typeof draft.weekday !== 'string' || !weekdayOptions.some((option) => option.value === draft.weekday)) return fallback
    return { name: draft.name, description: draft.description, weekday: draft.weekday }
  } catch { return fallback }
}

function ExerciseEditRow({
  canMoveDown,
  canMoveUp,
  days,
  disabled,
  exercise,
  imageSrcByAssetId,
  onDelete,
  onDuplicate,
  onEdit,
  onMove,
  onReorder,
  recommendation,
}: {
  canMoveDown: boolean
  canMoveUp: boolean
  days: RoutineDay[]
  disabled: boolean
  exercise: RoutineExercise
  imageSrcByAssetId: Map<string, string>
  onDelete: () => void
  onDuplicate: () => void
  onEdit: () => void
  onMove: (dayId: string) => void
  onReorder: (direction: 'up' | 'down') => void
  recommendation: WeightIncreaseRecommendation | null
}) {
  return (
    <Card className="grid grid-cols-[44px_48px_minmax(0,1fr)_44px] items-center gap-x-2 gap-y-1 p-2">
      <DragHandle label={`Reordenar ${exercise.name}`} />
      <ExerciseArt
        alt={exercise.name}
        bundledAssetId={exercise.bundledAssetId}
        className="size-12"
        customImageSrc={exercise.customAssetId ? imageSrcByAssetId.get(exercise.customAssetId) : null}
        muscle={exercise.mainMuscle}
      />
      <div className="min-w-0">
        <h3 className="truncate text-sm font-extrabold">{exercise.name}</h3>
        <span className="mt-1 block truncate text-xs text-arsen-muted">
          {exercise.mainMuscle} - {exercise.targetSets}x{formatRepRange(exercise.repsMin, exercise.repsMax)} - RIR {exercise.recommendedRir}
        </span>
        {recommendation ? (
          <span className="mt-1 flex max-w-full items-center gap-1 text-xs font-extrabold text-arsen-acid">
            <TrendingUp aria-hidden="true" className="size-3 shrink-0" />
            <span className="truncate">Subir peso: {recommendation.suggestedIncreaseLabel}</span>
          </span>
        ) : null}
      </div>
      <ExerciseActions canMoveDown={canMoveDown} canMoveUp={canMoveUp} days={days} disabled={disabled} exerciseName={exercise.name} onDelete={onDelete} onDuplicate={onDuplicate} onEdit={onEdit} onMove={onMove} onReorder={onReorder} />
    </Card>
  )
}

function CatalogPanel({
  catalog,
  disabled,
  imageSrcByAssetId,
  onCreate,
  onDelete,
  onEdit,
  onOpenSinfulShell,
}: {
  catalog: ExerciseCatalogItem[]
  disabled: boolean
  imageSrcByAssetId: Map<string, string>
  onCreate: () => void
  onDelete: (catalogItemId: string) => void
  onEdit: (item: ExerciseCatalogItem) => void
  onOpenSinfulShell: () => void
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => filterCatalog(catalog, query), [catalog, query])

  return (
    <section className="space-y-3">
      <button
        className="grid w-full grid-cols-[minmax(0,1fr)_42px] items-center gap-3 rounded-[12px] border border-arsen-purple/30 bg-arsen-purple/10 p-3 text-left transition hover:border-arsen-purple/50 disabled:opacity-40"
        disabled={disabled}
        onClick={onOpenSinfulShell}
        type="button"
      >
        <span className="min-w-0">
          <strong className="block truncate text-sm text-arsen-ink">Explorar Sinful Shell</strong>
          <span className="mt-1 block truncate text-xs font-semibold text-arsen-muted">{sinfulShellCatalog.length} ejercicios incluidos</span>
        </span>
        <span className="grid size-10 place-items-center rounded-[10px] bg-arsen-purple/20 text-arsen-purple2">
          <ListPlus aria-hidden="true" className="size-5" />
        </span>
      </button>
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
          <Card className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-4 p-2" key={item.id}>
            <ExerciseArt
              alt={item.name}
              bundledAssetId={item.bundledAssetId}
              className="size-[52px]"
              customImageSrc={item.customAssetId ? imageSrcByAssetId.get(item.customAssetId) : null}
              muscle={item.mainMuscle}
            />
            <div className="min-w-0">
              <h3 className="truncate text-sm font-extrabold">{item.name}</h3>
              <span className="mt-1 block truncate text-xs text-arsen-muted">
                {normalizeMuscleGroup(item.mainMuscle)} - {item.equipment}
              </span>
              <span className="mt-1 block truncate text-xs font-bold text-arsen-purple2">
                Calentamiento: {warmupProtocolLabel(normalizeWarmupProtocol(item.warmupProtocol))}
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
  imageSrcByAssetId,
  onClose,
  onCreateCatalog,
  onOpenSinfulShell,
  onSelect,
  selectedDay,
}: {
  catalog: ExerciseCatalogItem[]
  imageSrcByAssetId: Map<string, string>
  onClose: () => void
  onCreateCatalog: () => void
  onOpenSinfulShell: () => void
  onSelect: (item: ExerciseCatalogItem) => void
  selectedDay: RoutineDay
}) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<CatalogMuscleFilter>('Todos')
  const filtered = useMemo(() => filterCatalogByQueryAndMuscle(catalog, query, muscle), [catalog, query, muscle])

  return (
    <SheetFrame onClose={onClose} title={`Agregar a ${selectedDay.name}`}>
      <div className="mb-3 grid gap-2">
        <ActionButton className="w-full" onClick={onOpenSinfulShell} tone="acid">
          <ListPlus aria-hidden="true" className="size-5" />
          Agregar desde Sinful Shell
        </ActionButton>
        <ActionButton className="w-full" onClick={onCreateCatalog} tone="ghost">
          <PlusCircle aria-hidden="true" className="size-5" />
          Crear ejercicio propio
        </ActionButton>
      </div>
      <SearchBox onChange={setQuery} placeholder="Buscar ejercicio" value={query} />
      <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
        {catalogMuscleFilters.map((option) => (
          <button
            aria-pressed={muscle === option}
            className={[
              'min-h-10 shrink-0 rounded-full border px-3 text-xs font-extrabold transition',
              muscle === option ? 'border-arsen-purple2 bg-arsen-purple/40 text-white' : 'border-white/10 bg-arsen-surface text-arsen-muted',
            ].join(' ')}
            key={option}
            onClick={() => setMuscle(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
      <div className="mt-2 text-xs font-extrabold text-arsen-muted">{formatExerciseCount(filtered.length)}</div>
      <div className="mt-3 space-y-2">
        {filtered.map((item) => (
          <button className="block w-full text-left" key={item.id} onClick={() => onSelect(item)} type="button">
            <Card className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-4 p-2">
              <ExerciseArt
                alt={item.name}
                bundledAssetId={item.bundledAssetId}
                className="size-[52px]"
                customImageSrc={item.customAssetId ? imageSrcByAssetId.get(item.customAssetId) : null}
                muscle={item.mainMuscle}
              />
              <div className="min-w-0">
                <h3 className="truncate text-sm font-extrabold">{item.name}</h3>
                <span className="mt-1 block truncate text-xs text-arsen-muted">
                  {normalizeMuscleGroup(item.mainMuscle)} - {item.equipment}
                </span>
                <span className="mt-1 block truncate text-xs font-bold text-arsen-purple2">
                  {warmupProtocolLabel(normalizeWarmupProtocol(item.warmupProtocol))}
                </span>
              </div>
              <ListPlus aria-hidden="true" className="size-5 text-arsen-purple2" />
            </Card>
          </button>
        ))}
        {filtered.length === 0 ? (
          <CatalogPickerEmptyState
            muscle={muscle}
            onClear={() => {
              setMuscle('Todos')
              setQuery('')
            }}
            query={query}
          />
        ) : null}
      </div>
    </SheetFrame>
  )
}

function CatalogPickerEmptyState({
  muscle,
  onClear,
  query,
}: {
  muscle: CatalogMuscleFilter
  onClear: () => void
  query: string
}) {
  return (
    <div className="rounded-[12px] border border-white/10 bg-arsen-surface p-4">
      <p className="text-sm font-semibold text-arsen-muted">{catalogPickerEmptyMessage(muscle, query)}</p>
      <button className="mt-3 min-h-10 rounded-[10px] border border-arsen-purple/40 px-3 text-xs font-extrabold text-arsen-purple2" onClick={onClear} type="button">
        Limpiar filtros
      </button>
    </div>
  )
}

function CatalogExerciseEditorSheet({
  assets,
  disabled,
  displayUnit,
  item,
  onClose,
  onSave,
  saveError,
  sourceSinfulShellExercise,
}: {
  assets: ExerciseAsset[]
  disabled: boolean
  displayUnit: WeightUnit
  item: ExerciseCatalogItem | null
  onClose: () => void
  onSave: (input: CatalogExerciseInput) => void
  saveError: string | null
  sourceSinfulShellExercise: SinfulShellExercise | null
}) {
  const [form, setForm] = useState(() => catalogItemToForm(item, displayUnit, sourceSinfulShellExercise))
  const initialForm = useRef(JSON.stringify(form))
  const requestClose = useUnsavedClose(JSON.stringify(form) !== initialForm.current, disabled, onClose)
  const [imageError, setImageError] = useState<string | null>(null)
  const [imageSheetOpen, setImageSheetOpen] = useState(false)
  const [isImageUploadPending, setIsImageUploadPending] = useState(false)
  const [progressionInfoOpen, setProgressionInfoOpen] = useState(false)
  const [warmupInfoOpen, setWarmupInfoOpen] = useState(false)
  const uploadRequestId = useRef(0)
  const selectedWarmupProtocol = normalizeWarmupProtocol(form.warmupProtocol)
  const maxImageBytes = 2 * 1024 * 1024
  const selectedAsset = form.customAssetId ? assets.find((asset) => asset.id === form.customAssetId) ?? null : null
  const selectedBundledAsset = getBundledExerciseAsset(form.bundledAssetId)
  const isSinfulShellLocked = Boolean(sourceSinfulShellExercise || item?.sinfulShellContentLocked)
  const selectedImageLabel = isSinfulShellLocked ? 'Sinful Shell' : selectedAsset?.name ?? selectedBundledAsset?.name ?? 'Auto'
  const sheetTitle = sourceSinfulShellExercise ? 'Agregar a mi catalogo' : item ? 'Editar catalogo' : 'Crear ejercicio'

  async function uploadCustomImage(file: File) {
    const requestId = ++uploadRequestId.current
    setImageError(null)
    if (!file.type.startsWith('image/')) {
      setImageError('Sube un archivo de imagen.')
      return
    }
    if (file.size > maxImageBytes) {
      setImageError('Usa una imagen de hasta 2 MB.')
      return
    }
    setIsImageUploadPending(true)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      const customAssetId = await createExerciseAsset({
        dataUrl,
        mimeType: file.type,
        name: file.name,
      })
      if (requestId === uploadRequestId.current) setForm((current) => ({ ...current, bundledAssetId: null, customAssetId }))
    } catch (error: unknown) {
      if (requestId === uploadRequestId.current) {
        setImageError(error instanceof Error ? error.message : 'No se pudo cargar la imagen')
      }
    } finally {
      if (requestId === uploadRequestId.current) setIsImageUploadPending(false)
    }
  }

  function updateImageSelection(selection: ExerciseImageSelection) {
    uploadRequestId.current += 1
    setIsImageUploadPending(false)
    setForm((current) => ({ ...current, ...selection }))
    setImageSheetOpen(false)
  }

  return (
    <SheetFrame onClose={requestClose} title={sheetTitle}>
      <div className="space-y-3">
        {isSinfulShellLocked ? (
          <>
            <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 rounded-[12px] border border-white/10 bg-arsen-surface p-3">
              <ExerciseArt
                alt={form.name || 'Imagen del ejercicio'}
                bundledAssetId={form.bundledAssetId}
                className="size-16"
                customImageSrc={null}
                muscle={form.mainMuscle}
              />
              <div className="min-w-0">
                <h3 className="truncate text-sm font-black text-arsen-ink">{form.name}</h3>
                <p className="mt-1 truncate text-xs font-semibold text-arsen-muted">{form.mainMuscle}</p>
              </div>
            </div>
            <div className="rounded-[12px] border border-arsen-purple/30 bg-arsen-purple/10 p-3">
              <p className="text-xs font-extrabold leading-relaxed text-arsen-ink">{form.technicalNotes}</p>
            </div>
            <EquipmentSelect onChange={(value) => setForm((current) => applyEquipmentDefaults(current, value, displayUnit))} value={form.equipment} />
            <LoadSettingsFields
              barWeight={form.barWeight}
              displayUnit={displayUnit}
              equipment={form.equipment}
              loadMode={form.loadMode}
              onChange={(value) => setForm((current) => ({ ...current, ...value }))}
            />
            <TextField label="Aliases" onChange={(value) => setForm((current) => ({ ...current, aliases: value }))} value={form.aliases} />
            <WarmupProtocolSelect
              onChange={(value) => setForm((current) => ({ ...current, warmupProtocol: value }))}
              value={selectedWarmupProtocol}
            />
          </>
        ) : (
          <>
            <TextField
              label="Nombre"
              onChange={(value) => setForm((current) => ({ ...current, name: value }))}
              value={form.name}
            />
            <div className="grid grid-cols-2 gap-2">
              <MuscleSelect
                onChange={(value) => setForm((current) => ({ ...current, mainMuscle: value }))}
                value={form.mainMuscle}
              />
              <EquipmentSelect onChange={(value) => setForm((current) => applyEquipmentDefaults(current, value, displayUnit))} value={form.equipment} />
            </div>
            <LoadSettingsFields
              barWeight={form.barWeight}
              displayUnit={displayUnit}
              equipment={form.equipment}
              loadMode={form.loadMode}
              onChange={(value) => setForm((current) => ({ ...current, ...value }))}
            />
            <button
              aria-label="Ver explicacion de progresion doble"
              className="grid min-h-16 w-full grid-cols-[36px_1fr_28px] items-center gap-3 rounded-[12px] border border-arsen-acid/30 bg-arsen-acid/10 p-3 text-left transition hover:border-arsen-acid/60 hover:bg-arsen-acid/15"
              onClick={() => setProgressionInfoOpen(true)}
              type="button"
            >
              <span className="grid size-9 place-items-center rounded-[10px] bg-arsen-acid/15 text-arsen-acid">
                <TrendingUp aria-hidden="true" className="size-5" />
              </span>
              <span className="min-w-0">
                <strong className="block text-sm text-arsen-acid">Progresion doble</strong>
                <span className="mt-1 block text-xs font-semibold text-arsen-muted">
                  Arsen siempre usa esta regla para recomendar cuando subir peso.
                </span>
              </span>
              <Info aria-hidden="true" className="size-5 text-arsen-purple2" />
            </button>
            <div className="grid grid-cols-[1fr_42px] items-end gap-2">
              <WarmupProtocolSelect
                onChange={(value) => setForm((current) => ({ ...current, warmupProtocol: value }))}
                value={selectedWarmupProtocol}
              />
              <button
                aria-label="Ver descripcion del calentamiento"
                className="grid min-h-11 place-items-center rounded-[10px] border border-white/10 bg-arsen-surface text-arsen-purple2"
                onClick={() => setWarmupInfoOpen(true)}
                type="button"
              >
                <Info aria-hidden="true" className="size-5" />
              </button>
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
            <button
              className="grid min-h-16 w-full grid-cols-[52px_minmax(0,1fr)] items-center gap-4 rounded-[12px] border border-white/10 bg-arsen-surface p-2 text-left transition hover:border-arsen-purple/45 disabled:opacity-50"
              disabled={disabled || isImageUploadPending}
              onClick={() => setImageSheetOpen(true)}
              type="button"
            >
              <ExerciseArt
                alt={form.name || 'Imagen del ejercicio'}
                bundledAssetId={form.bundledAssetId}
                className="size-[52px]"
                customImageSrc={selectedAsset?.dataUrl ?? null}
                muscle={form.mainMuscle}
              />
              <span className="min-w-0">
                <span className="block text-xs font-bold text-arsen-muted">Imagen del ejercicio</span>
                <strong className="mt-1 block truncate text-sm text-arsen-ink">{selectedImageLabel}</strong>
              </span>
            </button>
          </>
        )}
      </div>
      {saveError ? <p className="mt-3 text-sm text-red-300" role="alert">{saveError}</p> : null}
      <ActionButton
        className="mt-4 w-full"
        disabled={disabled || isImageUploadPending}
        onClick={() =>
          onSave({
            aliases: form.aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
            assetKind: null,
            bundledAssetId: isSinfulShellLocked ? sourceSinfulShellExercise?.bundledAssetId ?? item?.bundledAssetId ?? null : form.bundledAssetId,
            customAssetId: isSinfulShellLocked ? null : form.customAssetId,
            ...loadInputFromForm(form, displayUnit),
            mainMuscle: form.mainMuscle,
            mode: sourceSinfulShellExercise ? 'create-from-sinful-shell' : 'manual',
            name: form.name,
            sinfulShellId: sourceSinfulShellExercise?.id ?? item?.sinfulShellId ?? null,
            technicalNotes: form.technicalNotes,
            warmupProtocol: selectedWarmupProtocol,
          })
        }
        tone="acid"
      >
        <Check aria-hidden="true" className="size-5" />
        Guardar
      </ActionButton>
      {imageSheetOpen && !isSinfulShellLocked ? (
        <ExerciseImageSelector
          assets={assets}
          disabled={disabled || isImageUploadPending}
          error={imageError}
          mainMuscle={form.mainMuscle}
          onChange={updateImageSelection}
          onClose={() => setImageSheetOpen(false)}
          onUpload={uploadCustomImage}
          selection={{ bundledAssetId: form.bundledAssetId, customAssetId: form.customAssetId }}
        />
      ) : null}
      {progressionInfoOpen ? <DoubleProgressionInfoSheet onClose={() => setProgressionInfoOpen(false)} /> : null}
      {warmupInfoOpen ? <WarmupProtocolInfoSheet onClose={() => setWarmupInfoOpen(false)} protocol={selectedWarmupProtocol} /> : null}
    </SheetFrame>
  )
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')))
    reader.addEventListener('error', () => reject(new Error('No se pudo leer la imagen')))
    reader.readAsDataURL(file)
  })
}

function DoubleProgressionInfoSheet({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-[430px] items-end bg-black/60">
      <button aria-label="Cerrar explicacion de progresion doble" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative w-full rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-3 grid size-12 place-items-center rounded-[12px] bg-arsen-acid/15 text-arsen-acid">
              <TrendingUp aria-hidden="true" className="size-6" />
            </div>
            <h2 className="text-xl font-black">Progresion doble</h2>
            <p className="mt-1 text-xs font-semibold text-arsen-muted">La unica estrategia de Arsen para decidir cuando subir peso.</p>
          </div>
          <button className="grid size-9 shrink-0 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>
        <div className="space-y-2">
          <Card className="grid grid-cols-[28px_1fr] gap-3 p-3">
            <span className="grid size-7 place-items-center rounded-full border border-arsen-acid/30 text-xs font-black text-arsen-acid">1</span>
            <p className="text-sm font-semibold text-arsen-muted">
              Mantienes el mismo peso y buscas subir repeticiones dentro del rango, por ejemplo 8 a 12 reps.
            </p>
          </Card>
          <Card className="grid grid-cols-[28px_1fr] gap-3 p-3">
            <span className="grid size-7 place-items-center rounded-full border border-arsen-acid/30 text-xs font-black text-arsen-acid">2</span>
            <p className="text-sm font-semibold text-arsen-muted">
              Cuando completas el maximo en todas las series con el RIR objetivo, Arsen muestra la alerta para subir peso.
            </p>
          </Card>
          <Card className="grid grid-cols-[28px_1fr] gap-3 p-3">
            <span className="grid size-7 place-items-center rounded-full border border-arsen-acid/30 text-xs font-black text-arsen-acid">3</span>
            <p className="text-sm font-semibold text-arsen-muted">
              Subes peso y vuelves al minimo del rango. Ejemplo: completas 3x12, subes peso y regresas a 3x8.
            </p>
          </Card>
        </div>
      </section>
    </div>
  )
}

function RoutineExerciseRecipeSheet({
  catalogItem,
  disabled,
  displayUnit,
  exercise,
  imageSrcByAssetId,
  onClose,
  onSave,
  saveError,
}: {
  catalogItem: ExerciseCatalogItem | null
  disabled: boolean
  displayUnit: WeightUnit
  exercise: RoutineExercise | null
  imageSrcByAssetId: Map<string, string>
  onClose: () => void
  onSave: (input: ExerciseInput) => void
  saveError: string | null
}) {
  const [form, setForm] = useState(() => exerciseToForm(exercise, catalogItem, displayUnit))
  const initialForm = useRef(JSON.stringify(form))
  const requestClose = useUnsavedClose(JSON.stringify(form) !== initialForm.current, disabled, onClose)
  const [message, setMessage] = useState<string | null>(null)
  const [warmupInfoOpen, setWarmupInfoOpen] = useState(false)
  const selectedWarmupProtocol = normalizeWarmupProtocol(form.warmupProtocol)
  const visualReference = exercise ?? catalogItem

  function update<K extends keyof ExerciseForm>(key: K, value: ExerciseForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <SheetFrame onClose={requestClose} title={exercise ? 'Editar receta' : 'Receta del dia'}>
      <div className="space-y-3">
        <Card className="grid grid-cols-[52px_minmax(0,1fr)] items-center gap-4 p-2">
          <ExerciseArt
            alt={form.name}
            bundledAssetId={visualReference?.bundledAssetId}
            className="size-[52px]"
            customImageSrc={visualReference?.customAssetId ? imageSrcByAssetId.get(visualReference.customAssetId) : null}
            muscle={form.mainMuscle}
          />
          <div className="min-w-0">
            <strong className="block truncate text-sm">{form.name}</strong>
            <span className="text-xs text-arsen-muted">
              {form.mainMuscle} - {form.equipment}
            </span>
          </div>
        </Card>
        <div>
          <label className="block text-xs font-bold text-arsen-muted" htmlFor="recipe-sets">Series</label>
          <div className="mt-1 flex gap-2">
            <button aria-label="Reducir series" className="min-h-11 min-w-11 rounded-[10px] border border-white/10" disabled={disabled || Number(form.targetSets) <= 1} onClick={() => update('targetSets', String(Math.max(1, (Number(form.targetSets) || 1) - 1)))} type="button">−</button>
            <input className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-center font-bold" id="recipe-sets" min="1" onChange={(event) => update('targetSets', event.target.value)} step="1" type="number" value={form.targetSets} />
            <button aria-label="Aumentar series" className="min-h-11 min-w-11 rounded-[10px] border border-white/10" disabled={disabled} onClick={() => update('targetSets', String(Math.max(1, Math.floor(Number(form.targetSets) || 0) + 1)))} type="button">+</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="Reps min" onChange={(value) => update('repsMin', value)} type="number" value={form.repsMin} />
          <TextField label="Reps max" onChange={(value) => update('repsMax', value)} type="number" value={form.repsMax} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TextField label="RIR" onChange={(value) => update('recommendedRir', value)} type="number" value={form.recommendedRir} />
          <TextField label="Descanso s" onChange={(value) => update('restSeconds', value)} type="number" value={form.restSeconds} />
        </div>
        <details className="rounded-[12px] border border-white/10 bg-arsen-bg/45 p-3">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold"><span>Opciones avanzadas</span><ChevronDown aria-hidden="true" className="size-5 text-arsen-purple2" /></summary>
        <div className="space-y-3">
        <div className="space-y-3">
          <div className="text-xs font-extrabold text-arsen-muted">Equipo y carga</div>
          <EquipmentSelect onChange={(value) => setForm((current) => applyEquipmentDefaults(current, value, displayUnit))} value={form.equipment} />
          <LoadSettingsFields
            barWeight={form.barWeight}
            displayUnit={displayUnit}
            equipment={form.equipment}
            loadMode={form.loadMode}
            onChange={(value) => setForm((current) => ({ ...current, ...value }))}
          />
        </div>
        <button
          aria-label="Ver descripcion del calentamiento"
          className="grid min-h-16 w-full grid-cols-[36px_1fr_28px] items-center gap-3 rounded-[12px] border border-arsen-purple/30 bg-arsen-purple/10 p-3 text-left transition hover:border-arsen-purple/60 hover:bg-arsen-purple/15"
          onClick={() => setWarmupInfoOpen(true)}
          type="button"
        >
          <span className="grid size-9 place-items-center rounded-[10px] bg-arsen-purple/20 text-arsen-purple2">
            <Info aria-hidden="true" className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Calentamiento</span>
            <strong className="block truncate text-sm text-arsen-purple2">{warmupProtocolLabel(selectedWarmupProtocol)}</strong>
          </span>
          <Info aria-hidden="true" className="size-5 text-arsen-purple2" />
        </button>
        <label className="block">
          <span className="mb-1 block text-xs font-bold text-arsen-muted">Notas tecnicas</span>
          <textarea
            className="min-h-20 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 py-2 text-sm font-semibold text-arsen-ink"
            onChange={(event) => update('technicalNotes', event.target.value)}
            value={form.technicalNotes}
          />
        </label>
        </div>
        </details>
        {message ? <p className="text-xs font-bold text-red-300">{message}</p> : null}
        {saveError ? <p className="text-sm text-red-300" role="alert">{saveError}</p> : null}
      </div>
      <ActionButton
        className="mt-4 w-full"
        disabled={disabled}
        onClick={() => {
          const input = formToExerciseInput(form, displayUnit)
          if (!input) {
            setMessage('Revisa series, repeticiones y RIR.')
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

type ExerciseForm = {
  barWeight: string
  equipment: Equipment
  loadMode: LoadMode
  mainMuscle: MuscleGroup
  name: string
  recommendedRir: string
  repsMax: string
  repsMin: string
  restSeconds: string
  targetSets: string
  technicalNotes: string
  warmupProtocol: string
}

type CatalogExerciseForm = Pick<
  ExerciseForm,
  'barWeight' | 'equipment' | 'loadMode' | 'mainMuscle' | 'name' | 'technicalNotes' | 'warmupProtocol'
> & {
  aliases: string
  bundledAssetId: string | null
  customAssetId: string | null
}

function exerciseToForm(exercise: RoutineExercise | null, catalogItem: ExerciseCatalogItem | null, displayUnit: WeightUnit): ExerciseForm {
  const loadSettings = loadSettingsForEquipment({
    barWeightKg: exercise?.barWeightKg ?? catalogItem?.barWeightKg,
    equipment: exercise?.equipment ?? catalogItem?.equipment ?? 'Barra',
    loadMode: exercise?.loadMode ?? catalogItem?.loadMode,
  })

  return {
    barWeight: String(kgToUnit(loadSettings.barWeightKg, displayUnit)),
    equipment: loadSettings.equipment,
    loadMode: loadSettings.loadMode,
    mainMuscle: normalizeMuscleGroup(exercise?.mainMuscle ?? catalogItem?.mainMuscle),
    name: exercise?.name ?? catalogItem?.name ?? '',
    recommendedRir: String(exercise?.recommendedRir ?? catalogItem?.defaultRecommendedRir ?? 2),
    repsMax: String(exercise?.repsMax ?? catalogItem?.defaultRepsMax ?? 10),
    repsMin: String(exercise?.repsMin ?? catalogItem?.defaultRepsMin ?? 8),
    restSeconds: String(exercise?.restSeconds ?? catalogItem?.defaultRestSeconds ?? 90),
    targetSets: String(exercise?.targetSets ?? catalogItem?.defaultTargetSets ?? 3),
    technicalNotes: exercise?.technicalNotes ?? catalogItem?.technicalNotes ?? '',
    warmupProtocol: normalizeWarmupProtocol(exercise?.warmupProtocol ?? catalogItem?.warmupProtocol),
  }
}

function formToExerciseInput(form: ExerciseForm, displayUnit: WeightUnit): ExerciseInput | null {
  const restSeconds = numberOrDefault(form.restSeconds, 90)
  const repsMin = numberOrDefault(form.repsMin, 8)
  const repsMax = numberOrDefault(form.repsMax, 10)
  const recommendedRir = numberOrDefault(form.recommendedRir, 2)
  const targetSets = Number(form.targetSets)
  if (!Number.isInteger(targetSets) || targetSets < 1 || !Number.isInteger(repsMin) || !Number.isInteger(repsMax) || repsMin <= 0 || repsMax <= 0 || repsMin > repsMax || recommendedRir < 0) return null

  return {
    ...loadInputFromForm(form, displayUnit),
    mainMuscle: form.mainMuscle,
    name: form.name,
    recommendedRir,
    repsMax,
    repsMin,
    rest: `${restSeconds} seg`,
    restSeconds,
    targetSets,
    technicalNotes: form.technicalNotes,
    warmupProtocol: normalizeWarmupProtocol(form.warmupProtocol),
    warmupSets: 0,
  }
}

function catalogItemToForm(
  item: ExerciseCatalogItem | null,
  displayUnit: WeightUnit,
  sourceSinfulShellExercise?: SinfulShellExercise | null,
): CatalogExerciseForm {
  const loadSettings = loadSettingsForEquipment({
    barWeightKg: item?.barWeightKg,
    equipment: item?.equipment ?? 'Barra',
    loadMode: item?.loadMode,
  })

  return {
    aliases: item?.aliases.join(', ') ?? sourceSinfulShellExercise?.aliases.join(', ') ?? '',
    bundledAssetId: sourceSinfulShellExercise?.bundledAssetId ?? item?.bundledAssetId ?? null,
    barWeight: String(kgToUnit(loadSettings.barWeightKg, displayUnit)),
    equipment: loadSettings.equipment,
    loadMode: loadSettings.loadMode,
    mainMuscle: sourceSinfulShellExercise?.mainMuscle ?? normalizeMuscleGroup(item?.mainMuscle),
    name: sourceSinfulShellExercise?.name ?? item?.name ?? '',
    customAssetId: item?.customAssetId ?? null,
    technicalNotes: sourceSinfulShellExercise?.technicalNotes ?? item?.technicalNotes ?? '',
    warmupProtocol: normalizeWarmupProtocol(item?.warmupProtocol),
  }
}

function applyEquipmentDefaults<T extends Pick<ExerciseForm, 'barWeight' | 'equipment' | 'loadMode'>>(
  form: T,
  equipment: Equipment,
  displayUnit: WeightUnit,
): T {
  const defaults = defaultLoadSettingsForEquipment(equipment)

  return {
    ...form,
    barWeight: String(kgToUnit(defaults.barWeightKg, displayUnit)),
    equipment,
    loadMode: defaults.loadMode,
  }
}

function loadInputFromForm(form: Pick<ExerciseForm, 'barWeight' | 'equipment' | 'loadMode'>, displayUnit: WeightUnit) {
  return loadSettingsForEquipment({
    barWeightKg: unitToKg(numberOrDefault(form.barWeight, 0), displayUnit),
    equipment: form.equipment,
    loadMode: form.loadMode,
  })
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

const SortableHandleContext = createContext<Pick<ReturnType<typeof useSortable>, 'attributes' | 'listeners' | 'setActivatorNodeRef'> | null>(null)

function DragHandle({ label }: { label: string }) {
  const handle = useContext(SortableHandleContext)
  return <button aria-label={label} className="grid min-h-11 min-w-11 touch-none place-items-center text-arsen-muted" ref={handle?.setActivatorNodeRef} type="button" {...handle?.attributes} {...handle?.listeners}><GripVertical aria-hidden="true" className="size-4" /></button>
}

function SortableRow({ children, id }: { children: ReactNode; id: string }) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition } = useSortable({ id })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <SortableHandleContext.Provider value={{ attributes, listeners, setActivatorNodeRef }}>{children}</SortableHandleContext.Provider>
    </div>
  )
}

function useUnsavedClose(dirty: boolean, disabled: boolean, onClose: () => void) {
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  return () => {
    if (disabled) return
    if (!dirty) { onClose(); return }
    void confirmAction('Descartar cambios', 'Hay cambios sin guardar.', 'Descartar').then((confirmed) => { if (confirmed) onClose() })
  }
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
  disabled = false,
  label,
  onChange,
  type = 'text',
  value,
}: {
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  type?: 'number' | 'text'
  value: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-arsen-muted">{label}</span>
      <input
        className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink disabled:opacity-60"
        disabled={disabled}
        inputMode={type === 'number' ? 'decimal' : undefined}
        onChange={(event) => onChange(event.target.value)}
        type={type}
        value={value}
      />
    </label>
  )
}

function MuscleSelect({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean
  onChange: (value: MuscleGroup) => void
  value: MuscleGroup
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-arsen-muted">Musculo</span>
      <select
        className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink disabled:opacity-60"
        disabled={disabled}
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

function LoadSettingsFields({
  barWeight,
  displayUnit,
  equipment,
  loadMode,
  onChange,
}: {
  barWeight: string
  displayUnit: WeightUnit
  equipment: Equipment
  loadMode: LoadMode
  onChange: (value: Pick<ExerciseForm, 'barWeight' | 'loadMode'>) => void
}) {
  return (
    <div className="space-y-2">
      <div>
        <span className="mb-1 block text-xs font-bold text-arsen-muted">Carga</span>
        <div className="grid min-h-14 grid-cols-2 overflow-hidden rounded-[10px] border border-white/10 bg-arsen-bg">
          {loadModeOptions.map((option) => (
            <button
              aria-pressed={loadMode === option.value}
              className={[
                'min-w-0 px-3 text-sm font-extrabold transition',
                loadMode === option.value ? 'bg-arsen-purple text-white' : 'text-arsen-muted hover:bg-white/5 hover:text-arsen-ink',
              ].join(' ')}
              key={option.value}
              onClick={() => onChange({ barWeight, loadMode: option.value })}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {equipment === 'Barra' ? (
        <TextField label={`Barra ${displayUnit.toUpperCase()}`} onChange={(value) => onChange({ barWeight: value, loadMode })} type="number" value={barWeight} />
      ) : null}
    </div>
  )
}

const loadModeOptions: Array<{ label: string; value: LoadMode }> = [
  { label: 'Punto unico', value: 'single' },
  { label: 'Por lado', value: 'split' },
]

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
        'grid min-h-11 place-items-center gap-1 rounded-[10px] border px-1 text-xs font-extrabold disabled:opacity-40',
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

function catalogPickerEmptyMessage(muscle: CatalogMuscleFilter, query: string) {
  const value = query.trim()
  if (muscle !== 'Todos' && value) return `No hay ejercicios de ${muscle} que coincidan con "${value}".`
  if (muscle !== 'Todos') return `No hay ejercicios de ${muscle}.`
  if (value) return `No hay ejercicios que coincidan con "${value}".`

  return 'No hay ejercicios en tu catalogo.'
}

function formatExerciseCount(count: number) {
  return `${count} ${count === 1 ? 'ejercicio' : 'ejercicios'}`
}

function weekdayName(weekday: RoutineDay['weekday']) {
  return weekdayOptions.find((option) => option.value === (weekday === null ? '' : String(weekday)))?.label ?? 'Sin dia fijo'
}

function numberOrDefault(value: string, fallback: number) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback
}
