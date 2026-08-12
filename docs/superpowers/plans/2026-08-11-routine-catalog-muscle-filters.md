# Routine Catalog Muscle Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add accessible muscle chips to the `/rutina` add-exercise picker while keeping Sinful Shell and image selection separate.

**Architecture:** Put filtering in a pure routine-domain utility, then have `CatalogPickerSheet` render local state for query and muscle. The picker keeps the current selection behavior and art resolution; filtering only changes which personal catalog rows are shown.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Vitest, Testing Library, lucide-react.

## Global Constraints

- Execution mode for this task is inline; do not use implementation or review subagents.
- Do not change Dexie schema, persisted types, backups, asset tables, or routine services.
- Use `muscleGroups` and `normalizeMuscleGroup`; do not create a second muscle taxonomy.
- Search must preserve current matches by name, muscle, and equipment, and also include aliases.
- Normalize search text for case, accents, and spacing with existing shared utilities.
- Preserve catalog order; filtering must not sort.
- Sinful Shell remains a separate action and must not be mixed into picker results.
- UI text stays Spanish and mobile-first for 360-430 px.
- Any git commit requires separate human approval.

---

### Task 1: Catalog Filter Utility

**Files:**
- Create: `src/domains/routine/utils/catalogFilters.ts`
- Create: `src/domains/routine/utils/catalogFilters.test.ts`

**Interfaces:**
- Consumes: `ExerciseCatalogItem`, `MuscleGroup`, `muscleGroups`, `normalizeMuscleGroup`, `canonicalName`
- Produces:
  - `type CatalogMuscleFilter = MuscleGroup | 'Todos'`
  - `const catalogMuscleFilters: readonly CatalogMuscleFilter[]`
  - `function filterCatalogByQueryAndMuscle(catalog: readonly ExerciseCatalogItem[], query: string, muscle: CatalogMuscleFilter): ExerciseCatalogItem[]`

- [ ] **Step 1: Write the failing utility tests**

Create `src/domains/routine/utils/catalogFilters.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { ExerciseCatalogItem } from '../types'
import { filterCatalogByQueryAndMuscle } from './catalogFilters'

describe('filterCatalogByQueryAndMuscle', () => {
  it('returns all catalog items in stable order for Todos and empty query', () => {
    const catalog = [item('press', 'Press plano', 'Pecho'), item('remo', 'Remo T', 'Espalda')]

    expect(filterCatalogByQueryAndMuscle(catalog, '', 'Todos').map((exercise) => exercise.id)).toEqual(['press', 'remo'])
  })

  it('filters by normalized muscle', () => {
    const catalog = [item('pectoral', 'Aperturas', 'Pectoral mayor'), item('remo', 'Remo T', 'Espalda')]

    expect(filterCatalogByQueryAndMuscle(catalog, '', 'Pecho').map((exercise) => exercise.id)).toEqual(['pectoral'])
  })

  it('matches name and aliases without accent or case sensitivity', () => {
    const catalog = [
      item('lateral', 'Elevacion lateral', 'Hombros', ['laterales con mancuerna']),
      item('remo', 'Remo T', 'Espalda'),
    ]

    expect(filterCatalogByQueryAndMuscle(catalog, 'ELEVACION', 'Todos').map((exercise) => exercise.id)).toEqual(['lateral'])
    expect(filterCatalogByQueryAndMuscle(catalog, 'mancuerna', 'Todos').map((exercise) => exercise.id)).toEqual(['lateral'])
  })

  it('preserves existing matches by muscle and equipment', () => {
    const catalog = [item('press', 'Press plano', 'Pecho'), item('sentadilla', 'Sentadilla', 'Piernas')]

    expect(filterCatalogByQueryAndMuscle(catalog, 'pecho', 'Todos').map((exercise) => exercise.id)).toEqual(['press'])
    expect(filterCatalogByQueryAndMuscle(catalog, 'barra', 'Todos').map((exercise) => exercise.id)).toEqual(['press', 'sentadilla'])
  })

  it('combines query with selected muscle', () => {
    const catalog = [
      item('press', 'Press plano', 'Pecho', ['banca']),
      item('fondos', 'Fondos', 'Brazos', ['banca']),
      item('remo', 'Remo T', 'Espalda'),
    ]

    expect(filterCatalogByQueryAndMuscle(catalog, 'banca', 'Pecho').map((exercise) => exercise.id)).toEqual(['press'])
  })
})

function item(id: string, name: string, mainMuscle: string, aliases: string[] = []): ExerciseCatalogItem {
  return {
    aliases,
    assetKind: null,
    barWeightKg: 20,
    bundledAssetId: null,
    canonicalName: id,
    createdAt: '2026-08-11T00:00:00.000Z',
    customAssetId: null,
    defaultRecommendedRir: 2,
    defaultRepsMax: 10,
    defaultRepsMin: 8,
    defaultRestSeconds: 90,
    defaultTargetSets: 3,
    equipment: 'Barra',
    id,
    loadMode: 'single',
    mainMuscle,
    name,
    technicalNotes: '',
    updatedAt: '2026-08-11T00:00:00.000Z',
    warmupProtocol: 'none',
  }
}
```

- [ ] **Step 2: Run the utility test and verify red**

Run: `pnpm test src/domains/routine/utils/catalogFilters.test.ts`

Expected: FAIL because `./catalogFilters` does not exist.

- [ ] **Step 3: Implement the minimal utility**

Create `src/domains/routine/utils/catalogFilters.ts`:

```ts
import { canonicalName } from '../../../shared/utils/normalize'
import type { ExerciseCatalogItem, MuscleGroup } from '../types'
import { muscleGroups, normalizeMuscleGroup } from './muscles'

export type CatalogMuscleFilter = MuscleGroup | 'Todos'

export const catalogMuscleFilters = ['Todos', ...muscleGroups] as const

export function filterCatalogByQueryAndMuscle(
  catalog: readonly ExerciseCatalogItem[],
  query: string,
  muscle: CatalogMuscleFilter,
): ExerciseCatalogItem[] {
  const normalizedQuery = canonicalName(query)
  const selectedMuscle = muscle === 'Todos' ? null : normalizeMuscleGroup(muscle)

  return catalog.filter((item) => {
    if (selectedMuscle && normalizeMuscleGroup(item.mainMuscle) !== selectedMuscle) return false
    if (!normalizedQuery) return true

    return catalogSearchText(item).includes(normalizedQuery)
  })
}

function catalogSearchText(item: ExerciseCatalogItem) {
  return [item.name, ...item.aliases, normalizeMuscleGroup(item.mainMuscle), item.equipment].map(canonicalName).join(' ')
}
```

- [ ] **Step 4: Run the utility test and verify green**

Run: `pnpm test src/domains/routine/utils/catalogFilters.test.ts`

Expected: PASS.

### Task 2: Catalog Picker UI

**Files:**
- Modify: `src/domains/routine/pages/RoutinePage.tsx`
- Modify: `src/domains/routine/pages/RoutinePage.test.tsx`

**Interfaces:**
- Consumes: `catalogMuscleFilters`, `filterCatalogByQueryAndMuscle`, `CatalogMuscleFilter`
- Produces: a picker that renders muscle chips, result count, empty state, and reset behavior

- [ ] **Step 1: Add failing component tests**

Modify `RoutinePage.test.tsx` by adding catalog picker tests inside the existing `describe` block:

```ts
  it('shows muscle filters with Todos selected when adding an exercise', () => {
    routinePageMocks.catalog = [
      catalogItem('press', 'Press plano', 'Pecho'),
      catalogItem('remo', 'Remo T', 'Espalda'),
    ]

    openAddExercisePicker()

    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Pecho' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('2 ejercicios')).toBeInTheDocument()
  })

  it('filters picker results by muscle chip', () => {
    routinePageMocks.catalog = [
      catalogItem('press', 'Press plano', 'Pecho'),
      catalogItem('remo', 'Remo T', 'Espalda'),
    ]

    openAddExercisePicker()
    fireEvent.click(screen.getByRole('button', { name: 'Espalda' }))

    expect(screen.queryByRole('button', { name: /Press plano/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Remo T/ })).toBeInTheDocument()
    expect(screen.getByText('1 ejercicio')).toBeInTheDocument()
  })

  it('combines picker search with the selected muscle', () => {
    routinePageMocks.catalog = [
      catalogItem('press', 'Press plano', 'Pecho', ['banca']),
      catalogItem('fondos', 'Fondos', 'Brazos', ['banca']),
    ]

    openAddExercisePicker()
    fireEvent.click(screen.getByRole('button', { name: 'Pecho' }))
    fireEvent.change(screen.getByPlaceholderText('Buscar ejercicio'), { target: { value: 'BANCA' } })

    expect(screen.getByRole('button', { name: /Press plano/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Fondos/ })).not.toBeInTheDocument()
  })

  it('shows an empty state and clears picker filters', () => {
    routinePageMocks.catalog = [catalogItem('press', 'Press plano', 'Pecho')]

    openAddExercisePicker()
    fireEvent.click(screen.getByRole('button', { name: 'Espalda' }))
    fireEvent.change(screen.getByPlaceholderText('Buscar ejercicio'), { target: { value: 'remo' } })

    expect(screen.getByText('No hay ejercicios de Espalda que coincidan con "remo".')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Limpiar filtros' }))

    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByPlaceholderText('Buscar ejercicio')).toHaveValue('')
    expect(screen.getByRole('button', { name: /Press plano/ })).toBeInTheDocument()
  })

  it('keeps opening the recipe sheet after selecting a filtered exercise', () => {
    routinePageMocks.catalog = [catalogItem('press', 'Press plano', 'Pecho')]

    openAddExercisePicker()
    fireEvent.click(screen.getByRole('button', { name: /Press plano/ }))

    expect(screen.getByRole('heading', { name: 'Receta del dia' })).toBeInTheDocument()
    expect(screen.getByText('Press plano')).toBeInTheDocument()
  })
```

Add helpers near `openCatalogEditor()`:

```ts
function openAddExercisePicker() {
  render(
    <MemoryRouter>
      <RoutinePage />
    </MemoryRouter>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  fireEvent.click(screen.getByRole('button', { name: '+ Ejercicio' }))
}

function catalogItem(id: string, name: string, mainMuscle: string, aliases: string[] = []): RoutinePageCatalogItem {
  return {
    aliases,
    assetKind: null,
    barWeightKg: 20,
    bundledAssetId: null,
    canonicalName: id,
    createdAt: '2026-08-11T00:00:00.000Z',
    customAssetId: null,
    defaultRecommendedRir: 2,
    defaultRepsMax: 10,
    defaultRepsMin: 8,
    defaultRestSeconds: 90,
    defaultTargetSets: 3,
    equipment: 'Barra',
    id,
    loadMode: 'single',
    mainMuscle,
    name,
    technicalNotes: '',
    updatedAt: '2026-08-11T00:00:00.000Z',
    warmupProtocol: 'none',
  }
}
```

- [ ] **Step 2: Run component tests and verify red**

Run: `pnpm test src/domains/routine/pages/RoutinePage.test.tsx`

Expected: FAIL because muscle chips, result count, empty state, and reset action are not implemented.

- [ ] **Step 3: Wire the picker to the utility and render controls**

Modify imports in `RoutinePage.tsx`:

```ts
import { catalogMuscleFilters, filterCatalogByQueryAndMuscle, type CatalogMuscleFilter } from '../utils/catalogFilters'
```

Update `CatalogPickerSheet` state and filtering:

```ts
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<CatalogMuscleFilter>('Todos')
  const filtered = useMemo(() => filterCatalogByQueryAndMuscle(catalog, query, muscle), [catalog, query, muscle])
```

Replace the area after `SearchBox` with:

```tsx
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
          ...
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
```

Add helpers in `RoutinePage.tsx`:

```tsx
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
```

- [ ] **Step 4: Run component tests and verify green**

Run: `pnpm test src/domains/routine/pages/RoutinePage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run focused checks**

Run:

```powershell
pnpm test src/domains/routine/utils/catalogFilters.test.ts
pnpm test src/domains/routine/pages/RoutinePage.test.tsx
```

Expected: both PASS.

### Task 3: Final Verification And UI Quality

**Files:**
- Modify only if verification reveals issues: `src/domains/routine/pages/RoutinePage.tsx`, `src/domains/routine/utils/catalogFilters.ts`, tests

**Interfaces:**
- Consumes: finished Task 1 and Task 2 code
- Produces: verified feature ready for final report

- [ ] **Step 1: Run Impeccable detector**

Run:

```powershell
node C:\Users\Chovy\.agents\skills\impeccable\scripts\detect.mjs --json src\domains\routine\pages\RoutinePage.tsx
```

Expected: no blocking issues for the changed picker surface.

- [ ] **Step 2: Run full tests**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `pnpm build`

Expected: PASS, including typecheck, Vite build, and service worker generation.

- [ ] **Step 4: Review git diff**

Run:

```powershell
git status --short
git diff -- src\domains\routine\utils\catalogFilters.ts src\domains\routine\utils\catalogFilters.test.ts src\domains\routine\pages\RoutinePage.tsx src\domains\routine\pages\RoutinePage.test.tsx docs\superpowers\plans\2026-08-11-routine-catalog-muscle-filters.md
```

Expected: only planned files changed; no schema, service, Sinful Shell, image selector, or asset changes.
