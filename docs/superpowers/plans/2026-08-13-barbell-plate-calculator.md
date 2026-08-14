# Barbell Plate Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Project `AGENTS.md` forbids subagent-driven implementation for this task.

**Goal:** Build a configurable barbell plate calculator that shows what plates to load per side in `/entreno` while preserving Arsen's current barbell weight semantics.

**Architecture:** Extend the existing pure load helper in `shared/calculations/equipmentLoad.ts` so UI components continue consuming one compact load note. Store the global plate inventory on `AppSettings` as normalized kg values, expose a small settings service to update it, and pass the resolved inventory from workout settings into the current exercise card and register sheet.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Dexie, Vitest, Testing Library.

## Global Constraints

- Inline execution only; no implementation or review subagents.
- Do not commit, push, branch, or create a worktree.
- UI strings stay Spanish (`es-MX`).
- Storage weight is always kg; UI converts to lb using `shared/utils/weight.ts`.
- For `Barra`, `weightKg` remains total plate load excluding the bar.
- Only `equipment === 'Barra'` shows plate breakdown.
- The default configurable plate set is `[25, 20, 15, 10, 5, 2.5, 1.25]`.
- No Dexie schema bump unless indexes or tables change; this plan only adds a non-indexed settings field.
- Do not use raw colors in components; keep existing Tailwind tokens.

---

## File Structure

- Modify `src/shared/calculations/equipmentLoad.ts`: export default plates, normalize inventories, calculate greedy plate breakdown, and update `buildEquipmentLoadNote`.
- Modify `src/shared/calculations/equipmentLoad.test.ts`: cover exact, non-exact, invalid inventory, default note, and non-barbell hiding.
- Modify `src/domains/settings/types.ts`: add optional `availablePlateWeightsKg`.
- Modify `src/domains/settings/services.ts`: resolve and update the global inventory.
- Modify `src/db/seedDemoRoutine.ts`: seed first-run settings with default plates.
- Modify `src/shared/validation/arsenImportSchemas.ts`: default legacy settings to default plates and validate imported arrays.
- Modify `src/domains/settings/pages/SettingsPage.tsx`: add compact plate inventory editor.
- Modify `src/domains/settings/pages/SettingsPage.test.tsx`: test settings UI displays and saves custom plates.
- Modify `src/domains/workout/pages/WorkoutPage.tsx`: pass settings inventory into the load note and register sheet.
- Modify `src/domains/workout/pages/WorkoutPage.test.tsx`: assert configured inventory is used and non-barbell does not show the calculator.
- Modify `src/domains/workout/components/RegisterSetSheet.tsx`: accept `availablePlateWeightsKg` prop and pass it to the helper.
- Modify `src/domains/workout/components/RegisterSetSheet.test.tsx`: assert live recalculation with configured plates and hidden non-barbell note.

---

### Task 1: Plate Math Core

**Files:**
- Modify: `src/shared/calculations/equipmentLoad.ts`
- Modify: `src/shared/calculations/equipmentLoad.test.ts`

**Interfaces:**
- Produces: `DEFAULT_AVAILABLE_PLATES_KG: number[]`
- Produces: `normalizeAvailablePlateWeightsKg(value?: number[] | null): number[]`
- Produces: `calculatePlateBreakdown(input: { availablePlateWeightsKg?: number[] | null; targetWeightKg: number }): { isExact: boolean; matchedWeightKg: number; platesKg: number[]; remainingWeightKg: number }`
- Produces: `buildEquipmentLoadNote(input: { availablePlateWeightsKg?: number[] | null; barWeightKg?: number | null; equipment: unknown; loadMode?: LoadMode | null; unit: WeightUnit; weightKg: number }): string | null`

- [ ] **Step 1: Write failing unit tests**

Add these cases to `src/shared/calculations/equipmentLoad.test.ts`:

```ts
it('calculates exact barbell plates greedily without passing the target', () => {
  expect(calculatePlateBreakdown({ targetWeightKg: 30, availablePlateWeightsKg: [25, 20, 10, 5, 2.5] })).toEqual({
    isExact: true,
    matchedWeightKg: 30,
    platesKg: [25, 5],
    remainingWeightKg: 0,
  })
})

it('calculates the closest plate breakdown below a non-exact target', () => {
  expect(calculatePlateBreakdown({ targetWeightKg: 28.2, availablePlateWeightsKg: [25, 10, 5, 2.5] })).toEqual({
    isExact: false,
    matchedWeightKg: 27.5,
    platesKg: [25, 2.5],
    remainingWeightKg: 0.7,
  })
})

it('normalizes configurable plate inventory', () => {
  expect(normalizeAvailablePlateWeightsKg([2.5, 20, 0, Number.NaN, 2.5, -1, 10])).toEqual([20, 10, 2.5])
  expect(normalizeAvailablePlateWeightsKg([])).toEqual(DEFAULT_AVAILABLE_PLATES_KG)
})

it('builds a barbell note with concrete plates and remaining weight', () => {
  expect(
    buildEquipmentLoadNote({
      availablePlateWeightsKg: [25, 10, 5, 2.5],
      barWeightKg: 20,
      equipment: 'Barra',
      loadMode: 'split',
      unit: 'kg',
      weightKg: 56.4,
    }),
  ).toBe('Discos: 25 + 2.5 kg por lado - Faltan 0.7 kg por lado - Total con barra: 76.4 kg')
})
```

- [ ] **Step 2: Run focused failing tests**

Run: `pnpm test src/shared/calculations/equipmentLoad.test.ts`

Expected: FAIL because the new functions are not exported and the old note format is still present.

- [ ] **Step 3: Implement minimal helper changes**

In `equipmentLoad.ts`, add:

```ts
export const DEFAULT_AVAILABLE_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]
const WEIGHT_EPSILON = 0.0001

export function normalizeAvailablePlateWeightsKg(value?: number[] | null) {
  const normalized = [...new Set((value ?? []).filter((weight) => Number.isFinite(weight) && weight > 0).map(roundGymWeight))]
    .sort((a, b) => b - a)

  return normalized.length > 0 ? normalized : DEFAULT_AVAILABLE_PLATES_KG
}

export function calculatePlateBreakdown(input: { availablePlateWeightsKg?: number[] | null; targetWeightKg: number }) {
  const targetWeightKg = Math.max(roundGymWeight(input.targetWeightKg), 0)
  let remainingWeightKg = targetWeightKg
  const platesKg: number[] = []

  for (const plateKg of normalizeAvailablePlateWeightsKg(input.availablePlateWeightsKg)) {
    while (remainingWeightKg + WEIGHT_EPSILON >= plateKg) {
      platesKg.push(plateKg)
      remainingWeightKg = roundGymWeight(remainingWeightKg - plateKg)
    }
  }

  remainingWeightKg = remainingWeightKg <= WEIGHT_EPSILON ? 0 : roundGymWeight(remainingWeightKg)

  return {
    isExact: remainingWeightKg === 0,
    matchedWeightKg: roundGymWeight(targetWeightKg - remainingWeightKg),
    platesKg,
    remainingWeightKg,
  }
}

function roundGymWeight(value: number) {
  return Math.round(value * 100) / 100
}
```

Update the barbell branch in `buildEquipmentLoadNote`:

```ts
const breakdown = calculatePlateBreakdown({
  availablePlateWeightsKg: input.availablePlateWeightsKg,
  targetWeightKg: input.weightKg / 2,
})
const platesLabel = breakdown.platesKg.length > 0 ? breakdown.platesKg.join(' + ') : 'sin discos'
const parts = [`Discos: ${platesLabel} kg por lado`]
if (!breakdown.isExact) parts.push(`Faltan ${formatWeight(breakdown.remainingWeightKg, input.unit)} por lado`)
parts.push(`Total con barra: ${formatWeight(input.weightKg + settings.barWeightKg, input.unit)}`)
return parts.join(' - ')
```

- [ ] **Step 4: Run focused tests**

Run: `pnpm test src/shared/calculations/equipmentLoad.test.ts`

Expected: PASS.

---

### Task 2: Settings Persistence

**Files:**
- Modify: `src/domains/settings/types.ts`
- Modify: `src/domains/settings/services.ts`
- Modify: `src/db/seedDemoRoutine.ts`
- Modify: `src/shared/validation/arsenImportSchemas.ts`

**Interfaces:**
- Consumes: `DEFAULT_AVAILABLE_PLATES_KG`, `normalizeAvailablePlateWeightsKg`
- Produces: `AppSettings.availablePlateWeightsKg?: number[]`
- Produces: `resolveAvailablePlateWeightsKg(settings?: Pick<AppSettings, 'availablePlateWeightsKg'> | null): number[]`
- Produces: `updateAvailablePlateWeights(availablePlateWeightsKg: number[]): Promise<void>`

- [ ] **Step 1: Write failing settings service tests**

Add to `src/domains/settings/services.test.ts`:

```ts
import { DEFAULT_AVAILABLE_PLATES_KG } from '../../shared/calculations/equipmentLoad'
import { resolveAvailablePlateWeightsKg, updateAvailablePlateWeights } from './services'

it('resolves default plate weights when settings do not have an inventory', () => {
  expect(resolveAvailablePlateWeightsKg(null)).toEqual(DEFAULT_AVAILABLE_PLATES_KG)
  expect(resolveAvailablePlateWeightsKg({ availablePlateWeightsKg: [] })).toEqual(DEFAULT_AVAILABLE_PLATES_KG)
})

it('updates available plate weights normalized in kg', async () => {
  await db.settings.put(settings('routine-1', 'kg'))

  await updateAvailablePlateWeights([2.5, 20, 20, 0, 10])

  await expect(db.settings.get('app')).resolves.toMatchObject({
    availablePlateWeightsKg: [20, 10, 2.5],
  })
})
```

- [ ] **Step 2: Run focused failing settings tests**

Run: `pnpm test src/domains/settings/services.test.ts`

Expected: FAIL because the service exports and type field do not exist.

- [ ] **Step 3: Add the settings field and services**

In `src/domains/settings/types.ts`, add:

```ts
availablePlateWeightsKg?: number[]
```

In `src/domains/settings/services.ts`, import the helpers and add:

```ts
export function resolveAvailablePlateWeightsKg(settings?: Pick<AppSettings, 'availablePlateWeightsKg'> | null) {
  return normalizeAvailablePlateWeightsKg(settings?.availablePlateWeightsKg)
}

export async function updateAvailablePlateWeights(availablePlateWeightsKg: number[]) {
  await db.settings.update('app', {
    availablePlateWeightsKg: normalizeAvailablePlateWeightsKg(availablePlateWeightsKg),
    updatedAt: new Date().toISOString(),
  })
}
```

- [ ] **Step 4: Seed and import defaults**

In `src/db/seedDemoRoutine.ts`, set:

```ts
availablePlateWeightsKg: DEFAULT_AVAILABLE_PLATES_KG,
```

In `src/shared/validation/arsenImportSchemas.ts`, add to `appSettingsSchema`:

```ts
availablePlateWeightsKg: z.array(z.number()).optional().default(DEFAULT_AVAILABLE_PLATES_KG).transform(normalizeAvailablePlateWeightsKg),
```

- [ ] **Step 5: Run focused tests**

Run: `pnpm test src/domains/settings/services.test.ts src/shared/validation/arsenImportSchemas.test.ts src/db/indexeddb.test.ts`

Expected: PASS.

---

### Task 3: Settings UI

**Files:**
- Modify: `src/domains/settings/pages/SettingsPage.tsx`
- Modify: `src/domains/settings/pages/SettingsPage.test.tsx`

**Interfaces:**
- Consumes: `resolveAvailablePlateWeightsKg(settings)`, `updateAvailablePlateWeights(kgValues)`
- Consumes: `kgToUnit(valueKg, appSettings.preferredUnit)`, `unitToKg(value, appSettings.preferredUnit)`

- [ ] **Step 1: Write failing UI test**

In `SettingsPage.test.tsx`, hoist a mock for `updateAvailablePlateWeights` and add:

```ts
it('saves configurable available plates from the preferred unit', async () => {
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )

  expect(screen.getByLabelText('Discos disponibles')).toHaveValue('25, 20, 15, 10, 5, 2.5, 1.25')

  fireEvent.change(screen.getByLabelText('Discos disponibles'), { target: { value: '20, 10, 2.5' } })
  fireEvent.click(screen.getByRole('button', { name: 'Guardar discos' }))

  await waitFor(() => {
    expect(updateAvailablePlateWeights).toHaveBeenCalledWith([20, 10, 2.5])
  })
})
```

- [ ] **Step 2: Run focused failing UI test**

Run: `pnpm test src/domains/settings/pages/SettingsPage.test.tsx`

Expected: FAIL because the control is missing.

- [ ] **Step 3: Implement compact control**

Update imports, preserving the existing imports:

```ts
import { useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { Disc3 } from 'lucide-react'
import { kgToUnit, unitToKg } from '../../../shared/utils/weight'
import { resolveAvailablePlateWeightsKg, updateAvailablePlateWeights } from '../services'
```

Add state and syncing:

```ts
const preferredUnit = appSettings?.preferredUnit ?? 'kg'
const resolvedPlates = resolveAvailablePlateWeightsKg(appSettings)
const [platesValue, setPlatesValue] = useState('')

useEffect(() => {
  setPlatesValue(resolvedPlates.map((plate) => String(kgToUnit(plate, preferredUnit))).join(', '))
}, [preferredUnit, resolvedPlates.join('|')])
```

Add save function:

```ts
function savePlateWeights() {
  const rawValues = platesValue.split(',').map((value) => value.trim()).filter(Boolean)
  const values = rawValues.map(Number)

  if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
    setMessage('Escribe discos validos separados por coma')
    return
  }

  void runAction(
    'plates',
    () => updateAvailablePlateWeights(values.map((value) => unitToKg(value, preferredUnit))),
    'Discos actualizados',
  )
}
```

Place a `Card` near the existing units card:

```tsx
<Card className="grid gap-3 p-3">
  <div className="grid grid-cols-[42px_1fr] items-center gap-3">
    <div className="grid size-10 place-items-center text-arsen-purple2">
      <Disc3 aria-hidden="true" className="size-6" />
    </div>
    <div>
      <strong>Discos disponibles</strong>
      <span className="mt-1 block text-xs text-arsen-muted">Separados por coma, en {preferredUnit}</span>
    </div>
  </div>
  <label className="block">
    <span className="sr-only">Discos disponibles</span>
    <input
      className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-3 text-sm font-extrabold text-arsen-ink"
      onChange={(event) => setPlatesValue(event.target.value)}
      value={platesValue}
    />
  </label>
  <button
    className="min-h-10 rounded-[10px] border border-arsen-purple/40 px-3 text-sm font-extrabold text-arsen-purple2 disabled:opacity-50"
    disabled={busyAction === 'plates'}
    onClick={savePlateWeights}
    type="button"
  >
    Guardar discos
  </button>
</Card>
```

- [ ] **Step 4: Run focused UI test**

Run: `pnpm test src/domains/settings/pages/SettingsPage.test.tsx`

Expected: PASS.

---

### Task 4: Workout UI Wiring

**Files:**
- Modify: `src/domains/workout/pages/WorkoutPage.tsx`
- Modify: `src/domains/workout/pages/WorkoutPage.test.tsx`
- Modify: `src/domains/workout/components/RegisterSetSheet.tsx`
- Modify: `src/domains/workout/components/RegisterSetSheet.test.tsx`

**Interfaces:**
- Consumes: `workoutDay.settings.availablePlateWeightsKg`
- Consumes: `buildEquipmentLoadNote({ availablePlateWeightsKg, ... })`
- Produces: `RegisterSetSheetProps.availablePlateWeightsKg?: number[] | null`

- [ ] **Step 1: Write failing workout tests**

Update existing barbell assertions:

```ts
expect(screen.getByText('Discos: 25 + 5 kg por lado - Total con barra: 80 kg')).toBeInTheDocument()
```

Set mocked settings:

```ts
availablePlateWeightsKg: [25, 10, 5],
```

Add a non-barbell current exercise case by temporarily making the first mock exercise a dumbbell:

```ts
it('does not show plate calculator for dumbbells', () => {
  exercise.equipment = 'Mancuerna'
  exercise.loadMode = 'single'
  exercise.barWeightKg = 0

  render(<WorkoutPage />)

  expect(screen.queryByText(/Discos:/i)).not.toBeInTheDocument()
})
```

In the test `beforeEach`, restore the barbell defaults:

```ts
exercise.equipment = 'Barra'
exercise.loadMode = 'split'
exercise.barWeightKg = 20
```

For `RegisterSetSheet.test.tsx`, add:

```ts
it('uses configured plates when recalculating the barbell note', () => {
  render(<Sheet availablePlateWeightsKg={[20, 10]} onClose={vi.fn()} />)

  expect(screen.getByText('Discos: 20 + 10 kg por lado - Total con barra: 80 kg')).toBeInTheDocument()
})

it('does not show plate calculator for dumbbells', () => {
  render(<Sheet exercise={{ ...exercise, equipment: 'Mancuerna', loadMode: 'single', barWeightKg: 0 }} onClose={vi.fn()} />)

  expect(screen.queryByText(/Discos:/i)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run focused failing workout tests**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx src/domains/workout/components/RegisterSetSheet.test.tsx`

Expected: FAIL because props and note format are not wired.

- [ ] **Step 3: Wire inventory through workout page**

In `WorkoutPage.tsx`, derive:

```ts
const availablePlateWeightsKg = workoutDay?.settings.availablePlateWeightsKg
```

Pass it to `buildEquipmentLoadNote` for `currentLoadNote`:

```ts
availablePlateWeightsKg,
```

Pass it to `RegisterSetSheet`:

```tsx
availablePlateWeightsKg={availablePlateWeightsKg}
```

- [ ] **Step 4: Wire inventory through register sheet**

In `RegisterSetSheet.tsx`, add prop:

```ts
availablePlateWeightsKg?: number[] | null
```

Pass it into `buildEquipmentLoadNote`:

```ts
availablePlateWeightsKg,
```

- [ ] **Step 5: Run focused workout tests**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx src/domains/workout/components/RegisterSetSheet.test.tsx`

Expected: PASS.

---

### Task 5: Final Review And Verification

**Files:**
- Review all changed files.

**Interfaces:**
- Consumes all prior tasks.
- Produces verified implementation with no commits.

- [ ] **Step 1: Read review skills before review**

Read:

```powershell
Get-Content -Raw C:\Users\Chovy\.agents\skills\requesting-code-review\SKILL.md
Get-Content -Raw C:\Users\Chovy\.agents\skills\receiving-code-review\SKILL.md
Get-Content -Raw C:\Users\Chovy\.agents\skills\verification-before-completion\SKILL.md
```

- [ ] **Step 2: Run full test suite**

Run:

```powershell
pnpm test
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```powershell
pnpm build
```

Expected: PASS, including `scripts/generate-sw.mjs`.

- [ ] **Step 4: Run Impeccable detector**

Run:

```powershell
node C:\Users\Chovy\.agents\skills\impeccable\scripts\detect.mjs --json src\domains\workout\pages\WorkoutPage.tsx src\domains\workout\components\RegisterSetSheet.tsx src\domains\settings\pages\SettingsPage.tsx
```

Expected: no blocking UI issues. Fix any concrete findings once, then rerun only if fixes materially change UI.

- [ ] **Step 5: Inspect diff**

Run:

```powershell
git diff -- src docs
git status --short
```

Check:

- No unrelated files changed.
- No raw color additions in UI.
- No changes to barbell weight semantics.
- Tests cover exact and non-exact plate breakdown.
- No commit has been created.

---

## Self-Review

- Spec coverage: all acceptance criteria map to Tasks 1-4, with full verification in Task 5.
- Placeholder scan: no TODO/TBD placeholders are present.
- Type consistency: the same `availablePlateWeightsKg` field and helper names are used across settings, workout, and validation tasks.

