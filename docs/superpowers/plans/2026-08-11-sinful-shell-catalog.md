# Sinful Shell Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not use subagent-driven-development in this repository. Do not commit unless the human explicitly approves a git operation.

**Goal:** Build Sinful Shell as a bundled, read-only exercise library that can be browsed in a bottom sheet and copied into the user's personal catalog only after detail review and confirmation.

**Architecture:** Sinful Shell stays static in `src/domains/routine/data/` and never writes to Dexie directly. The personal catalog stores optional origin/lock metadata and services enforce that locked content comes from the static manifest. UI entry points in the Catalog tab and Add Exercise sheet reuse one `SinfulShellBrowserSheet` and the existing catalog editor.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Dexie, Vitest, Testing Library, Zod.

## Global Constraints

- Use the approved annexes exactly: `C:/Users/Chovy/Desktop/Proyevtos/datos_obligatorios_catalogo_sinful-shell.json` and `C:/Users/Chovy/Desktop/Proyevtos/lista_imagenes_sinful-shell.md`.
- Sinful Shell manifest V1 contains exactly 74 exercises.
- Every manifest entry has `id`, `name`, `canonicalName`, `mainMuscle`, `aliases`, `technicalNotes`, and `bundledAssetId`.
- Every `technicalNotes` value starts with the exact approved accented prefix described in the spec; keep the source text unchanged.
- The static catalog is read-only, not seeded into Dexie, and makes no network calls.
- Tapping a Sinful Shell card opens detail first and never imports directly.
- `ExerciseCatalogItem` gets optional non-indexed fields: `origin?: 'user' | 'sinful-shell'`, `sinfulShellId?: string | null`, `sinfulShellContentLocked?: boolean`.
- Legacy catalog items are interpreted as `origin: 'user'`, `sinfulShellId: null`, and `sinfulShellContentLocked: false`.
- Do not bump Dexie schema version unless an index/table changes.
- Locked Sinful Shell copies keep `name`, `canonicalName`, `mainMuscle`, `technicalNotes`, and `bundledAssetId` protected.
- `bundledAssetId` must propagate to `RoutineExercise` and `ExerciseLog.snapshot`.
- Backups old and new must import through Zod.
- UI strings stay Spanish/es-MX style, mobile-first, and usable at 360px.
- Use existing Tailwind theme tokens; do not add raw component colors.
- No git commit steps in this plan unless the human explicitly approves.

---

## File Structure

- Create `src/domains/routine/data/sinfulShellCatalog.ts`: static manifest, public helpers, validation, and search.
- Create `src/domains/routine/data/sinfulShellCatalog.test.ts`: manifest count, required fields, prefix, asset existence, search/filter, and lookup tests.
- Modify `src/domains/routine/types.ts`: optional origin/lock fields and catalog input-facing type support.
- Modify `src/shared/validation/arsenImportSchemas.ts`: optional origin/lock Zod fields with legacy defaults.
- Modify `src/shared/validation/arsenImportSchemas.test.ts`: schema tests for old and new catalog items.
- Modify `src/domains/routine/services.ts`: create/update catalog mode for Sinful Shell, dedupe by `sinfulShellId`, locked-field preservation.
- Modify or create `src/domains/routine/services.test.ts`: service-level tests for create, dedupe, lock update, delete availability, and propagation behavior.
- Create `src/domains/routine/components/SinfulShellBrowserSheet.tsx`: shared bottom sheet browser and detail view.
- Create `src/domains/routine/components/SinfulShellBrowserSheet.test.tsx`: UI tests for search/filter, detail-first flow, statuses, and actions.
- Modify `src/domains/routine/pages/RoutinePage.tsx`: wire entry points, editor mode, readonly Sinful Shell editor state, and add-from-routine actions.
- Modify `src/domains/routine/pages/RoutinePage.test.tsx`: integrated tests for banner, Add Exercise entry, finalization editor, and locked edit behavior.

---

### Task 1: Static Sinful Shell Manifest And Helpers

**Files:**
- Create: `src/domains/routine/data/sinfulShellCatalog.ts`
- Create: `src/domains/routine/data/sinfulShellCatalog.test.ts`

**Interfaces:**
- Produces:
  - `type SinfulShellExercise`
  - `const SINFUL_SHELL_SCHEMA_VERSION: 1`
  - `const sinfulShellCatalog: readonly SinfulShellExercise[]`
  - `const sinfulShellMuscleFilters: readonly Array<'Todos' | MuscleGroup>`
  - `function getSinfulShellExerciseById(id: string): SinfulShellExercise | null`
  - `function searchSinfulShellExercises(input: { query?: string; muscle?: MuscleGroup | 'Todos' | null }): SinfulShellExercise[]`
  - `function validateSinfulShellCatalog(): string[]`
  - `function isSinfulShellTechnicalNotes(value: string): boolean`

- Consumes:
  - `MuscleGroup` from `src/domains/routine/types.ts`
  - `muscleGroups` and `normalizeMuscleGroup` from `src/domains/routine/utils/muscles.ts`
  - `getBundledExerciseAsset` from `src/shared/assets/exerciseImages.ts`

- [ ] **Step 1: Write failing manifest validation tests**

Add `src/domains/routine/data/sinfulShellCatalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { getBundledExerciseAsset } from '../../../shared/assets/exerciseImages'
import {
  SINFUL_SHELL_SCHEMA_VERSION,
  getSinfulShellExerciseById,
  isSinfulShellTechnicalNotes,
  searchSinfulShellExercises,
  sinfulShellCatalog,
  validateSinfulShellCatalog,
} from './sinfulShellCatalog'

describe('sinfulShellCatalog', () => {
  it('contains the approved V1 manifest shape', () => {
    expect(SINFUL_SHELL_SCHEMA_VERSION).toBe(1)
    expect(sinfulShellCatalog).toHaveLength(74)

    for (const exercise of sinfulShellCatalog) {
      expect(Object.keys(exercise).sort()).toEqual([
        'aliases',
        'bundledAssetId',
        'canonicalName',
        'id',
        'mainMuscle',
        'name',
        'technicalNotes',
      ])
      expect(exercise.id).toMatch(/^sinful-shell-/)
      expect(exercise.name.trim()).toBe(exercise.name)
      expect(exercise.canonicalName.trim()).toBe(exercise.canonicalName)
      expect(exercise.aliases.every((alias) => alias.trim().length > 0)).toBe(true)
      expect(isSinfulShellTechnicalNotes(exercise.technicalNotes)).toBe(true)
      expect(getBundledExerciseAsset(exercise.bundledAssetId)).not.toBeNull()
    }
  })

  it('has no manifest validation errors', () => {
    expect(validateSinfulShellCatalog()).toEqual([])
  })

  it('finds an exercise by id', () => {
    expect(getSinfulShellExerciseById('sinful-shell-press-inclinado')?.name).toBe('Press inclinado')
    expect(getSinfulShellExerciseById('missing')).toBeNull()
  })

  it('searches by aliases and filters by muscle', () => {
    expect(searchSinfulShellExercises({ query: 'lat pulldown' }).map((exercise) => exercise.id)).toContain('sinful-shell-jalon-al-pecho')
    expect(searchSinfulShellExercises({ query: 'curl', muscle: 'Brazos' }).every((exercise) => exercise.mainMuscle === 'Brazos')).toBe(true)
    expect(searchSinfulShellExercises({ query: 'curl', muscle: 'Pecho' })).toEqual([])
  })
})
```

- [ ] **Step 2: Run the failing tests**

Run: `pnpm test src/domains/routine/data/sinfulShellCatalog.test.ts`

Expected: FAIL because `sinfulShellCatalog.ts` does not exist.

- [ ] **Step 3: Generate manifest and helpers from the approved JSON**

Because the 74-entry manifest must match the approved annex exactly, generate the file mechanically from `C:/Users/Chovy/Desktop/Proyevtos/datos_obligatorios_catalogo_sinful-shell.json` instead of retyping entries.

Run from repo root:

```powershell
@'
const fs = require('fs')
const sourcePath = 'C:/Users/Chovy/Desktop/Proyevtos/datos_obligatorios_catalogo_sinful-shell.json'
const targetPath = 'src/domains/routine/data/sinfulShellCatalog.ts'
const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
const exercises = JSON.stringify(data.exercises, null, 2)
const content = `import { getBundledExerciseAsset } from '../../../shared/assets/exerciseImages'
import type { MuscleGroup } from '../types'
import { muscleGroups, normalizeMuscleGroup } from '../utils/muscles'

export type SinfulShellExercise = {
  id: string
  name: string
  canonicalName: string
  mainMuscle: MuscleGroup
  aliases: string[]
  technicalNotes: string
  bundledAssetId: string
}

export const SINFUL_SHELL_SCHEMA_VERSION = 1
export const SINFUL_SHELL_EXPECTED_COUNT = 74
export const sinfulShellMuscleFilters = ['Todos', ...muscleGroups] as const

export const sinfulShellCatalog = ${exercises} as const satisfies readonly SinfulShellExercise[]

const sinfulShellById = new Map(sinfulShellCatalog.map((exercise) => [exercise.id, exercise]))
const requiredFields = ['id', 'name', 'canonicalName', 'mainMuscle', 'aliases', 'technicalNotes', 'bundledAssetId'] as const

export function getSinfulShellExerciseById(id: string) {
  return sinfulShellById.get(id) ?? null
}

export function isSinfulShellTechnicalNotes(value: string) {
  return value.startsWith('M\\u00fasculo principal:')
}

export function searchSinfulShellExercises({
  muscle = 'Todos',
  query = '',
}: {
  muscle?: MuscleGroup | 'Todos' | null
  query?: string
} = {}) {
  const normalizedQuery = query.trim().toLocaleLowerCase('es-MX')

  return sinfulShellCatalog.filter((exercise) => {
    const matchesMuscle = !muscle || muscle === 'Todos' || exercise.mainMuscle === normalizeMuscleGroup(muscle)
    if (!matchesMuscle) return false
    if (!normalizedQuery) return true

    return [exercise.name, exercise.canonicalName, exercise.mainMuscle, exercise.bundledAssetId, ...exercise.aliases]
      .join(' ')
      .toLocaleLowerCase('es-MX')
      .includes(normalizedQuery)
  })
}

export function validateSinfulShellCatalog() {
  const errors: string[] = []
  const ids = new Set<string>()
  const canonicalNames = new Set<string>()
  const bundledAssetIds = new Set<string>()

  if (sinfulShellCatalog.length !== SINFUL_SHELL_EXPECTED_COUNT) {
    errors.push(\`Sinful Shell debe contener \${SINFUL_SHELL_EXPECTED_COUNT} ejercicios; contiene \${sinfulShellCatalog.length}\`)
  }

  for (const exercise of sinfulShellCatalog) {
    for (const field of requiredFields) {
      const value = exercise[field]
      if (Array.isArray(value) ? value.length === 0 : !String(value ?? '').trim()) {
        errors.push(\`\${exercise.id || 'sin-id'} no tiene \${field}\`)
      }
    }

    if (ids.has(exercise.id)) errors.push(\`id duplicado: \${exercise.id}\`)
    ids.add(exercise.id)

    if (canonicalNames.has(exercise.canonicalName)) errors.push(\`canonicalName duplicado: \${exercise.canonicalName}\`)
    canonicalNames.add(exercise.canonicalName)

    if (bundledAssetIds.has(exercise.bundledAssetId)) errors.push(\`bundledAssetId duplicado: \${exercise.bundledAssetId}\`)
    bundledAssetIds.add(exercise.bundledAssetId)

    if (!muscleGroups.includes(exercise.mainMuscle)) errors.push(\`musculo invalido en \${exercise.id}: \${exercise.mainMuscle}\`)
    if (!isSinfulShellTechnicalNotes(exercise.technicalNotes)) errors.push(\`technicalNotes sin prefijo obligatorio: \${exercise.id}\`)
    if (!getBundledExerciseAsset(exercise.bundledAssetId)) errors.push(\`asset faltante para \${exercise.id}: \${exercise.bundledAssetId}\`)
  }

  return errors
}
`
fs.mkdirSync('src/domains/routine/data', { recursive: true })
fs.writeFileSync(targetPath, content, 'utf8')
'@ | node
```

- [ ] **Step 4: Inspect generated manifest before tests**

Run:

```powershell
git diff -- src/domains/routine/data/sinfulShellCatalog.ts
```

Expected: the file contains the exported `sinfulShellCatalog` array with the 74 approved exercises and no extra metadata such as `catalogName`, `lockedWhenImported`, or `technicalNotesRule`.

- [ ] **Step 5: Run the focused tests**

Run: `pnpm test src/domains/routine/data/sinfulShellCatalog.test.ts`

Expected: PASS.

- [ ] **Step 6: Review checkpoint**

Verify:

- `sinfulShellCatalog` has exactly 74 entries.
- No entry name, alias, note, or `bundledAssetId` was changed from the approved JSON.
- No network or Dexie import exists in `sinfulShellCatalog.ts`.

---

### Task 2: Catalog Origin Types And Import Schemas

**Files:**
- Modify: `src/domains/routine/types.ts`
- Modify: `src/shared/validation/arsenImportSchemas.ts`
- Modify: `src/shared/validation/arsenImportSchemas.test.ts`

**Interfaces:**
- Consumes:
  - Existing `ExerciseCatalogItem`
  - Existing `exerciseCatalogItemSchema`
- Produces:
  - `type CatalogOrigin = 'user' | 'sinful-shell'`
  - Optional `origin`, `sinfulShellId`, and `sinfulShellContentLocked` fields on catalog items.

- [ ] **Step 1: Write failing schema tests**

In `src/shared/validation/arsenImportSchemas.test.ts`, add tests:

```ts
import { describe, expect, it } from 'vitest'
import { exerciseCatalogItemSchema } from './arsenImportSchemas'

describe('exerciseCatalogItemSchema Sinful Shell fields', () => {
  const baseCatalogItem = {
    aliases: [],
    canonicalName: 'press-plano',
    createdAt: '2026-08-11T00:00:00.000Z',
    defaultRecommendedRir: 2,
    defaultRepsMax: 10,
    defaultRepsMin: 8,
    defaultRestSeconds: 90,
    defaultTargetSets: 3,
    equipment: 'Barra',
    id: 'catalog-1',
    mainMuscle: 'Pecho',
    name: 'Press plano',
    technicalNotes: '',
    updatedAt: '2026-08-11T00:00:00.000Z',
    warmupProtocol: 'none',
  }

  it('defaults legacy catalog items to user origin', () => {
    const parsed = exerciseCatalogItemSchema.parse(baseCatalogItem)

    expect(parsed.origin).toBe('user')
    expect(parsed.sinfulShellId).toBeNull()
    expect(parsed.sinfulShellContentLocked).toBe(false)
  })

  it('preserves Sinful Shell origin and lock fields', () => {
    const parsed = exerciseCatalogItemSchema.parse({
      ...baseCatalogItem,
      origin: 'sinful-shell',
      sinfulShellContentLocked: true,
      sinfulShellId: 'sinful-shell-press-plano',
    })

    expect(parsed.origin).toBe('sinful-shell')
    expect(parsed.sinfulShellId).toBe('sinful-shell-press-plano')
    expect(parsed.sinfulShellContentLocked).toBe(true)
  })
})
```

If this file already defines fixtures or imports, merge the new tests into the existing structure instead of duplicating imports.

- [ ] **Step 2: Run the failing schema tests**

Run: `pnpm test src/shared/validation/arsenImportSchemas.test.ts`

Expected: FAIL because parsed legacy items do not have the new defaulted fields.

- [ ] **Step 3: Add optional catalog origin types**

In `src/domains/routine/types.ts`, add:

```ts
export type CatalogOrigin = 'user' | 'sinful-shell'
```

Then extend `ExerciseCatalogItem`:

```ts
  origin?: CatalogOrigin
  sinfulShellId?: string | null
  sinfulShellContentLocked?: boolean
```

Do not add these fields to any Dexie index.

- [ ] **Step 4: Add Zod defaults**

In `src/shared/validation/arsenImportSchemas.ts`, add:

```ts
const catalogOriginSchema = z.enum(['user', 'sinful-shell'])
```

Inside `exerciseCatalogItemSchema`, add:

```ts
    origin: catalogOriginSchema.optional().default('user'),
    sinfulShellContentLocked: z.boolean().optional().default(false),
    sinfulShellId: z.string().nullable().optional().default(null),
```

Keep `.passthrough()` and the existing load-settings transform.

- [ ] **Step 5: Run schema tests**

Run: `pnpm test src/shared/validation/arsenImportSchemas.test.ts`

Expected: PASS.

- [ ] **Step 6: Review checkpoint**

Verify:

- `CURRENT_SCHEMA_VERSION` remains unchanged.
- No Dexie store definition changed.
- Legacy schema behavior still accepts old catalog items.

---

### Task 3: Service-Level Sinful Shell Creation, Dedupe, And Locking

**Files:**
- Modify: `src/domains/routine/services.ts`
- Modify or create: `src/domains/routine/services.test.ts`

**Interfaces:**
- Consumes:
  - `getSinfulShellExerciseById` from Task 1
  - `ExerciseCatalogItem` optional origin fields from Task 2
- Produces:
  - Extended `CatalogExerciseInput` discriminated by `mode?: 'manual' | 'create-from-sinful-shell'`
  - `createCatalogExercise(input)` returns the personal catalog item ID, including an existing ID on duplicate Sinful Shell create.
  - Locked update behavior in `updateCatalogExercise`.

- [ ] **Step 1: Write failing service tests**

Create `src/domains/routine/services.test.ts` if missing. Use `fake-indexeddb/auto` if this repo's existing Dexie tests do not already load it globally.

Add:

```ts
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { addCatalogExerciseToDay, createCatalogExercise, createDay, createRoutine, updateCatalogExercise } from './services'

async function resetDb() {
  db.close()
  await db.delete()
  await db.open()
}

describe('routine services Sinful Shell catalog', () => {
  beforeEach(resetDb)
  afterEach(async () => {
    db.close()
    await db.delete()
  })

  it('creates a locked personal copy from manifest values', async () => {
    const id = await createCatalogExercise({
      aliases: ['usuario puede editar aliases'],
      equipment: 'Mancuerna',
      loadMode: 'single',
      mode: 'create-from-sinful-shell',
      name: 'Nombre falsificado',
      mainMuscle: 'Piernas',
      sinfulShellId: 'sinful-shell-press-inclinado',
      technicalNotes: 'texto falsificado',
      warmupProtocol: 'hypertrophy',
    })

    const item = await db.exerciseCatalog.get(id)

    expect(item).toMatchObject({
      aliases: ['usuario puede editar aliases'],
      bundledAssetId: 'press-inclinado--pecho',
      canonicalName: 'press-inclinado',
      equipment: 'Mancuerna',
      mainMuscle: 'Pecho',
      name: 'Press inclinado',
      origin: 'sinful-shell',
      sinfulShellContentLocked: true,
      sinfulShellId: 'sinful-shell-press-inclinado',
      warmupProtocol: 'hypertrophy',
    })
    expect(item?.technicalNotes).toMatch(/^M/)
    expect(item?.technicalNotes).toContain('pector')
  })

  it('returns the existing copy instead of duplicating sinfulShellId', async () => {
    const firstId = await createCatalogExercise({
      mode: 'create-from-sinful-shell',
      sinfulShellId: 'sinful-shell-press-plano',
    })
    const secondId = await createCatalogExercise({
      mode: 'create-from-sinful-shell',
      sinfulShellId: 'sinful-shell-press-plano',
    })

    expect(secondId).toBe(firstId)
    expect(await db.exerciseCatalog.count()).toBe(1)
  })

  it('preserves protected fields when updating a locked Sinful Shell copy', async () => {
    const id = await createCatalogExercise({
      mode: 'create-from-sinful-shell',
      sinfulShellId: 'sinful-shell-jalon-al-pecho',
    })

    await updateCatalogExercise(id, {
      aliases: ['alias nuevo'],
      bundledAssetId: 'press-plano--pecho',
      equipment: 'Maquina',
      mainMuscle: 'Pecho',
      name: 'Nombre editado',
      technicalNotes: 'notas editadas',
      warmupProtocol: 'strength',
    })

    const item = await db.exerciseCatalog.get(id)
    expect(item).toMatchObject({
      aliases: ['alias nuevo'],
      bundledAssetId: 'jalon-al-pecho--espalda',
      canonicalName: 'jalon-al-pecho',
      equipment: 'Maquina',
      mainMuscle: 'Espalda',
      origin: 'sinful-shell',
      sinfulShellContentLocked: true,
      sinfulShellId: 'sinful-shell-jalon-al-pecho',
      warmupProtocol: 'strength',
    })
    expect(item?.canonicalName).toBe('jalon-al-pecho')
    expect(item?.technicalNotes).not.toBe('notas editadas')
  })

  it('keeps manual catalog items fully editable', async () => {
    const id = await createCatalogExercise({
      bundledAssetId: 'press-plano--pecho',
      mainMuscle: 'Pecho',
      name: 'Press manual',
      technicalNotes: 'Notas manuales',
    })

    await updateCatalogExercise(id, {
      bundledAssetId: 'remo-t--espalda',
      mainMuscle: 'Espalda',
      name: 'Remo manual',
      technicalNotes: 'Notas nuevas',
    })

    const item = await db.exerciseCatalog.get(id)
    expect(item).toMatchObject({
      bundledAssetId: 'remo-t--espalda',
      canonicalName: 'remo-manual',
      mainMuscle: 'Espalda',
      name: 'Remo manual',
      origin: 'user',
      sinfulShellContentLocked: false,
      sinfulShellId: null,
      technicalNotes: 'Notas nuevas',
    })
  })

  it('copies bundledAssetId from a Sinful Shell catalog copy into routine exercises', async () => {
    const catalogItemId = await createCatalogExercise({
      mode: 'create-from-sinful-shell',
      sinfulShellId: 'sinful-shell-pec-deck',
    })
    const routineId = await createRoutine('Rutina')
    const dayId = await createDay(routineId, 'Dia')

    const exerciseId = await addCatalogExerciseToDay(routineId, dayId, catalogItemId)

    expect(await db.routineExercises.get(exerciseId)).toMatchObject({
      bundledAssetId: 'pec-deck--pecho',
      sourceExerciseId: catalogItemId,
    })
  })
})
```

Adjust expected display strings if the manifest entry contains accented characters and the local test runner preserves them.

- [ ] **Step 2: Run the failing service tests**

Run: `pnpm test src/domains/routine/services.test.ts`

Expected: FAIL because `mode`/Sinful Shell logic does not exist.

- [ ] **Step 3: Extend service inputs**

In `src/domains/routine/services.ts`, change `CatalogExerciseInput` to include:

```ts
export type CatalogExerciseInput = {
  aliases?: string[]
  assetKind?: string | null
  bundledAssetId?: string | null
  barWeightKg?: number
  equipment?: Equipment
  loadMode?: LoadMode
  mainMuscle?: string
  mode?: 'manual' | 'create-from-sinful-shell'
  name?: string
  customAssetId?: string | null
  sinfulShellId?: string | null
  technicalNotes?: string
  warmupProtocol?: string
  defaultTargetSets?: number
  defaultRepsMin?: number
  defaultRepsMax?: number
  defaultRecommendedRir?: number
  defaultRestSeconds?: number
}
```

This keeps existing callers valid while allowing a Sinful Shell create that does not trust form-provided protected fields.

- [ ] **Step 4: Add helper functions**

In `services.ts`, import:

```ts
import { getSinfulShellExerciseById } from './data/sinfulShellCatalog'
```

Add helpers:

```ts
function normalizeCatalogOrigin(input: Pick<ExerciseCatalogItem, 'origin' | 'sinfulShellContentLocked' | 'sinfulShellId'>) {
  return {
    origin: input.origin ?? 'user',
    sinfulShellContentLocked: input.sinfulShellContentLocked ?? false,
    sinfulShellId: input.sinfulShellId ?? null,
  }
}

async function findExistingSinfulShellCopy(sinfulShellId: string) {
  return db.exerciseCatalog
    .filter((item) => (item.origin ?? 'user') === 'sinful-shell' && (item.sinfulShellId ?? null) === sinfulShellId)
    .first()
}

function normalizeCatalogReps(input: CatalogExerciseInput) {
  const repsMin = input.defaultRepsMin ?? 8
  const repsMax = input.defaultRepsMax ?? 10
  if (!Number.isFinite(repsMin) || !Number.isFinite(repsMax) || repsMin <= 0 || repsMax <= 0 || repsMin > repsMax) {
    throw new Error('Las reps minimas no pueden ser mayores que las maximas')
  }

  return { repsMax, repsMin }
}

function normalizeCatalogRir(input: CatalogExerciseInput) {
  const recommendedRir = input.defaultRecommendedRir ?? 2
  if (!Number.isFinite(recommendedRir) || recommendedRir < 0) throw new Error('El RIR debe ser mayor o igual a 0')

  return recommendedRir
}
```

- [ ] **Step 5: Implement create-from-sinful-shell**

In `createCatalogExercise`, branch before manual creation:

```ts
  if (input.mode === 'create-from-sinful-shell') {
    const sinfulShellId = input.sinfulShellId?.trim()
    if (!sinfulShellId) throw new Error('Ejercicio de Sinful Shell requerido')

    const source = getSinfulShellExerciseById(sinfulShellId)
    if (!source) throw new Error('Ejercicio de Sinful Shell no encontrado')

    const existing = await findExistingSinfulShellCopy(sinfulShellId)
    if (existing) return existing.id

    const reps = normalizeCatalogReps(input)
    const loadSettings = loadSettingsForEquipment({
      barWeightKg: input.barWeightKg,
      equipment: input.equipment ?? 'Otro',
      loadMode: input.loadMode,
    })
    const catalogItem: ExerciseCatalogItem = {
      aliases: input.aliases ?? source.aliases,
      assetKind: null,
      bundledAssetId: source.bundledAssetId,
      canonicalName: source.canonicalName,
      createdAt: now,
      customAssetId: null,
      defaultRecommendedRir: normalizeCatalogRir(input),
      defaultRepsMax: reps.repsMax,
      defaultRepsMin: reps.repsMin,
      defaultRestSeconds: input.defaultRestSeconds ?? 90,
      defaultTargetSets: input.defaultTargetSets ?? 3,
      equipment: loadSettings.equipment,
      loadMode: loadSettings.loadMode,
      barWeightKg: loadSettings.barWeightKg,
      id: createId('catalog'),
      mainMuscle: source.mainMuscle,
      name: source.name,
      origin: 'sinful-shell',
      sinfulShellContentLocked: true,
      sinfulShellId: source.id,
      technicalNotes: source.technicalNotes,
      updatedAt: now,
      warmupProtocol: normalizeWarmupProtocol(input.warmupProtocol),
    }

    await db.exerciseCatalog.add(catalogItem)
    return catalogItem.id
  }
```

Then update manual creation to set:

```ts
    origin: 'user',
    sinfulShellContentLocked: false,
    sinfulShellId: null,
```

Use `input.name?.trim() || 'Ejercicio nuevo'` and `normalizeMuscleGroup(input.mainMuscle)` because `mainMuscle` is now optional in the type.

- [ ] **Step 6: Implement locked update**

In `updateCatalogExercise`, after loading `existing`, throw if missing:

```ts
  if (!existing) throw new Error('Ejercicio de catalogo no encontrado')
```

Compute:

```ts
  const origin = normalizeCatalogOrigin(existing)
  const lockedSource = origin.sinfulShellContentLocked && origin.sinfulShellId ? getSinfulShellExerciseById(origin.sinfulShellId) : null
```

For locked items, update protected fields from `lockedSource ?? existing`:

```ts
    bundledAssetId: lockedSource?.bundledAssetId ?? existing.bundledAssetId,
    canonicalName: lockedSource?.canonicalName ?? existing.canonicalName,
    mainMuscle: lockedSource?.mainMuscle ?? existing.mainMuscle,
    name: lockedSource?.name ?? existing.name,
    origin: origin.origin,
    sinfulShellContentLocked: origin.sinfulShellContentLocked,
    sinfulShellId: origin.sinfulShellId,
    technicalNotes: lockedSource?.technicalNotes ?? existing.technicalNotes,
```

For manual items, preserve current behavior and set legacy defaults:

```ts
    origin: origin.origin,
    sinfulShellContentLocked: origin.sinfulShellContentLocked,
    sinfulShellId: origin.sinfulShellId,
```

- [ ] **Step 7: Run service tests**

Run: `pnpm test src/domains/routine/services.test.ts`

Expected: PASS.

- [ ] **Step 8: Review checkpoint**

Verify:

- Form-provided name/muscle/notes/image cannot override Sinful Shell protected content.
- Duplicate create returns existing ID and does not throw for normal repeated taps.
- Manual catalog behavior remains backwards compatible.

---

### Task 4: Shared Sinful Shell Browser Sheet

**Files:**
- Create: `src/domains/routine/components/SinfulShellBrowserSheet.tsx`
- Create: `src/domains/routine/components/SinfulShellBrowserSheet.test.tsx`

**Interfaces:**
- Consumes:
  - `SinfulShellExercise`, `searchSinfulShellExercises`, `sinfulShellMuscleFilters`
  - `ExerciseCatalogItem`
  - `ExerciseArt`
- Produces:
  - `type SinfulShellBrowserMode = 'catalog' | 'routine-add'`
  - `function SinfulShellBrowserSheet(props)`

Component props:

```ts
type SinfulShellBrowserSheetProps = {
  catalog: ExerciseCatalogItem[]
  disabled: boolean
  imageSrcByAssetId: Map<string, string>
  mode: 'catalog' | 'routine-add'
  onAddCopy: (exercise: SinfulShellExercise) => void
  onAddCopyToRoutine?: (catalogItem: ExerciseCatalogItem) => void
  onClose: () => void
  onViewCatalogCopy: (catalogItem: ExerciseCatalogItem) => void
}
```

- [ ] **Step 1: Write failing browser tests**

Create `src/domains/routine/components/SinfulShellBrowserSheet.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseCatalogItem } from '../types'
import { SinfulShellBrowserSheet } from './SinfulShellBrowserSheet'

describe('SinfulShellBrowserSheet', () => {
  afterEach(cleanup)

  it('searches by alias and opens detail before import', () => {
    const onAddCopy = vi.fn()

    render(
      <SinfulShellBrowserSheet
        catalog={[]}
        disabled={false}
        imageSrcByAssetId={new Map()}
        mode="catalog"
        onAddCopy={onAddCopy}
        onClose={vi.fn()}
        onViewCatalogCopy={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en Sinful Shell' }), { target: { value: 'lat pulldown' } })
    fireEvent.click(screen.getByRole('button', { name: /Jalon al pecho/i }))

    expect(screen.getByRole('heading', { name: /Jalon al pecho/i })).toBeInTheDocument()
    expect(screen.getByText(/Disponible/i)).toBeInTheDocument()
    expect(screen.getByText(/M.sculo principal:/i)).toBeInTheDocument()
    expect(onAddCopy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Agregar a mi catalogo' }))
    expect(onAddCopy).toHaveBeenCalledWith(expect.objectContaining({ id: 'sinful-shell-jalon-al-pecho' }))
  })

  it('filters by muscle chips', () => {
    render(
      <SinfulShellBrowserSheet
        catalog={[]}
        disabled={false}
        imageSrcByAssetId={new Map()}
        mode="catalog"
        onAddCopy={vi.fn()}
        onClose={vi.fn()}
        onViewCatalogCopy={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Pecho' }))

    const results = screen.getByTestId('sinful-shell-results')
    expect(within(results).getByRole('button', { name: /Press inclinado/i })).toBeInTheDocument()
    expect(within(results).queryByRole('button', { name: /Jalon al pecho/i })).not.toBeInTheDocument()
  })

  it('shows already-added actions for existing copies', () => {
    const catalogCopy = catalogItem({
      id: 'catalog-copy',
      name: 'Press inclinado',
      sinfulShellId: 'sinful-shell-press-inclinado',
    })
    const onViewCatalogCopy = vi.fn()
    const onAddCopyToRoutine = vi.fn()

    render(
      <SinfulShellBrowserSheet
        catalog={[catalogCopy]}
        disabled={false}
        imageSrcByAssetId={new Map()}
        mode="routine-add"
        onAddCopy={vi.fn()}
        onAddCopyToRoutine={onAddCopyToRoutine}
        onClose={vi.fn()}
        onViewCatalogCopy={onViewCatalogCopy}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Press inclinado/i }))
    expect(screen.getByText('Ya agregado')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Ver en mi catalogo' }))
    expect(onViewCatalogCopy).toHaveBeenCalledWith(catalogCopy)

    fireEvent.click(screen.getByRole('button', { name: 'Agregar a la rutina' }))
    expect(onAddCopyToRoutine).toHaveBeenCalledWith(catalogCopy)
  })
})

function catalogItem(overrides: Partial<ExerciseCatalogItem>): ExerciseCatalogItem {
  return {
    aliases: [],
    assetKind: null,
    barWeightKg: 20,
    bundledAssetId: null,
    canonicalName: 'press-inclinado',
    createdAt: '2026-08-11T00:00:00.000Z',
    customAssetId: null,
    defaultRecommendedRir: 2,
    defaultRepsMax: 10,
    defaultRepsMin: 8,
    defaultRestSeconds: 90,
    defaultTargetSets: 3,
    equipment: 'Barra',
    id: 'catalog-1',
    loadMode: 'single',
    mainMuscle: 'Pecho',
    name: 'Press inclinado',
    origin: 'sinful-shell',
    sinfulShellContentLocked: true,
    sinfulShellId: null,
    technicalNotes: '',
    updatedAt: '2026-08-11T00:00:00.000Z',
    warmupProtocol: 'none',
    ...overrides,
  }
}
```

Use accent-preserving expected text if the manifest source uses it and the runner displays it correctly.

- [ ] **Step 2: Run failing browser tests**

Run: `pnpm test src/domains/routine/components/SinfulShellBrowserSheet.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement browser shell and state**

Create `SinfulShellBrowserSheet.tsx` with:

```tsx
import { ArrowLeft, Check, ListPlus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ExerciseArt } from '../../../shared/components/ExerciseArt'
import type { ExerciseCatalogItem, MuscleGroup } from '../types'
import {
  type SinfulShellExercise,
  searchSinfulShellExercises,
  sinfulShellMuscleFilters,
} from '../data/sinfulShellCatalog'

export type SinfulShellBrowserMode = 'catalog' | 'routine-add'

export function SinfulShellBrowserSheet({
  catalog,
  disabled,
  imageSrcByAssetId,
  mode,
  onAddCopy,
  onAddCopyToRoutine,
  onClose,
  onViewCatalogCopy,
}: SinfulShellBrowserSheetProps) {
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'Todos'>('Todos')
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  const catalogCopyBySinfulShellId = useMemo(
    () => new Map(catalog.filter((item) => item.sinfulShellId).map((item) => [item.sinfulShellId, item])),
    [catalog],
  )
  const results = useMemo(() => searchSinfulShellExercises({ muscle, query }), [muscle, query])
  const selectedExercise = results.find((exercise) => exercise.id === selectedExerciseId) ?? null

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
      <button aria-label="Cerrar Sinful Shell" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]">
        {/* Implement sticky header, browser list, and detail below. */}
      </section>
    </div>
  )
}
```

Define `SinfulShellBrowserSheetProps` exactly as listed in Interfaces.

- [ ] **Step 4: Implement browser list**

Inside the sheet when no detail is selected:

- Header title: `Sinful Shell`
- Search input:
  - role should be `searchbox`
  - `aria-label="Buscar en Sinful Shell"`
  - input hint `Buscar ejercicio o alias`
- Muscle chips from `sinfulShellMuscleFilters` with `aria-pressed={muscle === option}`
- Results wrapper: `data-testid="sinful-shell-results"`
- Each result button:
  - `aria-label={`${exercise.name} ${copy ? 'Agregado' : 'Disponible'}`}`
  - `ExerciseArt` with `bundledAssetId={exercise.bundledAssetId}`
  - name, muscle, and status pill.
- Empty state copy: `Sin coincidencias en Sinful Shell.`

Use stable grid/list classes similar to existing catalog rows:

```tsx
className="grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-4 rounded-[12px] border border-white/10 bg-arsen-surface p-2 text-left"
```

- [ ] **Step 5: Implement detail view**

When `selectedExercise` exists:

- Back button label: `Volver a Sinful Shell`
- Large `ExerciseArt` with `className="aspect-[4/3] w-full"`
- `h2` with exercise name
- muscle chip
- aliases section if `aliases.length > 0`
- notes in readonly paragraph
- status `Disponible` or `Ya agregado`
- If no copy:
  - button `Agregar a mi catalogo` calls `onAddCopy(selectedExercise)`
- If copy exists:
  - button `Ver en mi catalogo` calls `onViewCatalogCopy(copy)`
  - if `mode === 'routine-add' && onAddCopyToRoutine`, button `Agregar a la rutina` calls `onAddCopyToRoutine(copy)`

- [ ] **Step 6: Run browser tests**

Run: `pnpm test src/domains/routine/components/SinfulShellBrowserSheet.test.tsx`

Expected: PASS.

- [ ] **Step 7: Review checkpoint**

Verify:

- Card tap only selects detail; it does not call create/import callbacks.
- Detail has no blank image/name/muscle/notes areas.
- Sheet remains within 430px shell and uses theme tokens.

---

### Task 5: Routine Page Wiring And Editor Mode

**Files:**
- Modify: `src/domains/routine/pages/RoutinePage.tsx`
- Modify: `src/domains/routine/pages/RoutinePage.test.tsx`

**Interfaces:**
- Consumes:
  - `SinfulShellBrowserSheet` from Task 4
  - Service mode from Task 3
- Produces:
  - Catalog banner opens Sinful Shell browser.
  - Add Exercise sheet opens Sinful Shell browser.
  - `CatalogExerciseEditorSheet` supports `sourceSinfulShellExercise`.
  - Existing manual creation and catalog picking keep working.

- [ ] **Step 1: Write failing RoutinePage integration tests**

In `RoutinePage.test.tsx`, extend mocks:

```ts
const routinePageMocks = vi.hoisted(() => ({
  addCatalogExerciseToDay: vi.fn(() => Promise.resolve('exercise-1')),
  catalog: [] as RoutinePageCatalogItem[],
  createCatalogExercise: vi.fn(() => Promise.resolve('catalog-1')),
  // keep existing mocks...
}))
```

Make `useExerciseCatalog` return `routinePageMocks.catalog`.

Add tests:

```tsx
it('opens Sinful Shell from the catalog banner and opens detail before finalization', () => {
  render(
    <MemoryRouter>
      <RoutinePage />
    </MemoryRouter>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Catalogo' }))
  fireEvent.click(screen.getByRole('button', { name: /Explorar Sinful Shell/i }))
  fireEvent.click(screen.getByRole('button', { name: /Press inclinado/i }))

  expect(screen.getByRole('heading', { name: /Press inclinado/i })).toBeInTheDocument()
  expect(routinePageMocks.createCatalogExercise).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Agregar a mi catalogo' }))

  expect(screen.getByText(/Sinful Shell bloquea nombre/i)).toBeInTheDocument()
  expect(screen.getByDisplayValue(/Press inclinado/i)).toBeDisabled()
})

it('saves a Sinful Shell copy through create-from-sinful-shell mode', async () => {
  render(
    <MemoryRouter>
      <RoutinePage />
    </MemoryRouter>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Catalogo' }))
  fireEvent.click(screen.getByRole('button', { name: /Explorar Sinful Shell/i }))
  fireEvent.click(screen.getByRole('button', { name: /Press inclinado/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Agregar a mi catalogo' }))
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))

  await waitFor(() => {
    expect(routinePageMocks.createCatalogExercise).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'create-from-sinful-shell',
        sinfulShellId: 'sinful-shell-press-inclinado',
      }),
    )
  })
})

it('opens Sinful Shell from the add exercise sheet', () => {
  render(
    <MemoryRouter>
      <RoutinePage />
    </MemoryRouter>,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  fireEvent.click(screen.getByRole('button', { name: /Agregar ejercicio/i }))
  fireEvent.click(screen.getByRole('button', { name: 'Agregar desde Sinful Shell' }))

  expect(screen.getByRole('heading', { name: 'Sinful Shell' })).toBeInTheDocument()
})
```

Adjust selectors to match existing `RoutineEditor` add button label if needed, but keep the user-facing copy required by the spec.

- [ ] **Step 2: Run failing RoutinePage tests**

Run: `pnpm test src/domains/routine/pages/RoutinePage.test.tsx`

Expected: FAIL because UI wiring/editor mode does not exist.

- [ ] **Step 3: Add state and imports**

In `RoutinePage.tsx`, import:

```ts
import { SinfulShellBrowserSheet } from '../components/SinfulShellBrowserSheet'
import type { SinfulShellExercise } from '../data/sinfulShellCatalog'
import { sinfulShellCatalog } from '../data/sinfulShellCatalog'
```

Add state:

```ts
const [sinfulShellOpen, setSinfulShellOpen] = useState<null | { mode: 'catalog' | 'routine-add' }>(null)
const [catalogSheet, setCatalogSheet] = useState<CatalogSheetState>(null)
```

Change `CatalogSheetState` to:

```ts
type CatalogSheetState =
  | { item: ExerciseCatalogItem | null; sourceSinfulShellExercise?: null }
  | { item: null; sourceSinfulShellExercise: SinfulShellExercise }
  | null
```

- [ ] **Step 4: Wire CatalogPanel banner**

Extend `CatalogPanel` props:

```ts
onOpenSinfulShell: () => void
```

Render a compact button/banner before search:

```tsx
<button
  className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-[12px] border border-arsen-purple/30 bg-arsen-purple/10 p-3 text-left"
  onClick={onOpenSinfulShell}
  type="button"
>
  <span>
    <strong className="block text-sm">Explorar Sinful Shell</strong>
    <span className="mt-1 block text-xs font-semibold text-arsen-muted">{sinfulShellCatalog.length} ejercicios incluidos</span>
  </span>
  <ListPlus aria-hidden="true" className="size-5 text-arsen-purple2" />
</button>
```

At the call site:

```tsx
onOpenSinfulShell={() => setSinfulShellOpen({ mode: 'catalog' })}
```

- [ ] **Step 5: Wire Add Exercise sheet entry**

Extend `CatalogPickerSheet` props:

```ts
onOpenSinfulShell: () => void
```

At the top of the sheet, above personal catalog search, add two action rows:

```tsx
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
```

Remove or keep the old bottom `Crear nuevo en catalogo` action only if it does not duplicate confusingly. If kept, use the same copy `Crear ejercicio propio`.

At the call site:

```tsx
onOpenSinfulShell={() => setSinfulShellOpen({ mode: 'routine-add' })}
```

- [ ] **Step 6: Render SinfulShellBrowserSheet**

Add near other sheets:

```tsx
{sinfulShellOpen ? (
  <SinfulShellBrowserSheet
    catalog={catalog}
    disabled={isPending}
    imageSrcByAssetId={imageSrcByAssetId}
    mode={sinfulShellOpen.mode}
    onAddCopy={(exercise) => {
      setSinfulShellOpen(null)
      setCatalogPickerOpen(false)
      setCatalogSheet({ item: null, sourceSinfulShellExercise: exercise })
    }}
    onAddCopyToRoutine={(item) => {
      if (!bundle || !selectedDay) return
      setSinfulShellOpen(null)
      setCatalogPickerOpen(false)
      setRecipeSheet({ catalogItem: item, exercise: null, mode: 'add' })
    }}
    onClose={() => setSinfulShellOpen(null)}
    onViewCatalogCopy={(item) => {
      setSinfulShellOpen(null)
      setCatalogSheet({ item, sourceSinfulShellExercise: null })
    }}
  />
) : null}
```

- [ ] **Step 7: Extend CatalogExerciseEditorSheet props**

Add prop:

```ts
sourceSinfulShellExercise?: SinfulShellExercise | null
```

Initialize form:

```ts
const [form, setForm] = useState(() => catalogItemToForm(item, displayUnit, sourceSinfulShellExercise))
const isSinfulShellLocked = Boolean(sourceSinfulShellExercise || item?.sinfulShellContentLocked)
```

Update `catalogItemToForm` signature:

```ts
function catalogItemToForm(
  item: ExerciseCatalogItem | null,
  displayUnit: WeightUnit,
  sourceSinfulShellExercise?: SinfulShellExercise | null,
): CatalogExerciseForm
```

For source exercise, return protected values from source:

```ts
name: sourceSinfulShellExercise?.name ?? item?.name ?? '',
mainMuscle: normalizeMuscleGroup(sourceSinfulShellExercise?.mainMuscle ?? item?.mainMuscle),
bundledAssetId: sourceSinfulShellExercise?.bundledAssetId ?? item?.bundledAssetId ?? null,
customAssetId: sourceSinfulShellExercise ? null : item?.customAssetId ?? null,
technicalNotes: sourceSinfulShellExercise?.technicalNotes ?? item?.technicalNotes ?? '',
```

- [ ] **Step 8: Render locked editor UI**

In `CatalogExerciseEditorSheet`:

- Disable name field when locked.
- Disable muscle select when locked.
- Do not open image selector when locked.
- Render technical notes as readonly block or disabled textarea.
- Show copy:

```tsx
{isSinfulShellLocked ? (
  <p className="rounded-[10px] border border-arsen-purple/30 bg-arsen-purple/10 p-3 text-xs font-semibold text-arsen-muted">
    Sinful Shell bloquea nombre, musculo, imagen e indicaciones tecnicas.
  </p>
) : null}
```

For save:

```tsx
onSave({
  aliases: form.aliases.split(',').map((alias) => alias.trim()).filter(Boolean),
  assetKind: null,
  bundledAssetId: isSinfulShellLocked ? sourceSinfulShellExercise?.bundledAssetId ?? item?.bundledAssetId ?? null : form.bundledAssetId,
  customAssetId: isSinfulShellLocked ? null : form.customAssetId,
  mode: sourceSinfulShellExercise ? 'create-from-sinful-shell' : 'manual',
  sinfulShellId: sourceSinfulShellExercise?.id ?? item?.sinfulShellId ?? null,
  ...loadInputFromForm(form, displayUnit),
  mainMuscle: form.mainMuscle,
  name: form.name,
  technicalNotes: form.technicalNotes,
  warmupProtocol: selectedWarmupProtocol,
})
```

- [ ] **Step 9: Run RoutinePage tests**

Run: `pnpm test src/domains/routine/pages/RoutinePage.test.tsx`

Expected: PASS.

- [ ] **Step 10: Review checkpoint**

Verify:

- Personal catalog remains visible and editable.
- Sinful Shell does not replace the current catalog picker.
- Add-from-routine can create a copy first, then use that copy in the normal recipe flow.
- Locked controls are clear and not silently editable.

---

### Task 6: Backup, Import/Export, And Snapshot Coverage

**Files:**
- Modify: `src/domains/routine/importExport.test.ts`
- Modify: `src/domains/workout/services.ts` only if test reveals missing snapshot propagation
- Modify or create: `src/domains/workout/services.test.ts` if no existing test covers snapshots

**Interfaces:**
- Consumes:
  - Zod schema defaults from Task 2
  - Service create from Task 3
  - Existing `ensureExerciseLog`
- Produces:
  - Tests proving `origin` fields survive backup schemas and `bundledAssetId` remains in snapshots.

- [ ] **Step 1: Write import/export schema coverage**

If `src/domains/routine/importExport.test.ts` already covers routine transfer schemas, add a test that parses a routine export or backup with a Sinful Shell catalog item through the schema that owns catalog items. If full backup tests live in `src/shared/validation/arsenImportSchemas.test.ts`, place the test there instead.

Use this expected assertion:

```ts
expect(parsed.tables.exerciseCatalog[0]).toMatchObject({
  origin: 'sinful-shell',
  sinfulShellContentLocked: true,
  sinfulShellId: 'sinful-shell-press-inclinado',
})
```

Also assert a legacy item defaults:

```ts
expect(parsed.tables.exerciseCatalog[0]).toMatchObject({
  origin: 'user',
  sinfulShellContentLocked: false,
  sinfulShellId: null,
})
```

- [ ] **Step 2: Write snapshot propagation test if missing**

Add to a workout service test file:

```ts
it('snapshots bundledAssetId for routine exercises copied from Sinful Shell', async () => {
  const sessionId = await getOrCreateSessionForDay({
    date: '2026-08-11',
    dayId: 'day-1',
    displayUnit: 'kg',
    routineId: 'routine-1',
  })
  const exercise: RoutineExercise = {
    assetKind: null,
    barWeightKg: 20,
    bundledAssetId: 'press-inclinado--pecho',
    canonicalName: 'press-inclinado',
    createdAt: '2026-08-11T00:00:00.000Z',
    currentWeightKg: 0,
    customAssetId: null,
    dayId: 'day-1',
    equipment: 'Barra',
    id: 'exercise-1',
    loadMode: 'single',
    mainMuscle: 'Pecho',
    name: 'Press inclinado',
    order: 0,
    recommendedRir: 2,
    repsMax: 10,
    repsMin: 8,
    rest: '90 seg',
    restSeconds: 90,
    routineId: 'routine-1',
    sourceExerciseId: 'catalog-1',
    targetSets: 3,
    technicalNotes: '',
    updatedAt: '2026-08-11T00:00:00.000Z',
    warmupProtocol: 'none',
    warmupSets: 0,
  }

  const logId = await ensureExerciseLog(sessionId, exercise)
  expect((await db.exerciseLogs.get(logId))?.snapshot.bundledAssetId).toBe('press-inclinado--pecho')
})
```

If existing tests already assert this, add only the Sinful Shell context case.

- [ ] **Step 3: Run targeted backup/snapshot tests**

Run whichever files were changed:

- `pnpm test src/shared/validation/arsenImportSchemas.test.ts`
- `pnpm test src/domains/routine/importExport.test.ts`
- `pnpm test src/domains/workout/services.test.ts`

Expected: PASS after Task 2/3 work. If snapshot propagation fails, update `ensureExerciseLog` to copy `exercise.bundledAssetId` into `snapshot.bundledAssetId`.

- [ ] **Step 4: Review checkpoint**

Verify:

- Old backups do not require new fields.
- New backups preserve new fields.
- Snapshot image survives deleting the personal catalog copy.

---

### Task 7: Final Polish, Accessibility, And Full Verification

**Files:**
- Review all changed files from Tasks 1-6.
- Modify only files with concrete issues found during this task.

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: verified implementation ready for human review, without committing.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
pnpm test src/domains/routine/data/sinfulShellCatalog.test.ts
pnpm test src/domains/routine/services.test.ts
pnpm test src/domains/routine/components/SinfulShellBrowserSheet.test.tsx
pnpm test src/domains/routine/pages/RoutinePage.test.tsx
pnpm test src/shared/validation/arsenImportSchemas.test.ts
```

Expected: all PASS.

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `pnpm build`

Expected: PASS, including `tsc -b`, `vite build`, and `node scripts/generate-sw.mjs`.

- [ ] **Step 4: Inspect UI accessibility and mobile constraints in code**

Check:

- Search input has accessible name `Buscar en Sinful Shell`.
- Close/back buttons have labels.
- Muscle chips have selected state.
- No result/card layout uses unstable text-driven width.
- No raw hex/oklch was added to components.
- Copy is Spanish and consistent with existing no-accent style where existing code uses it.

- [ ] **Step 5: Review diff**

Run:

```bash
git diff -- src/domains/routine/data src/domains/routine/components src/domains/routine/pages/RoutinePage.tsx src/domains/routine/types.ts src/domains/routine/services.ts src/shared/validation/arsenImportSchemas.ts src/domains/workout/services.ts
git status --short
```

Expected:

- Only Sinful Shell and required compatibility files changed.
- No annex files outside the repo were modified.
- No generated/unrelated files were accidentally added.

- [ ] **Step 6: Final review checkpoint**

Confirm all acceptance criteria from `docs/superpowers/specs/2026-08-11-sinful-shell-catalog-design.md` have evidence from tests, build, or direct code inspection.

Do not claim completion until `verification-before-completion` has been invoked.
