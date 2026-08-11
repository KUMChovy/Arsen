# Imagenes V2 Y Selector Movil Por Musculo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Project override from `AGENTS.md`: use `superpowers:executing-plans` only; subagent-driven development and implementation/review subagents are forbidden.

**Goal:** Replace sprite-backed exercise art with bundled local PNG assets, add `bundledAssetId` propagation, and ship a compact searchable muscle-filtered mobile image selector.

**Architecture:** Add a shared bundled image registry that Vite resolves at build time with `import.meta.glob`, then make `ExerciseArt` resolve custom image, bundled image, muscle fallback, and neutral fallback in one place. Keep `exerciseAssets` and `customAssetId` unchanged, keep `assetKind` only for legacy import compatibility, and add `bundledAssetId` as a nullable non-indexed property without bumping Dexie schema.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Dexie, dexie-react-hooks, zod, Vitest, Testing Library.

## Global Constraints

- UI strings stay Spanish (`es-MX`).
- App remains 100% offline and backend-free.
- Do not fetch images or call network APIs.
- Do not add dependencies.
- Do not bump Dexie schema version unless an index or table changes.
- Keep `exerciseAssets`, `customAssetId`, and `createExerciseAsset`.
- `assetKind` stays accepted in imports/backups but must not render old sprites.
- Prompt 11 owns Sinful Shell origin/lock behavior; do not add lock fields in this plan.
- Mobile selector must work down to 360px with no horizontal overflow.
- Do not commit, branch, push, or merge without explicit human approval for that specific git operation.

---

## File Structure

- Create `src/shared/assets/exerciseImages.ts`: bundled exercise/muscle registry, filename parsing, search helpers, and validation helper.
- Create `src/shared/assets/exerciseImages.test.ts`: registry validation tests.
- Modify `src/domains/routine/types.ts`: add `bundledAssetId`.
- Modify `src/domains/workout/types.ts`: add `bundledAssetId` to snapshots.
- Modify `src/shared/validation/arsenImportSchemas.ts`: accept/default `bundledAssetId`.
- Modify `src/domains/routine/services.ts`: accept, preserve, and copy `bundledAssetId`.
- Modify `src/domains/workout/services.ts`: snapshot `bundledAssetId`.
- Modify `src/db/seedDemoRoutine.ts`: seed bundled IDs from local registry instead of `assetKindForExercise`.
- Modify `src/shared/components/ExerciseArt.tsx`: remove sprite imports and resolve bundled/muscle/local fallback.
- Modify `src/shared/components/ExerciseArt.test.tsx`: update resolver tests.
- Modify `src/domains/routine/components/ExerciseImageSelector.tsx`: bottom sheet, search, chips, 3-column grid, custom upload.
- Modify `src/domains/routine/components/ExerciseImageSelector.test.tsx`: filter/search/selection accessibility tests.
- Modify `src/domains/routine/pages/RoutinePage.tsx`: catalog editor form and all `ExerciseArt` calls use `bundledAssetId`.
- Modify `src/domains/routine/pages/RoutineDayDetailPage.tsx`, `src/domains/workout/pages/WorkoutPage.tsx`, `src/domains/progress/pages/ProgressPage.tsx`, and `src/domains/progress/pages/ProgressHistoryDatePage.tsx`: pass `bundledAssetId` where available.
- Modify existing tests that create `ExerciseCatalogItem`, `RoutineExercise`, or `ExerciseSnapshot` fixtures.
- Delete `src/assets/arsen-exercise-sprite.png` and `src/assets/arsen-muscle-groups-sprite.png` after `rg` confirms there are no references.

---

### Task 1: Bundled Asset Registry

**Files:**
- Create: `src/shared/assets/exerciseImages.ts`
- Create: `src/shared/assets/exerciseImages.test.ts`

**Interfaces:**
- Produces: `BundledExerciseAsset`
- Produces: `bundledExerciseAssets: BundledExerciseAsset[]`
- Produces: `bundledMuscleAssets: Record<MuscleGroup, string>`
- Produces: `getBundledExerciseAsset(id: string | null | undefined): BundledExerciseAsset | null`
- Produces: `getMuscleAsset(muscle: string | null | undefined): string | null`
- Produces: `bundledAssetIdForExercise(name: string, muscle: string | null | undefined): string | null`
- Produces: `validateBundledAssetRegistry(): string[]`

- [ ] **Step 1: Write failing registry tests**

Create `src/shared/assets/exerciseImages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  bundledAssetIdForExercise,
  bundledExerciseAssets,
  bundledMuscleAssets,
  getBundledExerciseAsset,
  getMuscleAsset,
  validateBundledAssetRegistry,
} from './exerciseImages'

describe('bundled exercise image registry', () => {
  it('contains valid exercise files and all muscle fallbacks', () => {
    expect(validateBundledAssetRegistry()).toEqual([])
    expect(Object.keys(bundledMuscleAssets).sort()).toEqual(['Abdomen', 'Brazos', 'Espalda', 'Hombros', 'Pecho', 'Piernas'])
    expect(bundledExerciseAssets.length).toBeGreaterThan(0)
  })

  it('uses the full filename slug as stable bundledAssetId', () => {
    expect(getBundledExerciseAsset('press-inclinado--pecho')).toMatchObject({
      id: 'press-inclinado--pecho',
      muscle: 'Pecho',
      name: 'Press inclinado',
    })
  })

  it('resolves exercise names and muscles to bundled IDs without using the old sprite kinds', () => {
    expect(bundledAssetIdForExercise('Press inclinado', 'Pecho')).toBe('press-inclinado--pecho')
    expect(bundledAssetIdForExercise('Ejercicio sin imagen', 'Pecho')).toBeNull()
  })

  it('resolves muscle fallback assets from local PNGs', () => {
    expect(getMuscleAsset('Piernas')).toContain('/src/assets/musculos/piernas.png')
    expect(getMuscleAsset('musculo raro')).toContain('/src/assets/musculos/pecho.png')
  })
})
```

- [ ] **Step 2: Run registry tests to verify failure**

Run: `pnpm test src/shared/assets/exerciseImages.test.ts`

Expected: FAIL because `exerciseImages.ts` does not exist.

- [ ] **Step 3: Implement registry**

Create `src/shared/assets/exerciseImages.ts`:

```ts
import type { MuscleGroup } from '../../domains/routine/types'
import { normalizeMuscleGroup } from '../../domains/routine/utils/muscles'
import { canonicalName } from '../utils/normalize'

export type BundledExerciseAsset = {
  aliases: string[]
  id: string
  muscle: MuscleGroup
  name: string
  url: string
}

const muscleSlugToGroup = {
  abdomen: 'Abdomen',
  brazos: 'Brazos',
  espalda: 'Espalda',
  hombros: 'Hombros',
  pecho: 'Pecho',
  piernas: 'Piernas',
} satisfies Record<string, MuscleGroup>

const groupToMuscleSlug: Record<MuscleGroup, keyof typeof muscleSlugToGroup> = {
  Abdomen: 'abdomen',
  Brazos: 'brazos',
  Espalda: 'espalda',
  Hombros: 'hombros',
  Pecho: 'pecho',
  Piernas: 'piernas',
}

const exerciseModules = import.meta.glob('../../assets/ejercicios/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

const muscleModules = import.meta.glob('../../assets/musculos/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

const aliasesByBundledAssetId = {
  'jalon-al-pecho--espalda': ['jalon dorsal', 'polea alta'],
  'press-plano--pecho': ['press banca'],
  'sentadilla-trasera--piernas': ['back squat'],
} satisfies Record<string, string[]>

export const bundledExerciseAssets = Object.entries(exerciseModules)
  .map(([path, url]) => parseExerciseAsset(path, url))
  .filter((asset): asset is BundledExerciseAsset => Boolean(asset))
  .sort((a, b) => a.name.localeCompare(b.name, 'es-MX'))

export const bundledMuscleAssets = Object.fromEntries(
  Object.entries(groupToMuscleSlug).map(([group, slug]) => [group, muscleModules[`../../assets/musculos/${slug}.png`] ?? '']),
) as Record<MuscleGroup, string>

const bundledAssetById = new Map(bundledExerciseAssets.map((asset) => [asset.id, asset]))

export function getBundledExerciseAsset(id: string | null | undefined) {
  return id ? bundledAssetById.get(id) ?? null : null
}

export function getMuscleAsset(muscle: string | null | undefined) {
  const normalized = normalizeMuscleGroup(muscle)
  return bundledMuscleAssets[normalized] || bundledMuscleAssets.Pecho || null
}

export function bundledAssetIdForExercise(name: string, muscle: string | null | undefined) {
  const normalized = normalizeMuscleGroup(muscle)
  const id = `${canonicalName(name)}--${groupToMuscleSlug[normalized]}`
  return bundledAssetById.has(id) ? id : null
}

export function searchableTextForBundledAsset(asset: BundledExerciseAsset) {
  return [asset.id, asset.name, asset.muscle, ...asset.aliases].join(' ').toLocaleLowerCase('es-MX')
}

export function validateBundledAssetRegistry() {
  const errors: string[] = []
  const ids = new Set<string>()
  const validMuscleSlugs = new Set(Object.keys(muscleSlugToGroup))

  for (const path of Object.keys(exerciseModules)) {
    const filename = path.split('/').at(-1) ?? ''
    const match = /^(?<exerciseSlug>[a-z0-9]+(?:-[a-z0-9]+)*)--(?<muscleSlug>[a-z]+)\.png$/.exec(filename)
    if (!match?.groups) {
      errors.push(`Nombre invalido: ${filename}`)
      continue
    }
    if (!validMuscleSlugs.has(match.groups.muscleSlug)) {
      errors.push(`Musculo invalido en ${filename}: ${match.groups.muscleSlug}`)
    }
    const id = filename.replace(/\.png$/, '')
    if (ids.has(id)) errors.push(`bundledAssetId duplicado: ${id}`)
    ids.add(id)
  }

  for (const slug of Object.keys(muscleSlugToGroup)) {
    if (!muscleModules[`../../assets/musculos/${slug}.png`]) errors.push(`Falta fallback muscular: ${slug}.png`)
  }

  for (const id of Object.keys(aliasesByBundledAssetId)) {
    if (!ids.has(id)) errors.push(`Aliases apuntan a bundledAssetId inexistente: ${id}`)
  }

  return errors
}

function parseExerciseAsset(path: string, url: string): BundledExerciseAsset | null {
  const filename = path.split('/').at(-1) ?? ''
  const match = /^(?<exerciseSlug>[a-z0-9]+(?:-[a-z0-9]+)*)--(?<muscleSlug>[a-z]+)\.png$/.exec(filename)
  if (!match?.groups) return null

  const muscle = muscleSlugToGroup[match.groups.muscleSlug]
  if (!muscle) return null

  const id = filename.replace(/\.png$/, '')
  return {
    aliases: aliasesByBundledAssetId[id] ?? [],
    id,
    muscle,
    name: titleFromSlug(match.groups.exerciseSlug),
    url,
  }
}

function titleFromSlug(slug: string) {
  const text = slug.replaceAll('-', ' ')
  return text.charAt(0).toLocaleUpperCase('es-MX') + text.slice(1)
}
```

- [ ] **Step 4: Run registry tests**

Run: `pnpm test src/shared/assets/exerciseImages.test.ts`

Expected: PASS.

---

### Task 2: Types, Import Schemas, And Data Propagation

**Files:**
- Modify: `src/domains/routine/types.ts`
- Modify: `src/domains/workout/types.ts`
- Modify: `src/shared/validation/arsenImportSchemas.ts`
- Modify: `src/domains/routine/services.ts`
- Modify: `src/domains/workout/services.ts`
- Modify: `src/db/seedDemoRoutine.ts`
- Test: `src/shared/validation/arsenImportSchemas.test.ts`
- Test: `src/db/indexeddb.test.ts`

**Interfaces:**
- Produces: `ExerciseCatalogItem.bundledAssetId: string | null`
- Produces: `RoutineExercise.bundledAssetId: string | null`
- Produces: `ExerciseSnapshot.bundledAssetId?: string | null`
- Consumes: `bundledAssetIdForExercise(name, muscle)` from Task 1

- [ ] **Step 1: Extend failing validation and DB tests**

In `src/shared/validation/arsenImportSchemas.test.ts`, extend the existing visual asset test objects with `bundledAssetId: 'press-inclinado--pecho'` on `exerciseCatalog`, `routineExercises`, and `snapshot`. Add assertions to legacy-defaults tests:

```ts
expect(result.data.tables.routineExercises[0]).toMatchObject({
  assetKind: null,
  bundledAssetId: null,
  customAssetId: null,
})
expect(result.data.tables.exerciseLogs[0]?.snapshot).toMatchObject({
  assetKind: null,
  bundledAssetId: null,
  customAssetId: null,
})
```

In `src/db/indexeddb.test.ts`, update `copies catalog visual references into day recipes and workout snapshots` to create the catalog item with `bundledAssetId: 'press-inclinado--pecho'` and assert:

```ts
expect(exercise).toMatchObject({
  bundledAssetId: 'press-inclinado--pecho',
  customAssetId,
})

await expect(db.exerciseLogs.get(registered.exerciseLogId)).resolves.toMatchObject({
  snapshot: {
    bundledAssetId: 'press-inclinado--pecho',
    customAssetId,
  },
})
```

Update local test fixture helpers that return `ExerciseCatalogItem`, `RoutineExercise`, or `ExerciseSnapshot` to include `bundledAssetId: null`.

- [ ] **Step 2: Run focused tests to verify failure**

Run: `pnpm test src/shared/validation/arsenImportSchemas.test.ts src/db/indexeddb.test.ts`

Expected: FAIL because `bundledAssetId` is not typed or propagated.

- [ ] **Step 3: Add TypeScript fields**

In `src/domains/routine/types.ts`, add `bundledAssetId: string | null` to both `RoutineExercise` and `ExerciseCatalogItem`.

In `src/domains/workout/types.ts`, add to `ExerciseSnapshot`:

```ts
bundledAssetId?: string | null
```

- [ ] **Step 4: Add schema defaults without Dexie version bump**

In `src/shared/validation/arsenImportSchemas.ts`, add this line next to `assetKind` and `customAssetId` in `routineExerciseSchema`, `exerciseCatalogItemSchema`, and `exerciseLogSchema.snapshot`:

```ts
bundledAssetId: z.string().nullable().optional().default(null),
```

Do not edit `CURRENT_SCHEMA_VERSION` in `src/db/schema.ts`.

- [ ] **Step 5: Propagate through services**

In `src/domains/routine/services.ts`, extend `ExerciseInput` and `CatalogExerciseInput`:

```ts
bundledAssetId?: string | null
```

In `createExercise`, set:

```ts
bundledAssetId: input.bundledAssetId ?? null,
```

In `addCatalogExerciseToDay`, set:

```ts
bundledAssetId: catalogItem.bundledAssetId ?? null,
```

In `updateExercise`, preserve unless explicitly supplied:

```ts
bundledAssetId: input.bundledAssetId === undefined ? existing?.bundledAssetId ?? null : input.bundledAssetId,
```

In `createCatalogExercise`, set:

```ts
bundledAssetId: input.bundledAssetId ?? null,
```

In `updateCatalogExercise`, preserve unless explicitly supplied:

```ts
bundledAssetId: input.bundledAssetId === undefined ? existing?.bundledAssetId ?? null : input.bundledAssetId,
```

In `src/domains/workout/services.ts`, add to `ensureExerciseLog` snapshot:

```ts
bundledAssetId: exercise.bundledAssetId,
```

- [ ] **Step 6: Seed demo routine with bundled IDs**

In `src/db/seedDemoRoutine.ts`, import:

```ts
import { bundledAssetIdForExercise } from '../shared/assets/exerciseImages'
```

Set `bundledAssetId` on routine exercises and catalog rows:

```ts
bundledAssetId: bundledAssetIdForExercise(exercise.name, exercise.mainMuscle),
```

Remove `assetKindForExercise` and set `assetKind: null` for new seeded rows. Existing backups still carry legacy `assetKind`; new seed data should not use it.

- [ ] **Step 7: Run focused propagation tests**

Run: `pnpm test src/shared/validation/arsenImportSchemas.test.ts src/db/indexeddb.test.ts`

Expected: PASS.

---

### Task 3: ExerciseArt Resolver Without Sprites

**Files:**
- Modify: `src/shared/components/ExerciseArt.tsx`
- Modify: `src/shared/components/ExerciseArt.test.tsx`

**Interfaces:**
- Consumes: `customImageSrc?: string | null`
- Consumes: `bundledAssetId?: string | null`
- Consumes: `muscle?: string | null`
- Produces: no imports of `arsen-exercise-sprite.png` or `arsen-muscle-groups-sprite.png`

- [ ] **Step 1: Replace component tests**

Update `src/shared/components/ExerciseArt.test.tsx` tests so they assert the new priority:

```tsx
it('uses a custom image before bundled and muscle fallback', () => {
  render(
    <ExerciseArt
      alt="Remo"
      bundledAssetId="press-inclinado--pecho"
      customImageSrc="data:image/png;base64,AAAA"
      muscle="Pecho"
    />,
  )

  expect(screen.getByRole('img', { name: 'Remo' })).toHaveStyle({
    backgroundImage: 'url(data:image/png;base64,AAAA)',
  })
})

it('uses a valid bundled asset before muscle fallback', () => {
  render(<ExerciseArt alt="Press inclinado" bundledAssetId="press-inclinado--pecho" muscle="Piernas" />)

  expect(screen.getByRole('img', { name: 'Press inclinado' }).getAttribute('style')).toContain('press-inclinado')
})

it('falls back to muscle art when bundled asset is unknown', () => {
  render(<ExerciseArt alt="Dominante" bundledAssetId="missing--pecho" muscle="Piernas" />)

  expect(screen.getByRole('img', { name: 'Dominante' }).getAttribute('style')).toContain('piernas')
})

it('uses a neutral local fallback when no usable image data exists', () => {
  render(<ExerciseArt alt="Sin dato" bundledAssetId="missing--pecho" muscle={null} />)

  expect(screen.getByRole('img', { name: 'Sin dato' })).toHaveAttribute('data-image-source', 'placeholder')
})
```

Keep the existing default-size override test.

- [ ] **Step 2: Run ExerciseArt tests to verify failure**

Run: `pnpm test src/shared/components/ExerciseArt.test.tsx`

Expected: FAIL because `ExerciseArt` still uses `assetKind` and sprites.

- [ ] **Step 3: Implement resolver**

In `src/shared/components/ExerciseArt.tsx`, remove both sprite imports and `ExerciseArtKind`. Import:

```ts
import { getBundledExerciseAsset, getMuscleAsset } from '../assets/exerciseImages'
```

Use props:

```ts
type ExerciseArtProps = {
  alt: string
  bundledAssetId?: string | null
  className?: string
  customImageSrc?: string | null
  muscle?: string | null
}
```

Resolve:

```ts
const bundledAsset = getBundledExerciseAsset(bundledAssetId)
const muscleSrc = getMuscleAsset(muscle)
const imageSource = customImageSrc
  ? 'custom'
  : bundledAsset
    ? 'bundled'
    : muscleSrc
      ? 'muscle'
      : 'placeholder'
const backgroundImage = customImageSrc
  ? `url(${customImageSrc})`
  : bundledAsset
    ? `url(${bundledAsset.url})`
    : muscleSrc
      ? `url(${muscleSrc})`
      : 'radial-gradient(circle at 50% 38%, rgb(153 83 255 / 0.30), rgb(255 255 255 / 0.04) 42%, transparent 68%)'
```

Set `data-image-source={imageSource}` on the root. Use `backgroundSize: imageSource === 'placeholder' ? '100% 100%' : 'cover'` and `backgroundPosition: 'center'`.

- [ ] **Step 4: Run ExerciseArt tests**

Run: `pnpm test src/shared/components/ExerciseArt.test.tsx`

Expected: PASS.

---

### Task 4: Mobile Image Selector

**Files:**
- Modify: `src/domains/routine/components/ExerciseImageSelector.tsx`
- Modify: `src/domains/routine/components/ExerciseImageSelector.test.tsx`
- Modify: `src/domains/routine/pages/RoutinePage.tsx`

**Interfaces:**
- Produces: `ExerciseImageSelection = { bundledAssetId: string | null; customAssetId: string | null }`
- Consumes: `bundledExerciseAssets`, `searchableTextForBundledAsset`
- Consumes: existing `ExerciseAsset[]` custom uploads

- [ ] **Step 1: Write failing selector tests**

Replace `src/domains/routine/components/ExerciseImageSelector.test.tsx` with tests for the new behavior:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ExerciseImageSelector } from './ExerciseImageSelector'

describe('ExerciseImageSelector', () => {
  it('preselects the exercise muscle and filters bundled images by chip', () => {
    renderSelector({ mainMuscle: 'Pecho' })

    expect(screen.getByRole('button', { name: 'Pecho' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Press inclinado/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Espalda' }))

    expect(screen.getByRole('button', { name: 'Espalda' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: /Press inclinado/ })).not.toBeInTheDocument()
  })

  it('combines search with the active muscle filter and supports aliases', () => {
    renderSelector({ mainMuscle: 'Pecho' })

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar imagen' }), { target: { value: 'banca' } })

    expect(screen.getByRole('button', { name: /Press plano/ })).toBeInTheDocument()
  })

  it('keeps a draft selection until the user confirms', () => {
    const onChange = vi.fn()
    renderSelector({ onChange })

    fireEvent.click(screen.getByRole('button', { name: /Press inclinado/ }))
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Usar imagen' }))
    expect(onChange).toHaveBeenCalledWith({ bundledAssetId: 'press-inclinado--pecho', customAssetId: null })
  })

  it('keeps custom upload visible and announces upload errors', () => {
    renderSelector({ error: 'No se pudo cargar la imagen' })

    expect(screen.getByLabelText('Subir imagen propia')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la imagen')
  })
})

function renderSelector(
  overrides: Partial<Parameters<typeof ExerciseImageSelector>[0]> = {},
) {
  return render(
    <ExerciseImageSelector
      assets={[asset]}
      disabled={false}
      error={null}
      mainMuscle="Pecho"
      onChange={vi.fn()}
      onClose={vi.fn()}
      onUpload={vi.fn()}
      selection={{ bundledAssetId: null, customAssetId: null }}
      {...overrides}
    />,
  )
}

const asset = {
  createdAt: '2026-08-02T00:00:00.000Z',
  dataUrl: 'data:image/png;base64,AAAA',
  id: 'asset-1',
  mimeType: 'image/png',
  name: 'press.png',
  updatedAt: '2026-08-02T00:00:00.000Z',
}
```

- [ ] **Step 2: Run selector tests to verify failure**

Run: `pnpm test src/domains/routine/components/ExerciseImageSelector.test.tsx`

Expected: FAIL because the component still exposes `assetKind` grid buttons.

- [ ] **Step 3: Implement bottom sheet selector**

In `ExerciseImageSelector.tsx`, replace `assetKind` with `bundledAssetId` and render a self-contained fixed bottom sheet. Use local state:

```ts
const [draftSelection, setDraftSelection] = useState(selection)
const [activeMuscle, setActiveMuscle] = useState<MuscleGroup | 'Todos'>(mainMuscle)
const [query, setQuery] = useState('')
```

Sync draft when parent selection changes:

```ts
useEffect(() => setDraftSelection(selection), [selection])
useEffect(() => setActiveMuscle(mainMuscle), [mainMuscle])
```

Filter:

```ts
const normalizedQuery = query.trim().toLocaleLowerCase('es-MX')
const visibleBundledAssets = bundledExerciseAssets.filter((asset) => {
  const muscleMatches = activeMuscle === 'Todos' || asset.muscle === activeMuscle
  const queryMatches = !normalizedQuery || searchableTextForBundledAsset(asset).includes(normalizedQuery)
  return muscleMatches && queryMatches
})
```

Render structure:

```tsx
<div className="fixed inset-0 z-[60] mx-auto flex max-w-[430px] items-end bg-black/55" role="presentation">
  <button aria-label="Cerrar selector de imagen" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
  <section
    aria-labelledby="exercise-image-selector-title"
    className="relative grid max-h-[85vh] w-full grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]"
    role="dialog"
  >
    <header className="sticky top-0 z-10 border-b border-white/10 bg-arsen-bg2 p-4">
      <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/25" />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black" id="exercise-image-selector-title">Imagen del ejercicio</h2>
        <button aria-label="Cerrar" className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      <label className="mt-3 grid grid-cols-[32px_minmax(0,1fr)] items-center gap-2 rounded-[10px] border border-white/10 bg-arsen-surface px-3">
        <Search aria-hidden="true" className="size-4 text-arsen-muted" />
        <span className="sr-only">Buscar imagen</span>
        <input className="min-h-11 bg-transparent text-sm font-semibold outline-none placeholder:text-arsen-muted" onChange={(event) => setQuery(event.target.value)} placeholder="Buscar imagen" type="search" value={query} />
      </label>
      <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto pb-1">
        {(['Todos', ...muscleGroups] as const).map((muscle) => (
          <button
            aria-pressed={activeMuscle === muscle}
            className={[
              'min-h-9 shrink-0 rounded-full border px-3 text-xs font-extrabold',
              activeMuscle === muscle
                ? 'border-arsen-purple2 bg-arsen-purple/25 text-arsen-ink'
                : 'border-white/10 bg-arsen-surface text-arsen-muted',
            ].join(' ')}
            key={muscle}
            onClick={() => setActiveMuscle(muscle)}
            type="button"
          >
            {muscle}
          </button>
        ))}
      </div>
    </header>
    <div className="overflow-y-auto p-4">
      <label className="mb-3 grid min-h-12 cursor-pointer grid-cols-[36px_1fr] items-center gap-2 rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-bold text-arsen-purple2">
        <ImagePlus aria-hidden="true" className="size-5" />
        <span>Subir imagen propia</span>
        <input
          aria-label="Subir imagen propia"
          accept="image/*"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) onUpload(file)
          }}
          type="file"
        />
      </label>
      <div className="grid grid-cols-3 gap-2">
        {visibleBundledAssets.map((asset) => (
          <button
            aria-pressed={draftSelection.bundledAssetId === asset.id && !draftSelection.customAssetId}
            className={[
              'min-w-0 rounded-[10px] border p-1.5 text-left',
              draftSelection.bundledAssetId === asset.id && !draftSelection.customAssetId
                ? 'border-arsen-purple2 bg-arsen-purple/25 text-arsen-ink'
                : 'border-white/10 bg-arsen-surface text-arsen-muted',
            ].join(' ')}
            key={asset.id}
            onClick={() => setDraftSelection({ bundledAssetId: asset.id, customAssetId: null })}
            type="button"
          >
            <ExerciseArt alt="" bundledAssetId={asset.id} className="aspect-square w-full" muscle={asset.muscle} />
            <span className="mt-1 line-clamp-2 min-h-8 text-xs font-extrabold leading-tight">{asset.name}</span>
          </button>
        ))}
      </div>
    </div>
    <footer className="border-t border-white/10 bg-arsen-bg2 p-3">
      <ActionButton className="w-full" disabled={disabled} onClick={() => onChange(draftSelection)} tone="acid" type="button">
        Usar imagen
      </ActionButton>
    </footer>
  </section>
</div>
```

Keep custom asset rows below the upload action so existing uploads remain selectable:

```tsx
{assets.map((asset) => (
  <button
    aria-pressed={draftSelection.customAssetId === asset.id}
    className={[
      'mt-2 grid w-full grid-cols-[44px_minmax(0,1fr)] items-center gap-3 rounded-[10px] border p-2 text-left',
      draftSelection.customAssetId === asset.id ? 'border-arsen-purple2 bg-arsen-purple/20' : 'border-white/10 bg-arsen-surface',
    ].join(' ')}
    key={asset.id}
    onClick={() => setDraftSelection({ bundledAssetId: draftSelection.bundledAssetId, customAssetId: asset.id })}
    type="button"
  >
    <ExerciseArt alt={asset.name} className="size-11" customImageSrc={asset.dataUrl} />
    <span>{asset.name}</span>
  </button>
))}
```

- [ ] **Step 4: Wire RoutinePage catalog editor**

In `RoutinePage.tsx`, change `CatalogExerciseForm` from:

```ts
assetKind: string | null
customAssetId: string | null
```

to:

```ts
bundledAssetId: string | null
customAssetId: string | null
```

Update `selectedImageLabel`:

```ts
const selectedBundledAsset = getBundledExerciseAsset(form.bundledAssetId)
const selectedImageLabel = selectedAsset?.name ?? selectedBundledAsset?.name ?? 'Auto'
```

Update preview `ExerciseArt`:

```tsx
<ExerciseArt
  alt={form.name || 'Imagen del ejercicio'}
  bundledAssetId={form.bundledAssetId}
  className="size-[52px]"
  customImageSrc={selectedAsset?.dataUrl ?? null}
  muscle={form.mainMuscle}
/>
```

Save catalog:

```ts
bundledAssetId: form.bundledAssetId,
customAssetId: form.customAssetId,
```

Render selector without nested `SheetFrame`:

```tsx
{imageSheetOpen ? (
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
```

Update `updateImageSelection` to close the sheet after `onChange`.

- [ ] **Step 5: Run selector tests**

Run: `pnpm test src/domains/routine/components/ExerciseImageSelector.test.tsx src/domains/routine/pages/RoutinePage.test.tsx`

Expected: PASS after updating test expectations from `assetKind` to `bundledAssetId`.

---

### Task 5: Replace Callers And Remove Legacy Sprite Files

**Files:**
- Modify: `src/domains/routine/pages/RoutinePage.tsx`
- Modify: `src/domains/routine/pages/RoutineDayDetailPage.tsx`
- Modify: `src/domains/workout/pages/WorkoutPage.tsx`
- Modify: `src/domains/progress/pages/ProgressPage.tsx`
- Modify: `src/domains/progress/pages/ProgressHistoryDatePage.tsx`
- Delete: `src/assets/arsen-exercise-sprite.png`
- Delete: `src/assets/arsen-muscle-groups-sprite.png`
- Test: affected page and component tests

**Interfaces:**
- Consumes: `ExerciseArt bundledAssetId/customImageSrc/muscle`
- Produces: no production rendering path uses `assetKind`

- [ ] **Step 1: Replace `ExerciseArt` props in callers**

For routine/catalog rows, replace:

```tsx
assetKind={exercise.assetKind}
```

with:

```tsx
bundledAssetId={exercise.bundledAssetId}
```

For catalog items:

```tsx
bundledAssetId={item.bundledAssetId}
```

For recipe previews where `visualReference = exercise ?? catalogItem`:

```tsx
bundledAssetId={visualReference?.bundledAssetId}
```

For workout current exercise and list:

```tsx
bundledAssetId={currentExercise?.bundledAssetId}
bundledAssetId={exercise.bundledAssetId}
```

For progress history rows, pass snapshot data when available:

```tsx
bundledAssetId={exercise.bundledAssetId}
```

If a progress repository type does not yet expose `bundledAssetId`, add it from `log.snapshot.bundledAssetId ?? null` in the returned view model.

- [ ] **Step 2: Update fixtures**

Run TypeScript or focused tests to find fixture type errors. Add `bundledAssetId: null` to every `RoutineExercise`, `ExerciseCatalogItem`, and snapshot fixture in tests.

Run: `pnpm test src/domains/routine/pages/RoutinePage.test.tsx src/domains/routine/pages/RoutineDayDetailPage.test.tsx src/domains/workout/pages/WorkoutPage.test.tsx src/shared/calculations/progression.test.ts`

Expected: PASS.

- [ ] **Step 3: Confirm no sprite references remain**

Run:

```bash
rg -n "arsen-exercise-sprite|arsen-muscle-groups-sprite|ExerciseArtKind|assetKindForExercise" src
```

Expected: no matches. Matches for `assetKind` are acceptable in types, schemas, services, tests, and import/export compatibility; matches must not be sprite rendering.

- [ ] **Step 4: Delete sprite files**

Delete:

- `src/assets/arsen-exercise-sprite.png`
- `src/assets/arsen-muscle-groups-sprite.png`

Use `apply_patch` delete hunks, not a shell delete command.

- [ ] **Step 5: Run focused render tests**

Run:

```bash
pnpm test src/shared/components/ExerciseArt.test.tsx src/domains/routine/components/ExerciseImageSelector.test.tsx src/domains/routine/pages/RoutinePage.test.tsx src/domains/routine/pages/RoutineDayDetailPage.test.tsx src/domains/workout/pages/WorkoutPage.test.tsx
```

Expected: PASS.

---

### Task 6: Import/Export Compatibility And Final Verification

**Files:**
- Modify tests only if coverage gaps remain after Tasks 1-5.
- No new production interfaces unless tests expose a missed propagation path.

**Interfaces:**
- Consumes completed `bundledAssetId` fields and schemas.
- Produces verified v2 behavior.

- [ ] **Step 1: Add routine import/export assertions**

In `src/domains/routine/importExport.test.ts`, set one exported routine exercise fixture to:

```ts
bundledAssetId: 'press-inclinado--pecho',
```

Assert imported exercises preserve the bundled reference:

```ts
expect(importedExercises[0]?.bundledAssetId).toBe('press-inclinado--pecho')
```

- [ ] **Step 2: Add full backup assertions**

In `src/domains/settings/services.test.ts` or `src/db/indexeddb.test.ts`, assert a backup import with only legacy `assetKind` still parses with `bundledAssetId: null`, and a backup import with `bundledAssetId` preserves it.

- [ ] **Step 3: Run all targeted tests**

Run:

```bash
pnpm test src/shared/assets/exerciseImages.test.ts src/shared/components/ExerciseArt.test.tsx src/domains/routine/components/ExerciseImageSelector.test.tsx src/shared/validation/arsenImportSchemas.test.ts src/db/indexeddb.test.ts src/domains/routine/importExport.test.ts src/domains/settings/services.test.ts src/domains/routine/pages/RoutinePage.test.tsx src/domains/routine/pages/RoutineDayDetailPage.test.tsx src/domains/workout/pages/WorkoutPage.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run global no-sprite check**

Run:

```bash
rg -n "arsen-exercise-sprite|arsen-muscle-groups-sprite|ExerciseArtKind|assetKindForExercise" src
```

Expected: no matches.

- [ ] **Step 5: Run Impeccable craft floor and detector**

Before final UI edits, read `C:\Users\Chovy\.agents\skills\impeccable\reference\craft-floor.md`.

After UI edits, run:

```bash
node C:\Users\Chovy\.agents\skills\impeccable\scripts\detect.mjs --json src\domains\routine\components\ExerciseImageSelector.tsx src\domains\routine\pages\RoutinePage.tsx src\shared\components\ExerciseArt.tsx
```

Expected: no blocking findings for overflow, overlap, text fit, or accessibility.

- [ ] **Step 6: Run full suite and build**

Run:

```bash
pnpm test
pnpm build
```

Expected: both PASS. `pnpm build` must complete `tsc -b`, Vite build, and `node scripts/generate-sw.mjs`.

- [ ] **Step 7: Review diff without committing**

Run:

```bash
git status --short
git diff --stat
```

Report changed files and verification results to the user. Do not stage or commit unless the user explicitly approves that git operation.
