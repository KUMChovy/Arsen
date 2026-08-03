# Generalizar Imagenes De Ejercicios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a catalog-driven exercise image system with included sprite choices, custom offline uploads, stable fallback rendering, and preservation through routine/workout/import/export flows.

**Architecture:** Add one IndexedDB table, `exerciseAssets`, for custom image `dataUrl` rows. Copy visual references (`assetKind`, `customAssetId`) from catalog items into routine exercises and workout snapshots so views do not infer art from `mainMuscle` when an explicit image exists. Keep rendering centralized in `ExerciseArt`, with pages only passing visual reference data and asset maps.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Dexie, dexie-react-hooks, zod, Vitest, Testing Library.

## Global Constraints

- UI strings stay Spanish (`es-MX`).
- App remains 100% offline and backend-free.
- Storage lives in IndexedDB; no external image APIs.
- Recommended custom image framing copy: `512 x 512 px`, square, centered subject, `48-64 px` visual margin.
- Fallback order: custom image, valid `assetKind`, normalized `mainMuscle`, safe `press`.
- Mobile cards must stay stable down to 360px, with fixed art columns and truncated text.
- Do not add dependencies.
- Do not commit without explicit human confirmation.

---

## File Structure

- Modify `src/domains/routine/types.ts`: add `ExerciseAsset`, `assetKind`, and `customAssetId` fields.
- Modify `src/domains/workout/types.ts`: add visual fields to `ExerciseSnapshot`.
- Modify `src/db/schema.ts`: bump schema to version 6, add `exerciseAssets` table, migrate visual defaults.
- Modify `src/shared/validation/arsenImportSchemas.ts`: validate new asset table and optional visual fields.
- Modify `src/domains/routine/services.ts`: create/update catalog visual fields, save/delete custom assets, copy visual refs into routine exercises.
- Modify `src/domains/workout/services.ts`: snapshot visual refs when creating exercise logs.
- Modify `src/domains/routine/repository.ts` and `src/domains/routine/hooks.ts`: expose custom assets to UI.
- Modify `src/shared/components/ExerciseArt.tsx`: central visual resolver and rendering.
- Create `src/domains/routine/components/ExerciseImageSelector.tsx`: visual selector/upload UI for catalog editor.
- Modify `src/domains/routine/pages/RoutinePage.tsx`: wire selector, catalog previews, recipe previews, and routine rows.
- Modify `src/domains/routine/pages/RoutineDayDetailPage.tsx`: use copied visual refs and asset map.
- Modify `src/domains/workout/pages/WorkoutPage.tsx`: remove `artForExercise`, use copied visual refs and asset map.
- Modify `src/domains/routine/importExport.ts`: include used custom assets in routine exports and remap on import.
- Modify `src/domains/settings/services.ts`: include `exerciseAssets` in full backup import/export.
- Modify tests in `src/db/indexeddb.test.ts`, `src/shared/validation/arsenImportSchemas.test.ts`, `src/shared/components/ExerciseArt.test.tsx`, and page tests touched by new required type fields.

---

### Task 1: Data Types, Schema, And Validation

**Files:**
- Modify: `src/domains/routine/types.ts`
- Modify: `src/domains/workout/types.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/shared/validation/arsenImportSchemas.ts`
- Test: `src/shared/validation/arsenImportSchemas.test.ts`

**Interfaces:**
- Produces: `ExerciseAsset`
- Produces: `RoutineExercise.assetKind: string | null`
- Produces: `RoutineExercise.customAssetId: string | null`
- Produces: `ExerciseCatalogItem.customAssetId: string | null`
- Produces: `ExerciseSnapshot.assetKind?: string | null`
- Produces: `ExerciseSnapshot.customAssetId?: string | null`

- [ ] **Step 1: Add failing validation tests**

Add this test to `src/shared/validation/arsenImportSchemas.test.ts`:

```ts
it('accepts visual asset fields and custom exercise assets', () => {
  const result = backupSchema.safeParse({
    tables: {
      exerciseAssets: [
        {
          createdAt: '2026-01-01T00:00:00.000Z',
          dataUrl: 'data:image/png;base64,AAAA',
          id: 'asset-1',
          mimeType: 'image/png',
          name: 'press.png',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      exerciseCatalog: [
        {
          aliases: [],
          assetKind: 'row',
          canonicalName: 'remo-barra',
          createdAt: '2026-01-01T00:00:00.000Z',
          customAssetId: 'asset-1',
          defaultRecommendedRir: 2,
          defaultRepsMax: 10,
          defaultRepsMin: 8,
          defaultRestSeconds: 120,
          defaultTargetSets: 4,
          equipment: 'Barra',
          id: 'catalog-1',
          mainMuscle: 'Espalda',
          name: 'Remo barra',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      routineExercises: [
        {
          ...exercise,
          assetKind: 'row',
          customAssetId: 'asset-1',
        },
      ],
      exerciseLogs: [
        {
          createdAt: '2026-01-01T00:00:00.000Z',
          id: 'exercise-log-1',
          notes: '',
          routineExerciseId: 'exercise-1',
          sessionId: 'session-1',
          snapshot: {
            assetKind: 'row',
            canonicalName: 'remo-barra',
            customAssetId: 'asset-1',
            equipment: 'Barra',
            mainMuscle: 'Espalda',
            name: 'Remo barra',
            recommendedRir: 2,
            restSeconds: 120,
            targetSets: 4,
          },
          state: 'done',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    },
  })

  expect(result.success).toBe(true)
})
```

Also extend the existing legacy-defaults test to assert:

```ts
expect(result.data.tables.routineExercises[0]).toMatchObject({
  assetKind: null,
  customAssetId: null,
})
```

- [ ] **Step 2: Run validation tests to verify failure**

Run: `pnpm test src/shared/validation/arsenImportSchemas.test.ts`

Expected: FAIL because `exerciseAssets` and visual defaults are not defined.

- [ ] **Step 3: Add types**

In `src/domains/routine/types.ts`, add:

```ts
export type ExerciseAsset = {
  id: string
  name: string
  mimeType: string
  dataUrl: string
  createdAt: string
  updatedAt: string
}
```

Add to `RoutineExercise`:

```ts
assetKind: string | null
customAssetId: string | null
```

Add to `ExerciseCatalogItem`:

```ts
customAssetId: string | null
```

In `src/domains/workout/types.ts`, add to `ExerciseSnapshot`:

```ts
assetKind?: string | null
customAssetId?: string | null
```

- [ ] **Step 4: Add schema version 6**

In `src/db/schema.ts`, import `ExerciseAsset`, add:

```ts
exerciseAssets!: Table<ExerciseAsset, string>
```

Bump:

```ts
export const CURRENT_SCHEMA_VERSION = 6
```

Add `exerciseAssets: 'id, updatedAt'` to every `.stores(...)` block so fresh databases know the table, and add:

```ts
this.version(6)
  .stores({
    settings: 'id, activeRoutineId, preferredUnit',
    routines: 'id, isActive, name, updatedAt',
    routineDays: 'id, routineId, [routineId+order], weekday',
    routineExercises: 'id, routineId, dayId, canonicalName, [dayId+order], sourceExerciseId',
    exerciseCatalog: 'id, canonicalName, mainMuscle, equipment',
    exerciseAssets: 'id, updatedAt',
    weeklyVolumeTargets: 'id, routineId, muscle',
    workoutSessions: 'id, routineId, dayId, date, [date+routineId], [date+dayId]',
    exerciseLogs: 'id, sessionId, routineExerciseId, state',
    setLogs: 'id, exerciseLogId, kind, [exerciseLogId+order]',
    dropSetLogs: 'id, setLogId, [setLogId+order]',
    skipLogs: 'id, sessionId, routineExerciseId',
  })
  .upgrade((tx) =>
    Promise.all([
      tx
        .table('exerciseCatalog')
        .toCollection()
        .modify((item) => {
          item.assetKind = typeof item.assetKind === 'string' ? item.assetKind : null
          item.customAssetId = typeof item.customAssetId === 'string' ? item.customAssetId : null
        }),
      tx
        .table('routineExercises')
        .toCollection()
        .modify((item) => {
          item.assetKind = typeof item.assetKind === 'string' ? item.assetKind : null
          item.customAssetId = typeof item.customAssetId === 'string' ? item.customAssetId : null
        }),
      tx
        .table('exerciseLogs')
        .toCollection()
        .modify((log) => {
          log.snapshot.assetKind = typeof log.snapshot.assetKind === 'string' ? log.snapshot.assetKind : null
          log.snapshot.customAssetId = typeof log.snapshot.customAssetId === 'string' ? log.snapshot.customAssetId : null
        }),
    ]),
  )
```

- [ ] **Step 5: Add import validation**

In `src/shared/validation/arsenImportSchemas.ts`, add:

```ts
export const exerciseAssetSchema = z
  .object({
    createdAt: z.string(),
    dataUrl: z.string().startsWith('data:image/'),
    id: z.string().min(1),
    mimeType: z.string().startsWith('image/'),
    name: z.string(),
    updatedAt: z.string(),
  })
  .passthrough()
```

Add optional defaults:

```ts
assetKind: z.string().nullable().optional().default(null),
customAssetId: z.string().nullable().optional().default(null),
```

to `routineExerciseSchema`, `exerciseCatalogItemSchema`, and the snapshot object in `exerciseLogSchema`.

Add backup table:

```ts
exerciseAssets: z.array(exerciseAssetSchema).optional().default([]),
```

- [ ] **Step 6: Run validation tests**

Run: `pnpm test src/shared/validation/arsenImportSchemas.test.ts`

Expected: PASS.

---

### Task 2: Services Preserve And Copy Visual References

**Files:**
- Modify: `src/domains/routine/services.ts`
- Modify: `src/domains/workout/services.ts`
- Modify: `src/db/seedDemoRoutine.ts`
- Test: `src/db/indexeddb.test.ts`

**Interfaces:**
- Consumes: `ExerciseAsset`, `assetKind`, `customAssetId`
- Produces: `createExerciseAsset(input): Promise<string>`
- Produces: copied visual fields on catalog, routine exercise, and workout snapshot.

- [ ] **Step 1: Add failing DB tests**

In `src/db/indexeddb.test.ts`, extend imports:

```ts
import { addCatalogExerciseToDay, createCatalogExercise, createExerciseAsset, updateCatalogExercise } from '../domains/routine/services'
```

Add:

```ts
it('copies catalog visual references into day recipes and workout snapshots', async () => {
  const routineA = routine('routine-a', 'Rutina A')
  const dayA = routineDay('day-a', routineA.id, 'Dia A')
  await db.routines.put(routineA)
  await db.routineDays.put(dayA)

  const customAssetId = await createExerciseAsset({
    dataUrl: 'data:image/png;base64,AAAA',
    mimeType: 'image/png',
    name: 'remo.png',
  })
  const catalogItemId = await createCatalogExercise({
    assetKind: 'row',
    customAssetId,
    equipment: 'Barra',
    mainMuscle: 'Espalda',
    name: 'Remo barra',
  })

  const exerciseId = await addCatalogExerciseToDay(routineA.id, dayA.id, catalogItemId)
  const exercise = await db.routineExercises.get(exerciseId)

  expect(exercise).toMatchObject({
    assetKind: 'row',
    customAssetId,
  })

  const registered = await registerMainSetForExercise({
    date: '2026-08-02',
    dayId: dayA.id,
    displayUnit: 'kg',
    exercise: exercise!,
    reps: 8,
    rir: 2,
    routineId: routineA.id,
    weightKg: 70,
  })

  await expect(db.exerciseLogs.get(registered.exerciseLogId)).resolves.toMatchObject({
    snapshot: {
      assetKind: 'row',
      customAssetId,
    },
  })
})
```

Add:

```ts
it('preserves catalog visual reference when editing catalog metadata', async () => {
  const customAssetId = await createExerciseAsset({
    dataUrl: 'data:image/png;base64,BBBB',
    mimeType: 'image/png',
    name: 'press.png',
  })
  const catalogItemId = await createCatalogExercise({
    assetKind: 'press',
    customAssetId,
    equipment: 'Barra',
    mainMuscle: 'Pecho',
    name: 'Press banca',
  })

  await updateCatalogExercise(catalogItemId, {
    equipment: 'Barra',
    mainMuscle: 'Pecho',
    name: 'Press banca pausado',
  })

  await expect(db.exerciseCatalog.get(catalogItemId)).resolves.toMatchObject({
    assetKind: 'press',
    customAssetId,
    name: 'Press banca pausado',
  })
})
```

- [ ] **Step 2: Run DB tests to verify failure**

Run: `pnpm test src/db/indexeddb.test.ts`

Expected: FAIL because service methods and copied fields are missing.

- [ ] **Step 3: Add routine service inputs and asset services**

In `src/domains/routine/services.ts`, import `ExerciseAsset` and add:

```ts
export type ExerciseAssetInput = Pick<ExerciseAsset, 'dataUrl' | 'mimeType' | 'name'>
```

Extend `ExerciseInput` and `CatalogExerciseInput`:

```ts
assetKind?: string | null
customAssetId?: string | null
```

Add:

```ts
export async function createExerciseAsset(input: ExerciseAssetInput) {
  const now = new Date().toISOString()
  const asset: ExerciseAsset = {
    createdAt: now,
    dataUrl: input.dataUrl,
    id: createId('exercise-asset'),
    mimeType: input.mimeType,
    name: input.name.trim() || 'Imagen de ejercicio',
    updatedAt: now,
  }

  await db.exerciseAssets.add(asset)

  return asset.id
}

```

- [ ] **Step 4: Preserve visual refs in catalog services**

In `createCatalogExercise`, set:

```ts
assetKind: input.assetKind ?? null,
customAssetId: input.customAssetId ?? null,
```

In `updateCatalogExercise`, preserve only when the property is omitted. `null` means the user chose Auto or removed the custom image:

```ts
assetKind: input.assetKind === undefined ? existing?.assetKind ?? null : input.assetKind,
customAssetId: input.customAssetId === undefined ? existing?.customAssetId ?? null : input.customAssetId,
```

- [ ] **Step 5: Copy visual refs into routine exercises**

In `createExercise`, set:

```ts
assetKind: input.assetKind ?? null,
customAssetId: input.customAssetId ?? null,
```

In `addCatalogExerciseToDay`, set:

```ts
assetKind: catalogItem.assetKind ?? null,
customAssetId: catalogItem.customAssetId ?? null,
```

In `updateExercise`, preserve existing fields unless explicitly supplied. `null` clears the explicit visual reference:

```ts
assetKind: input.assetKind === undefined ? existing?.assetKind ?? null : input.assetKind,
customAssetId: input.customAssetId === undefined ? existing?.customAssetId ?? null : input.customAssetId,
```

- [ ] **Step 6: Snapshot visual refs**

In `src/domains/workout/services.ts`, add to `snapshot` in `ensureExerciseLog`:

```ts
assetKind: exercise.assetKind,
customAssetId: exercise.customAssetId,
```

- [ ] **Step 7: Seed demo routine refs**

In `src/db/seedDemoRoutine.ts`, add to each `routineExercises` row:

```ts
assetKind: assetKindForExercise(exercise.canonicalName),
customAssetId: null,
```

Add to each catalog row:

```ts
customAssetId: null,
```

- [ ] **Step 8: Run DB tests**

Run: `pnpm test src/db/indexeddb.test.ts`

Expected: PASS.

---

### Task 3: ExerciseArt Resolver And Tests

**Files:**
- Modify: `src/shared/components/ExerciseArt.tsx`
- Create: `src/shared/components/ExerciseArt.test.tsx`

**Interfaces:**
- Consumes: `assetKind?: string | null`
- Consumes: `customImageSrc?: string | null`
- Consumes: `muscle?: string`
- Produces: valid fallback rendering without callers using `artForExercise`.

- [ ] **Step 1: Add component tests**

Create `src/shared/components/ExerciseArt.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ExerciseArt } from './ExerciseArt'

describe('ExerciseArt', () => {
  it('uses a custom image before assetKind and muscle fallback', () => {
    render(<ExerciseArt alt="Remo" assetKind="press" customImageSrc="data:image/png;base64,AAAA" muscle="Pecho" />)

    const art = screen.getByRole('img', { name: 'Remo' })

    expect(art).toHaveStyle({ backgroundImage: 'url(data:image/png;base64,AAAA)' })
  })

  it('uses a valid assetKind before muscle fallback', () => {
    render(<ExerciseArt alt="Remo" assetKind="row" muscle="Pecho" />)

    const art = screen.getByRole('img', { name: 'Remo' })

    expect(art.getAttribute('style')).toContain('40% 50%')
  })

  it('falls back to normalized muscle art when assetKind is unknown', () => {
    render(<ExerciseArt alt="Dominante" assetKind="unknown" muscle="Piernas" />)

    const art = screen.getByRole('img', { name: 'Dominante' })

    expect(art.getAttribute('style')).toContain('100% 50%')
  })
})
```

- [ ] **Step 2: Run component tests to verify failure**

Run: `pnpm test src/shared/components/ExerciseArt.test.tsx`

Expected: FAIL because props are not implemented.

- [ ] **Step 3: Update ExerciseArt props and resolver**

In `src/shared/components/ExerciseArt.tsx`, replace props with:

```ts
type ExerciseArtProps = {
  alt: string
  assetKind?: string | null
  className?: string
  customImageSrc?: string | null
  muscle?: string | null
}
```

Add:

```ts
function isExerciseArtKind(value: string | null | undefined): value is ExerciseArtKind {
  return typeof value === 'string' && value in positions
}
```

Resolve:

```ts
const normalizedMuscle = muscle ? normalizeMuscleGroup(muscle) : null
const resolvedKind = isExerciseArtKind(assetKind) ? assetKind : null
const backgroundImage = customImageSrc
  ? `url(${customImageSrc})`
  : `url(${resolvedKind || !normalizedMuscle ? exerciseSprite : muscleSprite})`
```

Use style:

```ts
backgroundPosition: customImageSrc ? 'center' : resolvedKind ? positions[resolvedKind] : normalizedMuscle ? musclePositions[normalizedMuscle] : positions.press,
backgroundSize: customImageSrc ? 'cover' : resolvedKind ? '600% 100%' : '640% 108%',
```

Keep stable classes:

```ts
'size-[66px] shrink-0 overflow-hidden rounded-[10px] border border-arsen-purple/40 bg-arsen-bg2 bg-no-repeat shadow-[inset_0_0_18px_rgb(153_83_255_/_0.18)]'
```

- [ ] **Step 4: Run component tests**

Run: `pnpm test src/shared/components/ExerciseArt.test.tsx`

Expected: PASS.

---

### Task 4: Repositories, Hooks, And UI Wiring

**Files:**
- Modify: `src/domains/routine/repository.ts`
- Modify: `src/domains/routine/hooks.ts`
- Create: `src/domains/routine/components/ExerciseImageSelector.tsx`
- Modify: `src/domains/routine/pages/RoutinePage.tsx`
- Modify: `src/domains/routine/pages/RoutineDayDetailPage.tsx`
- Modify: `src/domains/workout/pages/WorkoutPage.tsx`
- Test: `src/domains/workout/pages/WorkoutPage.test.tsx`
- Test: `src/domains/routine/pages/RoutineDayDetailPage.test.tsx`

**Interfaces:**
- Consumes: `useExerciseAssets(): ExerciseAsset[] | undefined`
- Consumes: `ExerciseArt assetKind/customImageSrc/muscle`
- Produces: catalog image selector with upload and stable previews.

- [ ] **Step 1: Add hook and repository method**

In `src/domains/routine/repository.ts`:

```ts
export async function getExerciseAssets() {
  return db.exerciseAssets.orderBy('updatedAt').reverse().toArray()
}
```

In `src/domains/routine/hooks.ts`:

```ts
import { getExerciseAssets } from './repository'

export function useExerciseAssets() {
  return useLiveQuery(() => getExerciseAssets(), [], undefined)
}
```

- [ ] **Step 2: Create image selector component**

Create `src/domains/routine/components/ExerciseImageSelector.tsx` with these exports:

```tsx
import { ImagePlus, X } from 'lucide-react'
import { ExerciseArt, type ExerciseArtKind } from '../../../shared/components/ExerciseArt'
import type { ExerciseAsset, MuscleGroup } from '../types'

export type ExerciseImageSelection = {
  assetKind: string | null
  customAssetId: string | null
}

type ExerciseImageSelectorProps = {
  assets: ExerciseAsset[]
  disabled: boolean
  error: string | null
  mainMuscle: MuscleGroup
  onChange: (selection: ExerciseImageSelection) => void
  onUpload: (file: File) => void
  selection: ExerciseImageSelection
}

const includedOptions: Array<{ label: string; value: ExerciseArtKind | null }> = [
  { label: 'Auto', value: null },
  { label: 'Press', value: 'press' },
  { label: 'Pec deck', value: 'pecDeck' },
  { label: 'Remo', value: 'row' },
  { label: 'Hack', value: 'hackSquat' },
  { label: 'Jalon', value: 'latPulldown' },
  { label: 'Hombro', value: 'shoulderPress' },
]
```

The component renders:

```tsx
<section className="space-y-2 rounded-[12px] border border-white/10 bg-arsen-bg/45 p-3">
  <div>
    <div className="text-xs font-extrabold text-arsen-muted">Imagen</div>
    <p className="mt-1 text-xs font-semibold text-arsen-muted">
      Recomendado: 512 x 512 px, sujeto centrado y margen de 48-64 px.
    </p>
  </div>
  <div className="grid grid-cols-4 gap-2">
    {includedOptions.map((option) => (
      <button
        className={[
          'min-w-0 rounded-[10px] border p-1.5 text-xs font-bold',
          selection.assetKind === option.value && !selection.customAssetId
            ? 'border-arsen-purple2 bg-arsen-purple/30 text-arsen-ink'
            : 'border-white/10 bg-arsen-surface text-arsen-muted',
        ].join(' ')}
        disabled={disabled}
        key={option.label}
        onClick={() => onChange({ assetKind: option.value, customAssetId: null })}
        type="button"
      >
        <ExerciseArt alt={option.label} assetKind={option.value} className="mx-auto size-11" muscle={mainMuscle} />
        <span className="mt-1 block truncate">{option.label}</span>
      </button>
    ))}
  </div>
  <label className="grid min-h-12 cursor-pointer grid-cols-[36px_1fr] items-center gap-2 rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-bold text-arsen-purple2">
    <ImagePlus aria-hidden="true" className="size-5" />
    <span>Subir imagen propia</span>
    <input
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
  {assets.map((asset) => (
    <button
      className={[
        'grid w-full grid-cols-[52px_1fr_auto] items-center gap-3 rounded-[10px] border p-2 text-left',
        selection.customAssetId === asset.id ? 'border-arsen-purple2 bg-arsen-purple/20' : 'border-white/10 bg-arsen-surface',
      ].join(' ')}
      disabled={disabled}
      key={asset.id}
      onClick={() => onChange({ assetKind: selection.assetKind, customAssetId: asset.id })}
      type="button"
    >
      <ExerciseArt alt={asset.name} className="size-[52px]" customImageSrc={asset.dataUrl} />
      <span className="min-w-0 truncate text-sm font-extrabold">{asset.name}</span>
      <span className="text-xs font-bold text-arsen-purple2">Usar</span>
    </button>
  ))}
  {selection.customAssetId ? (
    <button
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] border border-white/10 px-3 text-xs font-extrabold text-arsen-muted"
      disabled={disabled}
      onClick={() => onChange({ assetKind: selection.assetKind, customAssetId: null })}
      type="button"
    >
      <X aria-hidden="true" className="size-4" />
      Quitar imagen propia
    </button>
  ) : null}
  {error ? <p className="text-xs font-bold text-red-300">{error}</p> : null}
</section>
```

- [ ] **Step 3: Wire RoutinePage data**

In `RoutinePage.tsx`, import:

```ts
import { ExerciseImageSelector, type ExerciseImageSelection } from '../components/ExerciseImageSelector'
import { createExerciseAsset } from '../services'
import { useExerciseAssets } from '../hooks'
```

Inside `RoutinePage`, add:

```ts
const exerciseAssets = useExerciseAssets() ?? []
const imageSrcByAssetId = useMemo(() => new Map(exerciseAssets.map((asset) => [asset.id, asset.dataUrl])), [exerciseAssets])
```

Pass `exerciseAssets` and `imageSrcByAssetId` into `CatalogPanel`, `CatalogPickerSheet`, `CatalogExerciseEditorSheet`, `RoutineExerciseRecipeSheet`, and row components that render `ExerciseArt`.

- [ ] **Step 4: Extend catalog form**

Add to `CatalogExerciseForm`:

```ts
assetKind: string | null
customAssetId: string | null
```

In `catalogItemToForm`:

```ts
assetKind: item?.assetKind ?? null,
customAssetId: item?.customAssetId ?? null,
```

When saving catalog:

```ts
assetKind: form.assetKind,
customAssetId: form.customAssetId,
```

- [ ] **Step 5: Add upload handler in catalog editor**

Inside `CatalogExerciseEditorSheet`:

```ts
const [imageError, setImageError] = useState<string | null>(null)
const maxImageBytes = 2 * 1024 * 1024

async function uploadCustomImage(file: File) {
  setImageError(null)
  if (!file.type.startsWith('image/')) {
    setImageError('Sube un archivo de imagen.')
    return
  }
  if (file.size > maxImageBytes) {
    setImageError('Usa una imagen de hasta 2 MB.')
    return
  }
  const dataUrl = await readFileAsDataUrl(file)
  const customAssetId = await createExerciseAsset({
    dataUrl,
    mimeType: file.type,
    name: file.name,
  })
  setForm((current) => ({ ...current, customAssetId }))
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result ?? '')))
    reader.addEventListener('error', () => reject(new Error('No se pudo leer la imagen')))
    reader.readAsDataURL(file)
  })
}
```

Render `ExerciseImageSelector` after muscle/equipment fields:

```tsx
<ExerciseImageSelector
  assets={assets}
  disabled={disabled}
  error={imageError}
  mainMuscle={form.mainMuscle}
  onChange={(selection) => setForm((current) => ({ ...current, ...selection }))}
  onUpload={(file) => {
    uploadCustomImage(file).catch((error: unknown) => {
      setImageError(error instanceof Error ? error.message : 'No se pudo cargar la imagen')
    })
  }}
  selection={{ assetKind: form.assetKind, customAssetId: form.customAssetId }}
/>
```

- [ ] **Step 6: Replace image calls**

Replace row calls like:

```tsx
<ExerciseArt alt={exercise.name} className="size-[52px]" muscle={exercise.mainMuscle} />
```

with:

```tsx
<ExerciseArt
  alt={exercise.name}
  assetKind={exercise.assetKind}
  className="size-[52px]"
  customImageSrc={exercise.customAssetId ? imageSrcByAssetId.get(exercise.customAssetId) : null}
  muscle={exercise.mainMuscle}
/>
```

For catalog items:

```tsx
<ExerciseArt
  alt={item.name}
  assetKind={item.assetKind}
  className="size-[52px]"
  customImageSrc={item.customAssetId ? imageSrcByAssetId.get(item.customAssetId) : null}
  muscle={item.mainMuscle}
/>
```

In `WorkoutPage.tsx`, remove `artForExercise` and the `ExerciseArtKind` import.

- [ ] **Step 7: Run focused UI tests**

Run:

```bash
pnpm test src/domains/workout/pages/WorkoutPage.test.tsx src/domains/routine/pages/RoutineDayDetailPage.test.tsx
```

Expected: PASS after fixture types include `assetKind: null` and `customAssetId: null`.

---

### Task 5: Import, Export, And Backup Preservation

**Files:**
- Modify: `src/domains/routine/importExport.ts`
- Modify: `src/domains/settings/services.ts`
- Test: `src/db/indexeddb.test.ts`

**Interfaces:**
- Consumes: `ExerciseAsset`
- Produces: routine export payload with `exerciseAssets: ExerciseAsset[]`
- Produces: backup import/export with `exerciseAssets`.

- [ ] **Step 1: Add failing integration tests**

In `src/db/indexeddb.test.ts`, extend `backupFile` type:

```ts
exerciseAssets?: ExerciseAsset[]
```

Add import for `ExerciseAsset`.

Extend the local `catalogExercise` helper override type:

```ts
function catalogExercise(
  overrides: Partial<Pick<ExerciseCatalogItem, 'customAssetId' | 'technicalNotes' | 'warmupProtocol'>> = {},
): ExerciseCatalogItem {
```

and include:

```ts
customAssetId: overrides.customAssetId ?? null,
```

Add:

```ts
it('imports custom exercise assets from full backup', async () => {
  await importFullBackup(
    backupFile({
      exerciseAssets: [
        {
          createdAt: now,
          dataUrl: 'data:image/png;base64,CCCC',
          id: 'asset-1',
          mimeType: 'image/png',
          name: 'sentadilla.png',
          updatedAt: now,
        },
      ],
      exerciseCatalog: [catalogExercise({ customAssetId: 'asset-1' })],
    }),
    'replace',
  )

  await expect(db.exerciseAssets.get('asset-1')).resolves.toMatchObject({
    dataUrl: 'data:image/png;base64,CCCC',
  })
  await expect(db.exerciseCatalog.get('catalog-1')).resolves.toMatchObject({
    customAssetId: 'asset-1',
  })
})
```

- [ ] **Step 2: Run DB tests to verify failure**

Run: `pnpm test src/db/indexeddb.test.ts`

Expected: FAIL because backup import/export ignores `exerciseAssets`.

- [ ] **Step 3: Wire full backup**

In `src/domains/settings/services.ts`:

Import `ExerciseAsset`.

In `exportFullBackup`, add:

```ts
exerciseAssets: await db.exerciseAssets.toArray(),
```

In transaction table list, add `db.exerciseAssets`.

In `clearBackupTables`, add:

```ts
db.exerciseAssets.clear(),
```

In `putBackupTables`, add:

```ts
db.exerciseAssets.bulkPut(tables.exerciseAssets ?? []),
```

In `BackupTables`, add:

```ts
exerciseAssets?: ExerciseAsset[]
```

- [ ] **Step 4: Wire routine export/import assets**

In `src/domains/routine/importExport.ts`, import `ExerciseAsset`.

Extend `RoutineExport`:

```ts
exerciseAssets: ExerciseAsset[]
```

In `exportRoutineJson`, after loading exercises:

```ts
const exercises = (await db.routineExercises.where('routineId').equals(routineId).sortBy('order')).map(cleanExerciseForTransfer)
const customAssetIds = [...new Set(exercises.map((exercise) => exercise.customAssetId).filter((id): id is string => Boolean(id)))]
const exerciseAssets = customAssetIds.length > 0 ? await db.exerciseAssets.where('id').anyOf(customAssetIds).toArray() : []
```

Use `exercises` and `exerciseAssets` in the data object.

In `importRoutineJson`, remap imported asset IDs:

```ts
const assetIdBySource = new Map<string, string>()
const exerciseAssets = parsed.exerciseAssets.map((asset): ExerciseAsset => {
  const nextAssetId = createId('exercise-asset')
  assetIdBySource.set(asset.id, nextAssetId)
  return {
    ...asset,
    id: nextAssetId,
    createdAt: now,
    updatedAt: now,
  }
})
```

When mapping exercises:

```ts
customAssetId: exercise.customAssetId ? assetIdBySource.get(exercise.customAssetId) ?? exercise.customAssetId : null,
```

Add `db.exerciseAssets` to the import transaction and `bulkAdd(exerciseAssets)`.

In `parseRoutineExport`, return:

```ts
exerciseAssets: (data.exerciseAssets ?? []) as ExerciseAsset[],
```

- [ ] **Step 5: Update validation for routine export assets**

In `routineExportSchema`, add:

```ts
exerciseAssets: z.array(exerciseAssetSchema).optional().default([]),
```

- [ ] **Step 6: Run DB tests**

Run: `pnpm test src/db/indexeddb.test.ts src/shared/validation/arsenImportSchemas.test.ts`

Expected: PASS.

---

### Task 6: Visual Polish, Detector, And Full Verification

**Files:**
- Modify any UI files flagged by local checks.
- No new production interfaces.

**Interfaces:**
- Consumes completed Tasks 1-5.
- Produces verified implementation.

- [ ] **Step 1: Run Impeccable craft floor before final UI edits**

Read `C:\Users\Chovy\.agents\skills\impeccable\reference\craft-floor.md` before UI edits in the execution session.

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm test src/shared/components/ExerciseArt.test.tsx src/db/indexeddb.test.ts src/shared/validation/arsenImportSchemas.test.ts src/domains/workout/pages/WorkoutPage.test.tsx src/domains/routine/pages/RoutineDayDetailPage.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 4: Run build**

Run: `pnpm build`

Expected: PASS, including service worker generation.

- [ ] **Step 5: Run Impeccable detector**

Run:

```bash
node C:\Users\Chovy\.agents\skills\impeccable\scripts\detect.mjs --json src\shared\components\ExerciseArt.tsx src\domains\routine\components\ExerciseImageSelector.tsx src\domains\routine\pages\RoutinePage.tsx src\domains\routine\pages\RoutineDayDetailPage.tsx src\domains\workout\pages\WorkoutPage.tsx
```

Expected: no blocking findings. Fix concrete overlap, text-fit, accessibility, or unstable-card findings once.

- [ ] **Step 6: Manual checklist**

Verify against acceptance criteria:

```md
- [ ] `/rutina` catalog rows, day rows, and recipe previews use catalog/custom image before muscle fallback.
- [ ] `/entreno` current exercise and exercise list use `RoutineExercise.assetKind/customAssetId`.
- [ ] Unknown/missing visual refs fall back to muscle, then `press`.
- [ ] Creating/editing catalog preserves selected image.
- [ ] Adding from catalog to a day copies visual refs.
- [ ] Duplicating routine/day/exercise keeps visual refs.
- [ ] Full backup import/export includes `exerciseAssets`.
- [ ] Routine import/export includes used custom assets and remaps IDs.
- [ ] Mobile cards keep fixed image columns and truncation.
```

- [ ] **Step 7: Prepare commit request**

Do not commit. Stage only after human approval. Report changed files, tests run, and ask whether to stage/commit.
