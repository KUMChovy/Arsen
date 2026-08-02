# Equipment Load Calculation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-exercise load interpretation so Arsen can explain barbell disks, estimated bar total, and per-side load while preserving `Polea` compatibility.

**Architecture:** Keep load rules in one pure helper under `shared/calculations`, then make routine/catalog services and import validation normalize data before UI consumes it. UI reads computed labels from the helper; components do not duplicate math.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Dexie, Zod, Vitest, Testing Library.

## Global Constraints

- Do not run `git commit` or `git push`; the repo instructions override the writing-plans default commit steps.
- Storage weight is always kg; UI converts to lb through `shared/utils/weight.ts`.
- UI strings are Spanish (`es-MX`) and should stay compact for a mobile-first workout flow.
- `AppShell` constrains content to `max-w-[430px]`; new UI must work down to 360px.
- Use Tailwind theme tokens from `src/styles.css`; do not add raw hex/oklch in components.
- Cross-domain code goes through domain services/hooks; repositories own Dexie access.
- Historical workout snapshots must remain readable even if routine exercises change later.
- No new dependencies.

---

## File Structure

- Create `src/shared/calculations/equipmentLoad.ts`: equipment normalization, defaults, and load note calculation.
- Create `src/shared/calculations/equipmentLoad.test.ts`: unit coverage for compatibility, defaults, kg/lb, barbell, split, and single-point behavior.
- Modify `src/domains/routine/types.ts`: add `LoadMode`, rename `Equipment`, add load fields.
- Modify `src/domains/workout/types.ts`: add optional snapshot load fields for new logs while keeping legacy logs valid.
- Modify `src/db/schema.ts`: bump schema version and migrate routine/catalog load fields plus legacy `Polea`.
- Modify `src/shared/validation/arsenImportSchemas.ts`: accept legacy `Polea`, normalize equipment, default load fields.
- Modify `src/domains/routine/services.ts`: normalize equipment and apply load defaults on create/update/add-from-catalog.
- Modify `src/domains/routine/importExport.ts`: strip/normalize legacy load data during routine import/export.
- Modify `src/db/seedDemoRoutine.ts`: seed `Maquina de polea` and load defaults.
- Modify `src/shared/calculations/progression.ts` and tests: use normalized equipment for suggestion labels.
- Modify `src/domains/routine/pages/RoutinePage.tsx`: add load controls to catalog and recipe sheets.
- Modify `src/domains/workout/pages/WorkoutPage.tsx`: show the current-exercise load note.
- Modify `src/domains/workout/components/RegisterSetSheet.tsx`: show live load note based on the entered weight.
- Modify tests in `src/domains/workout/pages/WorkoutPage.test.tsx`, `src/domains/workout/components/RegisterSetSheet.test.tsx`, `src/shared/validation/arsenImportSchemas.test.ts`, and `src/db/indexeddb.test.ts`.

---

### Task 1: Pure Equipment Load Helper

**Files:**
- Create: `src/shared/calculations/equipmentLoad.ts`
- Create: `src/shared/calculations/equipmentLoad.test.ts`
- Modify: `src/domains/routine/types.ts`
- Modify: `src/domains/workout/types.ts`

**Interfaces:**
- Produces: `type LoadMode = 'single' | 'split'`
- Produces: `type Equipment = 'Barra' | 'Mancuerna' | 'Maquina' | 'Maquina de polea' | 'Peso corporal' | 'Otro'`
- Produces: `normalizeEquipment(value: unknown): Equipment`
- Produces: `defaultLoadSettingsForEquipment(equipment: Equipment): { loadMode: LoadMode; barWeightKg: number }`
- Produces: `loadSettingsForEquipment(input: { equipment: unknown; loadMode?: LoadMode | null; barWeightKg?: number | null }): { equipment: Equipment; loadMode: LoadMode; barWeightKg: number }`
- Produces: `buildEquipmentLoadNote(input: { equipment: unknown; loadMode?: LoadMode | null; barWeightKg?: number | null; weightKg: number; unit: WeightUnit }): string | null`
- Consumes: `formatWeight(valueKg, unit)` from `src/shared/utils/weight.ts`

- [ ] **Step 1: Update routine and workout types**

Add `LoadMode` and new fields to `src/domains/routine/types.ts`:

```ts
export type Equipment = 'Barra' | 'Mancuerna' | 'Maquina' | 'Maquina de polea' | 'Peso corporal' | 'Otro'
export type LoadMode = 'single' | 'split'

export type RoutineExercise = {
  // existing fields stay in place
  equipment: Equipment
  loadMode: LoadMode
  barWeightKg: number
  // existing fields stay in place
}

export type ExerciseCatalogItem = {
  // existing fields stay in place
  equipment: Equipment
  loadMode: LoadMode
  barWeightKg: number
  // existing fields stay in place
}
```

Add optional snapshot fields in `src/domains/workout/types.ts`:

```ts
export type ExerciseSnapshot = {
  name: string
  canonicalName: string
  mainMuscle: string
  equipment: string
  loadMode?: 'single' | 'split'
  barWeightKg?: number
  targetSets: number
  repsMin: number
  repsMax: number
  recommendedRir: number
  restSeconds: number
}
```

- [ ] **Step 2: Write failing helper tests**

Create `src/shared/calculations/equipmentLoad.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  buildEquipmentLoadNote,
  defaultLoadSettingsForEquipment,
  loadSettingsForEquipment,
  normalizeEquipment,
} from './equipmentLoad'

describe('equipment load calculations', () => {
  it('normalizes legacy pulley equipment', () => {
    expect(normalizeEquipment('Polea')).toBe('Maquina de polea')
    expect(normalizeEquipment('Maquina de polea')).toBe('Maquina de polea')
    expect(normalizeEquipment('Cuerda rara')).toBe('Otro')
  })

  it('defaults load settings by equipment', () => {
    expect(defaultLoadSettingsForEquipment('Barra')).toEqual({ loadMode: 'split', barWeightKg: 20 })
    expect(defaultLoadSettingsForEquipment('Mancuerna')).toEqual({ loadMode: 'single', barWeightKg: 0 })
    expect(defaultLoadSettingsForEquipment('Maquina')).toEqual({ loadMode: 'single', barWeightKg: 0 })
    expect(defaultLoadSettingsForEquipment('Maquina de polea')).toEqual({ loadMode: 'single', barWeightKg: 0 })
  })

  it('fills missing settings while preserving explicit split mode', () => {
    expect(loadSettingsForEquipment({ equipment: 'Maquina', loadMode: 'split' })).toEqual({
      equipment: 'Maquina',
      loadMode: 'split',
      barWeightKg: 0,
    })
  })

  it('builds a barbell note from disk weight', () => {
    expect(buildEquipmentLoadNote({
      equipment: 'Barra',
      loadMode: 'split',
      barWeightKg: 20,
      weightKg: 40,
      unit: 'kg',
    })).toBe('Discos por lado: 20 kg · Total con barra: 60 kg')
  })

  it('builds a split machine note', () => {
    expect(buildEquipmentLoadNote({
      equipment: 'Maquina',
      loadMode: 'split',
      barWeightKg: 0,
      weightKg: 80,
      unit: 'kg',
    })).toBe('Carga por lado: 40 kg')
  })

  it('does not build a note for single-point dumbbells', () => {
    expect(buildEquipmentLoadNote({
      equipment: 'Mancuerna',
      loadMode: 'single',
      barWeightKg: 0,
      weightKg: 20,
      unit: 'kg',
    })).toBeNull()
  })

  it('formats notes in the preferred unit', () => {
    expect(buildEquipmentLoadNote({
      equipment: 'Barra',
      loadMode: 'split',
      barWeightKg: 20,
      weightKg: 40,
      unit: 'lb',
    })).toBe('Discos por lado: 44.1 lb · Total con barra: 132.3 lb')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
pnpm test src/shared/calculations/equipmentLoad.test.ts
```

Expected: fails because `src/shared/calculations/equipmentLoad.ts` does not exist.

- [ ] **Step 4: Implement the helper**

Create `src/shared/calculations/equipmentLoad.ts`:

```ts
import type { Equipment, LoadMode } from '../../domains/routine/types'
import type { WeightUnit } from '../../domains/workout/types'
import { formatWeight } from '../utils/weight'

const equipmentValues: Equipment[] = ['Barra', 'Mancuerna', 'Maquina', 'Maquina de polea', 'Peso corporal', 'Otro']

export function normalizeEquipment(value: unknown): Equipment {
  if (value === 'Polea') return 'Maquina de polea'
  if (typeof value === 'string' && equipmentValues.includes(value as Equipment)) return value as Equipment

  return 'Otro'
}

export function defaultLoadSettingsForEquipment(equipment: Equipment): { loadMode: LoadMode; barWeightKg: number } {
  return equipment === 'Barra' ? { loadMode: 'split', barWeightKg: 20 } : { loadMode: 'single', barWeightKg: 0 }
}

export function loadSettingsForEquipment(input: {
  barWeightKg?: number | null
  equipment: unknown
  loadMode?: LoadMode | null
}) {
  const equipment = normalizeEquipment(input.equipment)
  const defaults = defaultLoadSettingsForEquipment(equipment)
  const loadMode = input.loadMode === 'split' || input.loadMode === 'single' ? input.loadMode : defaults.loadMode
  const barWeightKg = equipment === 'Barra' && Number.isFinite(input.barWeightKg) ? Math.max(Number(input.barWeightKg), 0) : defaults.barWeightKg

  return { equipment, loadMode, barWeightKg }
}

export function buildEquipmentLoadNote(input: {
  barWeightKg?: number | null
  equipment: unknown
  loadMode?: LoadMode | null
  unit: WeightUnit
  weightKg: number
}) {
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) return null

  const settings = loadSettingsForEquipment(input)
  if (settings.equipment === 'Barra') {
    return [
      `Discos por lado: ${formatWeight(input.weightKg / 2, input.unit)}`,
      `Total con barra: ${formatWeight(input.weightKg + settings.barWeightKg, input.unit)}`,
    ].join(' · ')
  }

  if (settings.loadMode === 'split') return `Carga por lado: ${formatWeight(input.weightKg / 2, input.unit)}`

  return null
}
```

- [ ] **Step 5: Run helper tests**

Run:

```bash
pnpm test src/shared/calculations/equipmentLoad.test.ts
```

Expected: pass.

---

### Task 2: Schema, Import Validation, And Dexie Migration

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/shared/validation/arsenImportSchemas.ts`
- Modify: `src/shared/validation/arsenImportSchemas.test.ts`
- Modify: `src/db/indexeddb.test.ts`

**Interfaces:**
- Consumes: `normalizeEquipment`, `loadSettingsForEquipment`
- Produces: Dexie `CURRENT_SCHEMA_VERSION = 5`
- Produces: import schemas that accept `Polea` but return `Maquina de polea`

- [ ] **Step 1: Write failing validation tests**

Append tests to `src/shared/validation/arsenImportSchemas.test.ts`:

```ts
import { backupSchema, routineExportSchema } from './arsenImportSchemas'

it('normalizes legacy Polea in routine imports and defaults load settings', () => {
  const parsed = routineExportSchema.parse({
    routine,
    days: [routineDay],
    exercises: [{ ...routineExercise, equipment: 'Polea', loadMode: undefined, barWeightKg: undefined }],
    weeklyVolumeTargets: [],
  })

  expect(parsed.exercises[0]!.equipment).toBe('Maquina de polea')
  expect(parsed.exercises[0]!.loadMode).toBe('single')
  expect(parsed.exercises[0]!.barWeightKg).toBe(0)
})

it('normalizes legacy Polea in backup catalog imports', () => {
  const parsed = backupSchema.parse({
    tables: {
      exerciseCatalog: [{ ...exerciseCatalogItem, equipment: 'Polea', loadMode: undefined, barWeightKg: undefined }],
    },
  })

  expect(parsed.tables.exerciseCatalog[0]!.equipment).toBe('Maquina de polea')
  expect(parsed.tables.exerciseCatalog[0]!.loadMode).toBe('single')
  expect(parsed.tables.exerciseCatalog[0]!.barWeightKg).toBe(0)
})
```

Use the existing `routine`, `day`, and `exercise` constants already defined at the top of `src/shared/validation/arsenImportSchemas.test.ts`. Add this local catalog fixture inside the backup test:

```ts
const catalogItem = {
  aliases: [],
  assetKind: null,
  canonicalName: 'jalon-al-pecho',
  createdAt: '2026-01-01T00:00:00.000Z',
  defaultRecommendedRir: 2,
  defaultRepsMax: 10,
  defaultRepsMin: 8,
  defaultRestSeconds: 120,
  defaultTargetSets: 4,
  equipment: 'Polea',
  id: 'catalog-polea',
  mainMuscle: 'Espalda',
  name: 'Jalon al pecho',
  updatedAt: '2026-01-01T00:00:00.000Z',
}
```

- [ ] **Step 2: Run validation tests to verify they fail**

Run:

```bash
pnpm test src/shared/validation/arsenImportSchemas.test.ts
```

Expected: fails because `loadMode` and `barWeightKg` are not parsed and `Polea` is not transformed.

- [ ] **Step 3: Update import schemas**

In `src/shared/validation/arsenImportSchemas.ts`, replace the equipment enum and add load fields:

```ts
import { loadSettingsForEquipment, normalizeEquipment } from '../calculations/equipmentLoad'

const equipmentSchema = z
  .union([
    z.enum(['Barra', 'Mancuerna', 'Maquina', 'Maquina de polea', 'Peso corporal', 'Otro']),
    z.literal('Polea'),
  ])
  .transform(normalizeEquipment)
const loadModeSchema = z.enum(['single', 'split'])
```

Add these properties to both `routineExerciseSchema` and `exerciseCatalogItemSchema`:

```ts
    barWeightKg: z.number().optional().default(0),
    loadMode: loadModeSchema.optional(),
```

After `.passthrough()`, transform both schemas:

```ts
  .transform((exercise) => ({
    ...exercise,
    ...loadSettingsForEquipment({
      barWeightKg: exercise.barWeightKg,
      equipment: exercise.equipment,
      loadMode: exercise.loadMode,
    }),
  }))
```

Keep the existing reps range `.refine(...)` after the transform by using the transformed object in the refine.

- [ ] **Step 4: Add Dexie migration**

In `src/db/schema.ts`, bump:

```ts
export const CURRENT_SCHEMA_VERSION = 5
```

Import `loadSettingsForEquipment`:

```ts
import { loadSettingsForEquipment } from '../shared/calculations/equipmentLoad'
```

Append a `version(5)` block with the same stores as version 4 and this upgrade:

```ts
    this.version(5)
      .stores({
        settings: 'id, activeRoutineId, preferredUnit',
        routines: 'id, isActive, name, updatedAt',
        routineDays: 'id, routineId, [routineId+order], weekday',
        routineExercises: 'id, routineId, dayId, canonicalName, [dayId+order], sourceExerciseId',
        exerciseCatalog: 'id, canonicalName, mainMuscle, equipment',
        weeklyVolumeTargets: 'id, routineId, muscle',
        workoutSessions: 'id, routineId, dayId, date, [date+routineId], [date+dayId]',
        exerciseLogs: 'id, sessionId, routineExerciseId, state',
        setLogs: 'id, exerciseLogId, kind, [exerciseLogId+order]',
        dropSetLogs: 'id, setLogId, [setLogId+order]',
        skipLogs: 'id, sessionId, routineExerciseId',
      })
      .upgrade((tx) =>
        Promise.all(
          ['exerciseCatalog', 'routineExercises'].map((tableName) =>
            tx
              .table(tableName)
              .toCollection()
              .modify((item) => {
                const settings = loadSettingsForEquipment({
                  barWeightKg: item.barWeightKg,
                  equipment: item.equipment,
                  loadMode: item.loadMode,
                })
                item.equipment = settings.equipment
                item.loadMode = settings.loadMode
                item.barWeightKg = settings.barWeightKg
              }),
          ),
        ),
      )
```

- [ ] **Step 5: Add IndexedDB migration assertion**

In `src/db/indexeddb.test.ts`, add or extend a test that seeds a routine exercise through services or direct Dexie insert, then asserts defaults:

```ts
const migratedExercise = await db.routineExercises.get(exerciseId)
expect(migratedExercise?.loadMode).toBe('split')
expect(migratedExercise?.barWeightKg).toBe(20)
```

Keep this test focused on the current schema accepting and preserving the new fields through a real service write; the import compatibility test above covers old backup payloads without constructing a second Dexie instance.

- [ ] **Step 6: Run schema and validation tests**

Run:

```bash
pnpm test src/shared/validation/arsenImportSchemas.test.ts src/db/indexeddb.test.ts
```

Expected: pass.

---

### Task 3: Routine Services, Import/Export, Seed, And Progression Compatibility

**Files:**
- Modify: `src/domains/routine/services.ts`
- Modify: `src/domains/routine/importExport.ts`
- Modify: `src/db/seedDemoRoutine.ts`
- Modify: `src/shared/calculations/progression.ts`
- Modify: `src/shared/calculations/progression.test.ts`
- Modify: service-related tests in `src/db/indexeddb.test.ts`

**Interfaces:**
- Consumes: `Equipment`, `LoadMode`, `loadSettingsForEquipment`, `normalizeEquipment`
- Produces: routine/catalog service writes always include normalized `equipment`, `loadMode`, and `barWeightKg`
- Produces: new exercise logs receive snapshot load fields in Task 5

- [ ] **Step 1: Write failing progression compatibility test**

In `src/shared/calculations/progression.test.ts`, add:

```ts
it('uses the renamed pulley equipment for small weight jumps', () => {
  const recommendation = getWeightIncreaseRecommendation(
    { ...exercise, equipment: 'Maquina de polea', targetSets: 2, repsMax: 10, recommendedRir: 2 },
    [
      { date: '2026-07-30', sets: readySets },
      { date: '2026-08-01', sets: readySets },
    ],
  )

  expect(recommendation?.suggestedIncreaseLabel).toBe('+1 a +2 kg')
})
```

Use the existing `exercise`, `session`, and `set` helpers already defined in `src/shared/calculations/progression.test.ts`.

- [ ] **Step 2: Run progression test to verify it fails**

Run:

```bash
pnpm test src/shared/calculations/progression.test.ts
```

Expected: fails because `suggestedIncreaseLabel` does not know `Maquina de polea`.

- [ ] **Step 3: Normalize service inputs**

In `src/domains/routine/services.ts`, import:

```ts
import type { LoadMode } from './types'
import { loadSettingsForEquipment } from '../../shared/calculations/equipmentLoad'
```

Extend input types:

```ts
export type ExerciseInput = {
  barWeightKg?: number
  loadMode?: LoadMode
  equipment?: Equipment
  // existing fields remain
}

export type CatalogExerciseInput = {
  barWeightKg?: number
  loadMode?: LoadMode
  equipment?: Equipment
  // existing fields remain
}
```

Before each object write in `createExercise`, `addCatalogExerciseToDay`, `updateExercise`, `createCatalogExercise`, and `updateCatalogExercise`, compute:

```ts
const loadSettings = loadSettingsForEquipment({
  barWeightKg: input.barWeightKg,
  equipment: input.equipment ?? existing?.equipment ?? catalogItem?.equipment ?? 'Otro',
  loadMode: input.loadMode ?? existing?.loadMode ?? catalogItem?.loadMode,
})
```

Then write:

```ts
equipment: loadSettings.equipment,
loadMode: loadSettings.loadMode,
barWeightKg: loadSettings.barWeightKg,
```

Use the actual local variables available in each function. In `createExercise` and `createCatalogExercise`, there is no `existing` or `catalogItem`; use `input.equipment ?? 'Otro'`.

- [ ] **Step 4: Normalize routine import/export**

In `src/domains/routine/importExport.ts`, replace `stripLegacyProgression` with a cleanup that also normalizes load settings:

```ts
function cleanExerciseForTransfer(exercise: RoutineExercise): RoutineExercise {
  const copy = { ...exercise } as RoutineExercise & { progression?: unknown }
  delete copy.progression
  copy.warmupProtocol = normalizeWarmupProtocol(copy.warmupProtocol)
  const loadSettings = loadSettingsForEquipment(copy)
  copy.equipment = loadSettings.equipment
  copy.loadMode = loadSettings.loadMode
  copy.barWeightKg = loadSettings.barWeightKg

  return copy
}
```

Update both export and import callers from `stripLegacyProgression` to `cleanExerciseForTransfer`.

- [ ] **Step 5: Seed new defaults**

In `src/db/seedDemoRoutine.ts`, import `loadSettingsForEquipment`, change pulley inference, and spread defaults into both routine and catalog objects:

```ts
if (value.includes('polea') || value.includes('jalon') || value.includes('pullover')) return 'Maquina de polea'
```

When building `routineExercises`, compute once:

```ts
const equipment = inferEquipment(exercise.name)
const loadSettings = loadSettingsForEquipment({ equipment })
```

Write:

```ts
equipment: loadSettings.equipment,
loadMode: loadSettings.loadMode,
barWeightKg: loadSettings.barWeightKg,
```

- [ ] **Step 6: Update progression labels**

In `src/shared/calculations/progression.ts`, import `normalizeEquipment` and update:

```ts
function suggestedIncreaseLabel(equipment: Equipment) {
  const normalized = normalizeEquipment(equipment)
  if (normalized === 'Barra' || normalized === 'Maquina') return '+2.5 kg'
  if (normalized === 'Mancuerna' || normalized === 'Maquina de polea') return '+1 a +2 kg'
  if (normalized === 'Peso corporal') return 'mas reps, control o carga externa'

  return 'subida pequena controlada'
}
```

- [ ] **Step 7: Run focused service/progression checks**

Run:

```bash
pnpm test src/shared/calculations/progression.test.ts src/db/indexeddb.test.ts
```

Expected: pass.

---

### Task 4: Routine And Catalog Load Controls

**Files:**
- Modify: `src/domains/routine/pages/RoutinePage.tsx`
- Modify: `src/domains/routine/pages/RoutineDayDetailPage.tsx`
- Modify: `src/domains/routine/pages/RoutineDayDetailPage.test.tsx`

**Interfaces:**
- Consumes: `LoadMode`, `defaultLoadSettingsForEquipment`, `kgToUnit`, `unitToKg`
- Produces: catalog editor and recipe editor call `onSave` with `equipment`, `loadMode`, and `barWeightKg`

- [ ] **Step 1: Update equipment options**

In `src/domains/routine/pages/RoutinePage.tsx`, change:

```ts
const equipmentOptions: Equipment[] = ['Barra', 'Mancuerna', 'Maquina', 'Maquina de polea', 'Peso corporal', 'Otro']
```

- [ ] **Step 2: Extend form state**

Extend `ExerciseForm`:

```ts
type ExerciseForm = {
  barWeight: string
  equipment: Equipment
  loadMode: LoadMode
  // existing fields remain
}
```

In `exerciseToForm`, use:

```ts
const loadSettings = loadSettingsForEquipment({
  barWeightKg: exercise?.barWeightKg ?? catalogItem?.barWeightKg,
  equipment: exercise?.equipment ?? catalogItem?.equipment ?? 'Barra',
  loadMode: exercise?.loadMode ?? catalogItem?.loadMode,
})
```

Return:

```ts
equipment: loadSettings.equipment,
loadMode: loadSettings.loadMode,
barWeight: String(kgToUnit(loadSettings.barWeightKg, 'kg')),
```

Keep `barWeight` displayed in kg in the routine editor. The app-wide preferred-unit acceptance criterion is verified in `/entreno`, where `workoutDay.settings.preferredUnit` is already available.

- [ ] **Step 3: Add load controls component**

Add below `EquipmentSelect`:

```tsx
function LoadSettingsFields({
  barWeight,
  equipment,
  loadMode,
  onChange,
}: {
  barWeight: string
  equipment: Equipment
  loadMode: LoadMode
  onChange: (value: Pick<ExerciseForm, 'barWeight' | 'loadMode'>) => void
}) {
  return (
    <div className="space-y-2">
      <label className="block">
        <span className="mb-1 block text-xs font-bold text-arsen-muted">Carga</span>
        <select
          className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink"
          onChange={(event) => onChange({ barWeight, loadMode: event.target.value as LoadMode })}
          value={loadMode}
        >
          <option value="single">Punto unico</option>
          <option value="split">Por lado</option>
        </select>
      </label>
      {equipment === 'Barra' ? (
        <TextField label="Barra kg" onChange={(value) => onChange({ barWeight: value, loadMode })} type="number" value={barWeight} />
      ) : null}
    </div>
  )
}
```

Add the component to both `CatalogExerciseEditorSheet` and `RoutineExerciseRecipeSheet` immediately after `EquipmentSelect`.

- [ ] **Step 4: Apply defaults on equipment changes**

In both sheets, replace direct equipment update:

```tsx
<EquipmentSelect
  onChange={(equipment) => {
    const defaults = defaultLoadSettingsForEquipment(equipment)
    setForm((current) => ({
      ...current,
      equipment,
      loadMode: defaults.loadMode,
      barWeight: String(defaults.barWeightKg),
    }))
  }}
  value={form.equipment}
/>
```

This chooses the simplest behavior: changing equipment resets the load settings to that equipment's default. It is predictable and avoids hidden state for "dirty" tracking.

- [ ] **Step 5: Save load fields**

In `formToExerciseInput`, include:

```ts
const barWeightKg = unitToKg(numberOrDefault(form.barWeight, 0), 'kg')
const loadSettings = loadSettingsForEquipment({
  barWeightKg,
  equipment: form.equipment,
  loadMode: form.loadMode,
})
```

Return:

```ts
barWeightKg: loadSettings.barWeightKg,
equipment: loadSettings.equipment,
loadMode: loadSettings.loadMode,
```

Mirror the same pattern in the catalog form save function.

- [ ] **Step 6: Update routine detail display**

In `src/domains/routine/pages/RoutineDayDetailPage.tsx`, import `normalizeEquipment` and normalize the summary row that currently renders `exercise.equipment`:

```tsx
{normalizeEquipment(exercise.equipment)}
```

Do not add a load note to the detail page; the acceptance criteria only requires `/entreno`.

- [ ] **Step 7: Run routine UI tests**

Run:

```bash
pnpm test src/domains/routine/pages/RoutineDayDetailPage.test.tsx
```

Expected: pass. The routine editor sheets are covered by TypeScript build in Task 6 because the current routine page tests target the read-only detail surface.

---

### Task 5: Workout Notes And Live Register Sheet Calculation

**Files:**
- Modify: `src/domains/workout/pages/WorkoutPage.tsx`
- Modify: `src/domains/workout/components/RegisterSetSheet.tsx`
- Modify: `src/domains/workout/pages/WorkoutPage.test.tsx`
- Modify: `src/domains/workout/components/RegisterSetSheet.test.tsx`
- Modify: `src/domains/workout/services.ts`

**Interfaces:**
- Consumes: `buildEquipmentLoadNote`, `loadSettingsForEquipment`, `unitToKg`
- Produces: visible load note in current exercise card and live register sheet
- Produces: exercise snapshots include `loadMode` and `barWeightKg`

- [ ] **Step 1: Write failing `/entreno` card test**

In `src/domains/workout/pages/WorkoutPage.test.tsx`, extend the fixture:

```ts
loadMode: 'split',
barWeightKg: 20,
```

Add:

```ts
it('shows barbell load note on the current exercise card', () => {
  render(<WorkoutPage />)

  expect(screen.getByText('Discos por lado: 30 kg · Total con barra: 80 kg')).toBeInTheDocument()
})
```

- [ ] **Step 2: Write failing register sheet live-note test**

In `src/domains/workout/components/RegisterSetSheet.test.tsx`, add:

```ts
it('recalculates the equipment load note from the entered weight', () => {
  render(
    <RegisterSetSheet
      date="2026-08-02"
      dayId="day-1"
      displayUnit="kg"
      exercise={{ ...exercise, equipment: 'Barra', loadMode: 'split', barWeightKg: 20, currentWeightKg: 60 }}
      onClose={vi.fn()}
      routineId="routine-1"
    />,
  )

  expect(screen.getByText('Discos por lado: 30 kg · Total con barra: 80 kg')).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('KG'), { target: { value: '40' } })

  expect(screen.getByText('Discos por lado: 20 kg · Total con barra: 60 kg')).toBeInTheDocument()
})
```

The current `NumberField` already renders an implicit label around the input, so `screen.getByLabelText('KG')` continues to work.

- [ ] **Step 3: Run workout UI tests to verify they fail**

Run:

```bash
pnpm test src/domains/workout/pages/WorkoutPage.test.tsx src/domains/workout/components/RegisterSetSheet.test.tsx
```

Expected: fails because no load note is rendered.

- [ ] **Step 4: Render current-exercise note**

In `src/domains/workout/pages/WorkoutPage.tsx`, import:

```ts
import { buildEquipmentLoadNote } from '../../../shared/calculations/equipmentLoad'
```

Add:

```ts
const currentLoadNote = currentExercise
  ? buildEquipmentLoadNote({
      barWeightKg: currentExercise.barWeightKg,
      equipment: currentExercise.equipment,
      loadMode: currentExercise.loadMode,
      unit: preferredUnit,
      weightKg: currentExercise.currentWeightKg,
    })
  : null
```

Render below the stats grid and above `Registrar`:

```tsx
{currentLoadNote ? (
  <div className="mb-3 rounded-[10px] border border-arsen-purple/30 bg-arsen-purple/10 px-3 py-2 text-xs font-bold text-arsen-purple2">
    {currentLoadNote}
  </div>
) : null}
```

- [ ] **Step 5: Render live register sheet note**

In `src/domains/workout/components/RegisterSetSheet.tsx`, import:

```ts
import { buildEquipmentLoadNote } from '../../../shared/calculations/equipmentLoad'
```

After `const activeExercise = exercise`, add:

```ts
const equipmentLoadNote = buildEquipmentLoadNote({
  barWeightKg: activeExercise.barWeightKg,
  equipment: activeExercise.equipment,
  loadMode: activeExercise.loadMode,
  unit: displayUnit,
  weightKg: unitToKg(numberOrZero(weightValue), displayUnit),
})
```

Render below the weight/reps/RIR grid:

```tsx
{equipmentLoadNote ? (
  <div className="mt-3 rounded-[10px] border border-arsen-purple/30 bg-arsen-purple/10 px-3 py-2 text-xs font-bold text-arsen-purple2">
    {equipmentLoadNote}
  </div>
) : null}
```

Update `NumberField` to be accessible:

```tsx
const fieldId = `field-${label.toLowerCase().replaceAll(' ', '-')}`
<label className="block" htmlFor={fieldId}>
  <span className="mb-1 block text-xs font-bold text-arsen-muted">{label}</span>
  <input id={fieldId} ... />
</label>
```

- [ ] **Step 6: Copy load settings into snapshots**

In `src/domains/workout/services.ts`, inside `ensureExerciseLog`, add:

```ts
loadMode: exercise.loadMode,
barWeightKg: exercise.barWeightKg,
```

inside `snapshot`.

- [ ] **Step 7: Run workout tests**

Run:

```bash
pnpm test src/domains/workout/pages/WorkoutPage.test.tsx src/domains/workout/components/RegisterSetSheet.test.tsx
```

Expected: pass.

---

### Task 6: Final Verification And Impeccable Audit

**Files:**
- Modify: files touched by Tasks 1-5 only when verification reports a concrete issue.

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: verified build and design detector pass or documented findings.

- [ ] **Step 1: Run targeted test set**

Run:

```bash
pnpm test src/shared/calculations/equipmentLoad.test.ts src/shared/calculations/progression.test.ts src/shared/validation/arsenImportSchemas.test.ts src/domains/workout/pages/WorkoutPage.test.tsx src/domains/workout/components/RegisterSetSheet.test.tsx src/db/indexeddb.test.ts
```

Expected: pass.

- [ ] **Step 2: Run full test suite**

Run:

```bash
pnpm test
```

Expected: pass.

- [ ] **Step 3: Run production build**

Run:

```bash
pnpm build
```

Expected: pass, including TypeScript build, Vite build, and `scripts/generate-sw.mjs`.

- [ ] **Step 4: Run Impeccable detector once**

Run:

```bash
node C:\Users\Chovy\.agents\skills\impeccable\scripts\detect.mjs --json src/domains/routine/pages/RoutinePage.tsx src/domains/workout/pages/WorkoutPage.tsx src/domains/workout/components/RegisterSetSheet.tsx
```

Expected: no blocking overlap, contrast, text-fit, or token-use findings. When findings appear, fix only the changed UI and rerun this detector once.

- [ ] **Step 5: Review diff without committing**

Run:

```bash
git diff -- docs/superpowers/specs/2026-08-02-equipment-load-calculation-design.md docs/superpowers/plans/2026-08-02-equipment-load-calculation.md src
```

Expected: diff contains only the equipment load feature, tests, and generated schema-compatible changes. Do not commit.

---

## Self-Review

- Spec coverage: all acceptance criteria map to tasks. `Polea` rename and compatibility are in Tasks 1-3; per-exercise split/single config is in Tasks 1, 3, and 4; barbell total/per-side notes are in Tasks 1 and 5; split machine behavior is in Tasks 1 and 5; `/entreno` note is in Task 5; kg/lb behavior is in Tasks 1 and 5.
- Open-slot scan: the plan converts file-dependent branches to concrete instructions using the fixtures and components present in the repo.
- Type consistency: the shared names are `Equipment`, `LoadMode`, `normalizeEquipment`, `defaultLoadSettingsForEquipment`, `loadSettingsForEquipment`, and `buildEquipmentLoadNote` throughout.
- Repo override: commit steps are intentionally omitted and replaced with a final diff review because `AGENTS.md` forbids automatic commits.
