import { ArrowLeft, Check, ListPlus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ExerciseArt } from '../../../shared/components/ExerciseArt'
import {
  type SinfulShellExercise,
  getSinfulShellExerciseById,
  searchSinfulShellExercises,
  sinfulShellMuscleFilters,
} from '../data/sinfulShellCatalog'
import type { ExerciseCatalogItem, MuscleGroup } from '../types'

export type SinfulShellBrowserMode = 'catalog' | 'routine-add'

type SinfulShellBrowserSheetProps = {
  catalog: ExerciseCatalogItem[]
  disabled: boolean
  mode: SinfulShellBrowserMode
  onAddCopy: (exercise: SinfulShellExercise) => void
  onAddCopyToRoutine?: (catalogItem: ExerciseCatalogItem) => void
  onClose: () => void
  onViewCatalogCopy: (catalogItem: ExerciseCatalogItem) => void
}

export function SinfulShellBrowserSheet(props: SinfulShellBrowserSheetProps) {
  const { catalog, disabled, mode, onAddCopy, onAddCopyToRoutine, onClose, onViewCatalogCopy } = props
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'Todos'>('Todos')
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  const catalogCopyBySinfulShellId = useMemo(
    () => new Map(catalog.filter((item) => item.sinfulShellId).map((item) => [item.sinfulShellId, item])),
    [catalog],
  )
  const results = useMemo(() => searchSinfulShellExercises({ muscle, query }), [muscle, query])
  const selectedExercise = selectedExerciseId ? getSinfulShellExerciseById(selectedExerciseId) : null
  const selectedCopy = selectedExercise ? catalogCopyBySinfulShellId.get(selectedExercise.id) ?? null : null

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
      <button aria-label="Cerrar Sinful Shell" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        {selectedExercise ? (
          <SinfulShellDetail
            copy={selectedCopy}
            disabled={disabled}
            exercise={selectedExercise}
            mode={mode}
            onAddCopy={onAddCopy}
            onAddCopyToRoutine={onAddCopyToRoutine}
            onBack={() => setSelectedExerciseId(null)}
            onClose={onClose}
            onViewCatalogCopy={onViewCatalogCopy}
          />
        ) : (
          <SinfulShellBrowser
            catalogCopyBySinfulShellId={catalogCopyBySinfulShellId}
            disabled={disabled}
            muscle={muscle}
            onClose={onClose}
            onMuscleChange={setMuscle}
            onQueryChange={setQuery}
            onSelect={setSelectedExerciseId}
            query={query}
            results={results}
          />
        )}
      </section>
    </div>
  )
}

function SinfulShellBrowser({
  catalogCopyBySinfulShellId,
  disabled,
  muscle,
  onClose,
  onMuscleChange,
  onQueryChange,
  onSelect,
  query,
  results,
}: {
  catalogCopyBySinfulShellId: Map<string | null | undefined, ExerciseCatalogItem>
  disabled: boolean
  muscle: MuscleGroup | 'Todos'
  onClose: () => void
  onMuscleChange: (muscle: MuscleGroup | 'Todos') => void
  onQueryChange: (query: string) => void
  onSelect: (exerciseId: string) => void
  query: string
  results: readonly SinfulShellExercise[]
}) {
  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-10 space-y-3 bg-arsen-bg2 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Sinful Shell</h2>
            <p className="text-xs font-semibold text-arsen-muted">74 ejercicios incluidos</p>
          </div>
          <button className="grid size-9 shrink-0 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>
        <label className="grid grid-cols-[36px_1fr] items-center gap-2 rounded-[12px] border border-white/10 bg-arsen-surface p-2">
          <Search aria-hidden="true" className="size-5 text-arsen-muted" />
          <input
            aria-label="Buscar en Sinful Shell"
            className="min-h-10 bg-transparent text-sm font-semibold outline-none placeholder:text-arsen-muted"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Buscar ejercicio o alias"
            type="search"
            value={query}
          />
        </label>
        <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
          {sinfulShellMuscleFilters.map((option) => (
            <button
              aria-pressed={muscle === option}
              className={[
                'shrink-0 rounded-full border px-3 py-2 text-xs font-extrabold',
                muscle === option ? 'border-arsen-purple2 bg-arsen-purple/40 text-white' : 'border-white/10 bg-arsen-surface text-arsen-muted',
              ].join(' ')}
              key={option}
              onClick={() => onMuscleChange(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2" data-testid="sinful-shell-results">
        {results.map((exercise) => {
          const copy = catalogCopyBySinfulShellId.get(exercise.id)
          const status = copy ? 'Agregado' : 'Disponible'

          return (
            <button
              aria-label={`${exercise.name} ${status}`}
              className="grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-4 rounded-[12px] border border-white/10 bg-arsen-surface p-2 text-left transition hover:border-arsen-purple/45 disabled:opacity-50"
              disabled={disabled}
              key={exercise.id}
              onClick={() => onSelect(exercise.id)}
              type="button"
            >
              <ExerciseArt alt={exercise.name} bundledAssetId={exercise.bundledAssetId} className="size-[52px]" muscle={exercise.mainMuscle} />
              <span className="min-w-0">
                <strong className="block truncate text-sm">{exercise.name}</strong>
                <span className="mt-1 block truncate text-xs text-arsen-muted">{exercise.mainMuscle}</span>
              </span>
              <span
                className={[
                  'rounded-full px-2 py-1 text-xs font-extrabold',
                  copy ? 'bg-arsen-acid/15 text-arsen-acid' : 'bg-white/10 text-arsen-muted',
                ].join(' ')}
              >
                {status}
              </span>
            </button>
          )
        })}
        {results.length === 0 ? (
          <div className="rounded-[12px] border border-white/10 bg-arsen-surface p-4 text-sm font-semibold text-arsen-muted">
            Sin coincidencias en Sinful Shell.
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SinfulShellDetail({
  copy,
  disabled,
  exercise,
  mode,
  onAddCopy,
  onAddCopyToRoutine,
  onBack,
  onClose,
  onViewCatalogCopy,
}: {
  copy: ExerciseCatalogItem | null
  disabled: boolean
  exercise: SinfulShellExercise
  mode: SinfulShellBrowserMode
  onAddCopy: (exercise: SinfulShellExercise) => void
  onAddCopyToRoutine?: (catalogItem: ExerciseCatalogItem) => void
  onBack: () => void
  onClose: () => void
  onViewCatalogCopy: (catalogItem: ExerciseCatalogItem) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <button className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={onBack} type="button">
          <ArrowLeft aria-hidden="true" className="size-5" />
          <span className="sr-only">Volver a Sinful Shell</span>
        </button>
        <button className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
          <X aria-hidden="true" className="size-5" />
          <span className="sr-only">Cerrar</span>
        </button>
      </div>

      <ExerciseArt alt={exercise.name} bundledAssetId={exercise.bundledAssetId} className="aspect-[4/3] w-full" muscle={exercise.mainMuscle} />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-arsen-purple/25 px-2 py-1 text-xs font-extrabold text-arsen-purple2">{exercise.mainMuscle}</span>
          <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-extrabold text-arsen-muted">{copy ? 'Ya agregado' : 'Disponible'}</span>
        </div>
        <h2 className="text-2xl font-black">{exercise.name}</h2>
      </div>

      {exercise.aliases.length > 0 ? (
        <div>
          <div className="mb-1 text-xs font-extrabold text-arsen-muted">Aliases</div>
          <div className="flex flex-wrap gap-2">
            {exercise.aliases.map((alias) => (
              <span className="rounded-full border border-white/10 bg-arsen-surface px-2 py-1 text-xs font-bold text-arsen-muted" key={alias}>
                {alias}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-[12px] border border-white/10 bg-arsen-surface p-3">
        <div className="mb-1 text-xs font-extrabold text-arsen-muted">Indicaciones tecnicas</div>
        <p className="text-sm font-semibold leading-relaxed text-arsen-ink">{exercise.technicalNotes}</p>
      </div>

      <div className="grid gap-2">
        {copy ? (
          <>
            <button
              className="flex min-h-12 items-center justify-center gap-2 rounded-[10px] border border-white/10 text-sm font-extrabold text-arsen-ink disabled:opacity-40"
              disabled={disabled}
              onClick={() => onViewCatalogCopy(copy)}
              type="button"
            >
              <Check aria-hidden="true" className="size-5" />
              Ver en mi catalogo
            </button>
            {mode === 'routine-add' && onAddCopyToRoutine ? (
              <button
                className="flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-arsen-acid px-4 text-sm font-extrabold text-on-acid disabled:opacity-40"
                disabled={disabled}
                onClick={() => onAddCopyToRoutine(copy)}
                type="button"
              >
                <ListPlus aria-hidden="true" className="size-5" />
                Agregar a la rutina
              </button>
            ) : null}
          </>
        ) : (
          <button
            className="flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-arsen-acid px-4 text-sm font-extrabold text-on-acid disabled:opacity-40"
            disabled={disabled}
            onClick={() => onAddCopy(exercise)}
            type="button"
          >
            <ListPlus aria-hidden="true" className="size-5" />
            Agregar a mi catalogo
          </button>
        )}
      </div>
    </div>
  )
}
