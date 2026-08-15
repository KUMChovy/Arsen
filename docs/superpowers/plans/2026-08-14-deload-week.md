# Semana De Deload Accionable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a global, persisted, programmable deload week that changes Arsen's active UI mode and reduces visible workout targets while preserving routine recipes and history.

**Architecture:** Add `deloadCycles` as the durable event/history table, keep user-tunable reduction percentages on `AppSettings`, and expose one settings-domain overview/action API for both Configuracion and `/entreno`. Pure deload math lives in `shared/calculations/deload.ts`; UI consumes derived targets and never mutates routines or logs to apply deload.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4 theme tokens, Dexie/IndexedDB, dexie-react-hooks, Vitest, Testing Library, fake-indexeddb.

## Global Constraints

- The deload remains global for the whole account; do not add `routineId`, `dayId`, `exerciseId`, or `muscle` to `DeloadCycle`.
- Deload length is exactly `7` calendar days from `startedAt`; it auto-completes on day 8 and can be completed manually while active.
- Suggestion window is weeks `5-7` since anchor.
- Skip cooldown is `14` days.
- Series reduction defaults to `50` and is clamped to `40-60`.
- Weight reduction defaults to `80` and is clamped to `70-90`.
- Storage weight remains kg; UI uses existing weight helpers for preferred-unit formatting.
- UI copy stays Spanish (`es-MX`) and mobile-first down to `360px`.
- Do not mutate routine recipes, `currentWeightKg`, snapshots, or workout logs to apply deload.
- Do not add dependencies.
- Do not commit unless the human explicitly approves that git operation.

---

## File Structure

- Create `src/shared/calculations/deload.ts`: constants, clamping, date-state helpers, and target reductions.
- Create `src/shared/calculations/deload.test.ts`: pure calculation and transition tests.
- Modify `src/domains/settings/types.ts`: add `DeloadCycle`, deload settings fields, overview/action types.
- Modify `src/db/schema.ts`: add `deloadCycles` table and schema version migration.
- Modify `src/db/seedDemoRoutine.ts`: seed deload reduction defaults.
- Modify `src/shared/validation/arsenImportSchemas.ts`: validate/default `deloadCycles` and new settings fields.
- Modify `src/shared/validation/arsenImportSchemas.test.ts`: backup compatibility/default tests.
- Modify `src/domains/settings/services.ts`: export/import table coverage and deload overview/action services.
- Modify `src/domains/settings/services.test.ts`: Dexie-backed deload lifecycle tests.
- Modify `src/domains/settings/notifications.ts`: route notification decisions through new overview.
- Modify `src/domains/settings/pages/SettingsPage.tsx`: add Deload section and actions.
- Modify `src/domains/settings/pages/SettingsPage.test.tsx`: focused UI tests for Deload settings.
- Modify `src/app/AppShell.tsx`: apply global deload active attribute/class.
- Modify `src/app/AppShell.test.tsx`: assert active attribute/class.
- Modify `src/styles.css`: add deload-active CSS variable overrides.
- Modify `src/domains/workout/hooks.ts`: expose deload overview to workout page.
- Modify `src/domains/workout/pages/WorkoutPage.tsx`: show deload card and adjusted active targets.
- Modify `src/domains/workout/pages/WorkoutPage.test.tsx`: focused UI tests for active deload targets/actions.

---

### Task 1: Pure Deload Calculations

**Files:**
- Create: `src/shared/calculations/deload.ts`
- Create: `src/shared/calculations/deload.test.ts`

**Interfaces:**
- Produces:
  - `DELOAD_SUGGESTION_MIN_WEEKS = 5`
  - `DELOAD_SUGGESTION_MAX_WEEKS = 7`
  - `DELOAD_LENGTH_DAYS = 7`
  - `DELOAD_SKIP_COOLDOWN_DAYS = 14`
  - `DEFAULT_DELOAD_SERIES_PERCENT = 50`
  - `DEFAULT_DELOAD_WEIGHT_PERCENT = 80`
  - `normalizeDeloadSeriesPercent(value: unknown): number`
  - `normalizeDeloadWeightPercent(value: unknown): number`
  - `getDeloadTargetSets(targetSets: number, seriesPercent: number): number`
  - `getDeloadSuggestedWeightKg(currentWeightKg: number, weightPercent: number): number`
  - `addDays(date: string, days: number): string`
  - `isDeloadSuggestionWindow(anchorDate: string | null, currentDate: string): boolean`
  - `daysRemainingInDeload(startedAt: string, currentDate: string): number`
  - `isDeloadComplete(startedAt: string, currentDate: string): boolean`

- Consumes:
  - Existing `weeksSince` from `src/shared/calculations/workout.ts`.

- [ ] **Step 1: Write failing pure calculation tests**

Add `src/shared/calculations/deload.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DELOAD_SERIES_PERCENT,
  DEFAULT_DELOAD_WEIGHT_PERCENT,
  addDays,
  daysRemainingInDeload,
  getDeloadSuggestedWeightKg,
  getDeloadTargetSets,
  isDeloadComplete,
  isDeloadSuggestionWindow,
  normalizeDeloadSeriesPercent,
  normalizeDeloadWeightPercent,
} from './deload'

describe('deload calculations', () => {
  it('normalizes reduction percentages into configured ranges', () => {
    expect(DEFAULT_DELOAD_SERIES_PERCENT).toBe(50)
    expect(DEFAULT_DELOAD_WEIGHT_PERCENT).toBe(80)
    expect(normalizeDeloadSeriesPercent(undefined)).toBe(50)
    expect(normalizeDeloadSeriesPercent(39)).toBe(40)
    expect(normalizeDeloadSeriesPercent(61)).toBe(60)
    expect(normalizeDeloadWeightPercent(undefined)).toBe(80)
    expect(normalizeDeloadWeightPercent(69)).toBe(70)
    expect(normalizeDeloadWeightPercent(91)).toBe(90)
  })

  it('reduces target sets with a minimum of one set', () => {
    expect(getDeloadTargetSets(5, 50)).toBe(3)
    expect(getDeloadTargetSets(3, 40)).toBe(1)
    expect(getDeloadTargetSets(1, 40)).toBe(1)
    expect(getDeloadTargetSets(0, 50)).toBe(1)
  })

  it('reduces suggested weight without inventing load', () => {
    expect(getDeloadSuggestedWeightKg(100, 80)).toBe(80)
    expect(getDeloadSuggestedWeightKg(62.5, 80)).toBe(50)
    expect(getDeloadSuggestedWeightKg(0, 80)).toBe(0)
    expect(getDeloadSuggestedWeightKg(-10, 80)).toBe(0)
  })

  it('detects suggestion window between weeks five and seven', () => {
    expect(isDeloadSuggestionWindow(null, '2026-02-12')).toBe(false)
    expect(isDeloadSuggestionWindow('2026-01-01', '2026-01-29')).toBe(false)
    expect(isDeloadSuggestionWindow('2026-01-01', '2026-02-05')).toBe(true)
    expect(isDeloadSuggestionWindow('2026-01-01', '2026-02-19')).toBe(true)
    expect(isDeloadSuggestionWindow('2026-01-01', '2026-02-26')).toBe(false)
  })

  it('handles seven-day active deload windows', () => {
    expect(addDays('2026-02-01', 7)).toBe('2026-02-08')
    expect(daysRemainingInDeload('2026-02-01', '2026-02-01')).toBe(7)
    expect(daysRemainingInDeload('2026-02-01', '2026-02-07')).toBe(1)
    expect(daysRemainingInDeload('2026-02-01', '2026-02-08')).toBe(0)
    expect(isDeloadComplete('2026-02-01', '2026-02-07')).toBe(false)
    expect(isDeloadComplete('2026-02-01', '2026-02-08')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the failing test**

Run: `pnpm test src/shared/calculations/deload.test.ts`

Expected: FAIL because `src/shared/calculations/deload.ts` does not exist.

- [ ] **Step 3: Implement pure calculations**

Create `src/shared/calculations/deload.ts`:

```ts
import { weeksSince } from './workout'

export const DELOAD_SUGGESTION_MIN_WEEKS = 5
export const DELOAD_SUGGESTION_MAX_WEEKS = 7
export const DELOAD_LENGTH_DAYS = 7
export const DELOAD_SKIP_COOLDOWN_DAYS = 14
export const DELOAD_SERIES_PERCENT_MIN = 40
export const DELOAD_SERIES_PERCENT_MAX = 60
export const DELOAD_WEIGHT_PERCENT_MIN = 70
export const DELOAD_WEIGHT_PERCENT_MAX = 90
export const DEFAULT_DELOAD_SERIES_PERCENT = 50
export const DEFAULT_DELOAD_WEIGHT_PERCENT = 80

export function normalizeDeloadSeriesPercent(value: unknown) {
  return clampPercent(value, DEFAULT_DELOAD_SERIES_PERCENT, DELOAD_SERIES_PERCENT_MIN, DELOAD_SERIES_PERCENT_MAX)
}

export function normalizeDeloadWeightPercent(value: unknown) {
  return clampPercent(value, DEFAULT_DELOAD_WEIGHT_PERCENT, DELOAD_WEIGHT_PERCENT_MIN, DELOAD_WEIGHT_PERCENT_MAX)
}

export function getDeloadTargetSets(targetSets: number, seriesPercent: number) {
  const normalizedTarget = Number.isFinite(targetSets) ? targetSets : 0
  return Math.max(1, Math.round(normalizedTarget * normalizeDeloadSeriesPercent(seriesPercent) / 100))
}

export function getDeloadSuggestedWeightKg(currentWeightKg: number, weightPercent: number) {
  if (!Number.isFinite(currentWeightKg) || currentWeightKg <= 0) return 0
  return currentWeightKg * normalizeDeloadWeightPercent(weightPercent) / 100
}

export function isDeloadSuggestionWindow(anchorDate: string | null, currentDate: string) {
  if (!anchorDate) return false
  const weeks = weeksSince(anchorDate, currentDate)
  return weeks >= DELOAD_SUGGESTION_MIN_WEEKS && weeks <= DELOAD_SUGGESTION_MAX_WEEKS
}

export function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00`)
  parsed.setDate(parsed.getDate() + days)
  return parsed.toISOString().slice(0, 10)
}

export function isDeloadComplete(startedAt: string, currentDate: string) {
  return currentDate >= addDays(startedAt, DELOAD_LENGTH_DAYS)
}

export function daysRemainingInDeload(startedAt: string, currentDate: string) {
  const endDate = addDays(startedAt, DELOAD_LENGTH_DAYS)
  const end = new Date(`${endDate}T00:00:00`).getTime()
  const current = new Date(`${currentDate}T00:00:00`).getTime()
  if (Number.isNaN(end) || Number.isNaN(current) || current >= end) return 0
  return Math.ceil((end - current) / (24 * 60 * 60 * 1000))
}

function clampPercent(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback
  return Math.min(max, Math.max(min, Math.round(numeric)))
}
```

- [ ] **Step 4: Run pure calculation tests**

Run: `pnpm test src/shared/calculations/deload.test.ts`

Expected: PASS.

---

### Task 2: Persist Deload Cycles And Backup Schema

**Files:**
- Modify: `src/domains/settings/types.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/db/seedDemoRoutine.ts`
- Modify: `src/shared/validation/arsenImportSchemas.ts`
- Modify: `src/shared/validation/arsenImportSchemas.test.ts`
- Modify: `src/domains/settings/services.ts`
- Modify: `src/db/indexeddb.test.ts`

**Interfaces:**
- Consumes:
  - Normalizers from `src/shared/calculations/deload.ts`.
- Produces:
  - `DeloadCycleStatus`
  - `DeloadCycle`
  - `AppSettings.deloadSeriesReductionPercent`
  - `AppSettings.deloadWeightReductionPercent`
  - `db.deloadCycles`

- [ ] **Step 1: Write failing backup/schema tests**

In `src/shared/validation/arsenImportSchemas.test.ts`, add:

```ts
it('defaults deload settings and accepts missing deload cycles in old backups', () => {
  const result = backupSchema.safeParse({
    tables: {
      settings: [
        {
          activeRoutineId: 'routine-1',
          createdAt: now,
          deloadNotifications: true,
          id: 'app',
          preferredUnit: 'kg',
          schemaVersion: 6,
          storagePersisted: null,
          updatedAt: now,
        },
      ],
    },
  })

  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.tables.deloadCycles).toEqual([])
  expect(result.data.tables.settings[0]?.deloadSeriesReductionPercent).toBe(50)
  expect(result.data.tables.settings[0]?.deloadWeightReductionPercent).toBe(80)
})

it('clamps imported deload reduction settings and parses deload cycles', () => {
  const result = backupSchema.safeParse({
    tables: {
      deloadCycles: [
        {
          completedAt: null,
          createdAt: now,
          id: 'deload-1',
          scheduledStartDate: '2026-02-01',
          skippedAt: null,
          startedAt: null,
          status: 'scheduled',
          suggestedAt: '2026-01-20',
          updatedAt: now,
        },
      ],
      settings: [
        {
          activeRoutineId: 'routine-1',
          createdAt: now,
          deloadNotifications: true,
          deloadSeriesReductionPercent: 99,
          deloadWeightReductionPercent: 10,
          id: 'app',
          preferredUnit: 'kg',
          schemaVersion: 6,
          storagePersisted: null,
          updatedAt: now,
        },
      ],
    },
  })

  expect(result.success).toBe(true)
  if (!result.success) return
  expect(result.data.tables.settings[0]?.deloadSeriesReductionPercent).toBe(60)
  expect(result.data.tables.settings[0]?.deloadWeightReductionPercent).toBe(70)
  expect(result.data.tables.deloadCycles[0]?.status).toBe('scheduled')
})
```

In `src/db/indexeddb.test.ts`, add an import-focused table coverage test:

```ts
it('imports deload cycles in full backups', async () => {
  await importFullBackup(
    backupFile({
      deloadCycles: [
        {
          completedAt: '2026-02-08',
          createdAt: now,
          id: 'deload-1',
          scheduledStartDate: null,
          skippedAt: null,
          startedAt: '2026-02-01',
          status: 'completed',
          suggestedAt: '2026-01-25',
          updatedAt: now,
        },
      ],
      settings: [settings('routine-1', 'kg')],
    }),
    'replace',
  )

  await expect(db.deloadCycles.get('deload-1')).resolves.toMatchObject({ status: 'completed' })
})
```

Also update the local `backupFile` helper type to accept `deloadCycles?: DeloadCycle[]`.

- [ ] **Step 2: Run failing focused tests**

Run: `pnpm test src/shared/validation/arsenImportSchemas.test.ts src/db/indexeddb.test.ts`

Expected: FAIL because `deloadCycles` and fields do not exist.

- [ ] **Step 3: Add types**

In `src/domains/settings/types.ts`, add:

```ts
export type DeloadCycleStatus = 'suggested' | 'scheduled' | 'active' | 'completed' | 'skipped'

export type DeloadCycle = {
  id: string
  status: DeloadCycleStatus
  suggestedAt: string | null
  scheduledStartDate: string | null
  startedAt: string | null
  completedAt: string | null
  skippedAt: string | null
  createdAt: string
  updatedAt: string
}
```

Add optional fields to `AppSettings`:

```ts
  deloadSeriesReductionPercent?: number
  deloadWeightReductionPercent?: number
```

- [ ] **Step 4: Add Dexie table and migration**

In `src/db/schema.ts`:

```ts
import type { AppSettings, DeloadCycle } from '../domains/settings/types'
import { DEFAULT_DELOAD_SERIES_PERCENT, DEFAULT_DELOAD_WEIGHT_PERCENT } from '../shared/calculations/deload'
```

Add table property:

```ts
  deloadCycles!: Table<DeloadCycle, string>
```

Bump:

```ts
export const CURRENT_SCHEMA_VERSION = 7
```

Add version block after version 6:

```ts
    this.version(7)
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
        deloadCycles: 'id, status, startedAt, completedAt, scheduledStartDate, skippedAt, updatedAt',
      })
      .upgrade((tx) =>
        tx
          .table('settings')
          .toCollection()
          .modify((settings) => {
            settings.deloadSeriesReductionPercent =
              typeof settings.deloadSeriesReductionPercent === 'number'
                ? settings.deloadSeriesReductionPercent
                : DEFAULT_DELOAD_SERIES_PERCENT
            settings.deloadWeightReductionPercent =
              typeof settings.deloadWeightReductionPercent === 'number'
                ? settings.deloadWeightReductionPercent
                : DEFAULT_DELOAD_WEIGHT_PERCENT
          }),
      )
```

- [ ] **Step 5: Seed defaults**

In `src/db/seedDemoRoutine.ts`, set:

```ts
    deloadSeriesReductionPercent: DEFAULT_DELOAD_SERIES_PERCENT,
    deloadWeightReductionPercent: DEFAULT_DELOAD_WEIGHT_PERCENT,
```

Import the constants from `src/shared/calculations/deload.ts`.

- [ ] **Step 6: Update import validation schemas**

In `src/shared/validation/arsenImportSchemas.ts`, import normalizers:

```ts
import {
  DEFAULT_DELOAD_SERIES_PERCENT,
  DEFAULT_DELOAD_WEIGHT_PERCENT,
  normalizeDeloadSeriesPercent,
  normalizeDeloadWeightPercent,
} from '../calculations/deload'
```

Add:

```ts
const deloadCycleStatusSchema = z.enum(['suggested', 'scheduled', 'active', 'completed', 'skipped'])

export const deloadCycleSchema = z
  .object({
    completedAt: z.string().nullable().optional().default(null),
    createdAt: z.string(),
    id: z.string().min(1),
    scheduledStartDate: z.string().nullable().optional().default(null),
    skippedAt: z.string().nullable().optional().default(null),
    startedAt: z.string().nullable().optional().default(null),
    status: deloadCycleStatusSchema,
    suggestedAt: z.string().nullable().optional().default(null),
    updatedAt: z.string(),
  })
  .passthrough()
```

Extend `appSettingsSchema`:

```ts
    deloadSeriesReductionPercent: z.number().optional().default(DEFAULT_DELOAD_SERIES_PERCENT).transform(normalizeDeloadSeriesPercent),
    deloadWeightReductionPercent: z.number().optional().default(DEFAULT_DELOAD_WEIGHT_PERCENT).transform(normalizeDeloadWeightPercent),
```

Extend `backupSchema.tables`:

```ts
        deloadCycles: z.array(deloadCycleSchema).optional().default([]),
```

- [ ] **Step 7: Update backup services**

In `src/domains/settings/services.ts`, import `DeloadCycle` type and include table:

```ts
      deloadCycles: await db.deloadCycles.toArray(),
```

Add `db.deloadCycles` to `importFullBackup` transaction list, `clearBackupTables`, and `putBackupTables`:

```ts
    db.deloadCycles,
```

```ts
    db.deloadCycles.clear(),
```

```ts
    db.deloadCycles.bulkPut(tables.deloadCycles ?? []),
```

Extend `BackupTables`:

```ts
  deloadCycles?: DeloadCycle[]
```

- [ ] **Step 8: Fix tests and run focused suite**

Run: `pnpm test src/shared/validation/arsenImportSchemas.test.ts src/db/indexeddb.test.ts`

Expected: PASS.

---

### Task 3: Deload Overview And Lifecycle Services

**Files:**
- Modify: `src/domains/settings/types.ts`
- Modify: `src/domains/settings/services.ts`
- Modify: `src/domains/settings/services.test.ts`

**Interfaces:**
- Consumes:
  - `DeloadCycle`
  - `db.deloadCycles`
  - Deload calculation constants/helpers.
- Produces:
  - `DeloadPhase`
  - `DeloadOverview`
  - `getDeloadOverview(currentDate?: string): Promise<DeloadOverview>`
  - `scheduleDeload(startDate: string, currentDate?: string): Promise<void>`
  - `startDeloadNow(currentDate?: string): Promise<void>`
  - `skipDeloadSuggestion(currentDate?: string): Promise<void>`
  - `completeActiveDeload(currentDate?: string): Promise<void>`
  - `updateDeloadReductionSettings(input: { seriesReductionPercent: number; weightReductionPercent: number }): Promise<void>`

- [ ] **Step 1: Write failing lifecycle service tests**

In `src/domains/settings/services.test.ts`, import new functions and add:

```ts
describe('deload services', () => {
  beforeEach(async () => {
    await resetDb()
    await db.settings.put(appSettings())
  })

  it('anchors suggestions to the last completed deload when one exists', async () => {
    await db.workoutSessions.put(workoutSession({ date: '2026-01-01', id: 'session-1' }))
    await db.deloadCycles.put({
      completedAt: '2026-02-01',
      createdAt: now,
      id: 'deload-1',
      scheduledStartDate: null,
      skippedAt: null,
      startedAt: '2026-01-25',
      status: 'completed',
      suggestedAt: '2026-01-20',
      updatedAt: now,
    })

    const overview = await getDeloadOverview('2026-03-12')

    expect(overview.anchorDate).toBe('2026-02-01')
    expect(overview.lastCompletedDate).toBe('2026-02-01')
    expect(overview.weeksSinceAnchor).toBe(5)
    expect(overview.phase).toBe('suggested')
    expect(overview.currentCycle?.status).toBe('suggested')
  })

  it('falls back to first workout session when no deload has completed', async () => {
    await db.workoutSessions.put(workoutSession({ date: '2026-01-01', id: 'session-1' }))

    const overview = await getDeloadOverview('2026-02-05')

    expect(overview.anchorDate).toBe('2026-01-01')
    expect(overview.firstLogDate).toBe('2026-01-01')
    expect(overview.phase).toBe('suggested')
  })

  it('schedules a future deload and activates it on the scheduled date', async () => {
    await scheduleDeload('2026-02-10', '2026-02-01')
    await expect(getDeloadOverview('2026-02-09')).resolves.toMatchObject({
      phase: 'scheduled',
    })

    const overview = await getDeloadOverview('2026-02-10')

    expect(overview.phase).toBe('active')
    expect(overview.currentCycle).toMatchObject({
      scheduledStartDate: '2026-02-10',
      startedAt: '2026-02-10',
      status: 'active',
    })
  })

  it('starts now and auto-completes after seven calendar days', async () => {
    await startDeloadNow('2026-02-01')

    expect(await getDeloadOverview('2026-02-07')).toMatchObject({
      daysRemaining: 1,
      phase: 'active',
    })

    const overview = await getDeloadOverview('2026-02-08')

    expect(overview.phase).toBe('completed')
    expect(overview.currentCycle).toMatchObject({
      completedAt: '2026-02-08',
      status: 'completed',
    })
  })

  it('skips a suggestion and suppresses a new one during cooldown', async () => {
    await db.workoutSessions.put(workoutSession({ date: '2026-01-01', id: 'session-1' }))
    await getDeloadOverview('2026-02-05')
    await skipDeloadSuggestion('2026-02-05')

    expect(await getDeloadOverview('2026-02-06')).toMatchObject({
      cooldownUntil: '2026-02-19',
      phase: 'idle',
      shouldNotify: false,
    })
  })

  it('updates deload reduction settings with clamped values', async () => {
    await updateDeloadReductionSettings({
      seriesReductionPercent: 99,
      weightReductionPercent: 10,
    })

    await expect(db.settings.get('app')).resolves.toMatchObject({
      deloadSeriesReductionPercent: 60,
      deloadWeightReductionPercent: 70,
    })
  })
})
```

Add this helper near existing test helpers:

```ts
function workoutSession(input: { date: string; id: string }): WorkoutSession {
  return {
    createdAt: now,
    date: input.date,
    dayId: 'day-1',
    displayUnit: 'kg',
    id: input.id,
    notes: '',
    routineId: 'routine-1',
    status: 'completed',
    updatedAt: now,
  }
}
```

- [ ] **Step 2: Run failing service tests**

Run: `pnpm test src/domains/settings/services.test.ts`

Expected: FAIL because lifecycle services do not exist.

- [ ] **Step 3: Add overview/action types**

In `src/domains/settings/types.ts`, add:

```ts
export type DeloadPhase = 'idle' | 'suggested' | 'scheduled' | 'active' | 'completed'

export type DeloadOverview = {
  phase: DeloadPhase
  currentCycle: DeloadCycle | null
  anchorDate: string | null
  firstLogDate: string | null
  lastCompletedDate: string | null
  weeksSinceAnchor: number
  seriesReductionPercent: number
  weightReductionPercent: number
  cooldownUntil: string | null
  daysRemaining: number | null
  shouldNotify: boolean
}
```

- [ ] **Step 4: Implement lifecycle services in settings domain**

In `src/domains/settings/services.ts`, import:

```ts
import {
  DELOAD_SKIP_COOLDOWN_DAYS,
  addDays,
  daysRemainingInDeload,
  isDeloadComplete,
  isDeloadSuggestionWindow,
  normalizeDeloadSeriesPercent,
  normalizeDeloadWeightPercent,
} from '../../shared/calculations/deload'
import { createId } from '../../shared/utils/id'
import type { DeloadCycle, DeloadOverview } from './types'
import { weeksSince } from '../../shared/calculations/workout'
```

Add helper:

```ts
const OPEN_DELOAD_STATUSES = ['suggested', 'scheduled', 'active'] as const

function isOpenDeloadStatus(status: DeloadCycle['status']) {
  return OPEN_DELOAD_STATUSES.some((candidate) => candidate === status)
}
```

Implement:

```ts
export async function getDeloadOverview(currentDate = localDateKey(new Date())): Promise<DeloadOverview> {
  await applyDeloadDateTransitions(currentDate)

  const [settings, firstSession, cycles] = await Promise.all([
    db.settings.get('app'),
    db.workoutSessions.orderBy('date').first(),
    db.deloadCycles.toArray(),
  ])
  const sortedCycles = cycles.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const currentCycle = sortedCycles.find((cycle) => isOpenDeloadStatus(cycle.status)) ?? null
  const lastCompleted = cycles
    .filter((cycle) => cycle.status === 'completed' && cycle.completedAt)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))[0] ?? null
  const lastSkipped = cycles
    .filter((cycle) => cycle.status === 'skipped' && cycle.skippedAt)
    .sort((a, b) => b.skippedAt!.localeCompare(a.skippedAt!))[0] ?? null
  const cooldownUntil = lastSkipped?.skippedAt ? addDays(lastSkipped.skippedAt, DELOAD_SKIP_COOLDOWN_DAYS) : null
  const cooldownActive = Boolean(cooldownUntil && currentDate < cooldownUntil)
  const firstLogDate = firstSession?.date ?? null
  const lastCompletedDate = lastCompleted?.completedAt ?? null
  const anchorDate = lastCompletedDate ?? firstLogDate
  const weeksSinceAnchor = anchorDate ? weeksSince(anchorDate, currentDate) : 0
  const seriesReductionPercent = normalizeDeloadSeriesPercent(settings?.deloadSeriesReductionPercent)
  const weightReductionPercent = normalizeDeloadWeightPercent(settings?.deloadWeightReductionPercent)

  if (currentCycle) {
    return {
      anchorDate,
      cooldownUntil: cooldownActive ? cooldownUntil : null,
      currentCycle,
      daysRemaining: currentCycle.status === 'active' && currentCycle.startedAt ? daysRemainingInDeload(currentCycle.startedAt, currentDate) : null,
      firstLogDate,
      lastCompletedDate,
      phase: currentCycle.status === 'suggested' || currentCycle.status === 'scheduled' || currentCycle.status === 'active' ? currentCycle.status : 'idle',
      seriesReductionPercent,
      shouldNotify: currentCycle.status === 'suggested',
      weeksSinceAnchor,
      weightReductionPercent,
    }
  }

  const justCompleted = sortedCycles.find((cycle) => cycle.status === 'completed' && cycle.completedAt === currentDate) ?? null
  if (justCompleted) {
    return {
      anchorDate: justCompleted.completedAt,
      cooldownUntil: null,
      currentCycle: justCompleted,
      daysRemaining: null,
      firstLogDate,
      lastCompletedDate: justCompleted.completedAt,
      phase: 'completed',
      seriesReductionPercent,
      shouldNotify: false,
      weeksSinceAnchor: 0,
      weightReductionPercent,
    }
  }

  if (!cooldownActive && isDeloadSuggestionWindow(anchorDate, currentDate)) {
    const suggested = await createSuggestedDeload(currentDate)
    return {
      anchorDate,
      cooldownUntil: null,
      currentCycle: suggested,
      daysRemaining: null,
      firstLogDate,
      lastCompletedDate,
      phase: 'suggested',
      seriesReductionPercent,
      shouldNotify: true,
      weeksSinceAnchor,
      weightReductionPercent,
    }
  }

  return {
    anchorDate,
    cooldownUntil: cooldownActive ? cooldownUntil : null,
    currentCycle: null,
    daysRemaining: null,
    firstLogDate,
    lastCompletedDate,
    phase: 'idle',
    seriesReductionPercent,
    shouldNotify: false,
    weeksSinceAnchor,
    weightReductionPercent,
  }
}
```

Add action implementations:

```ts
export async function scheduleDeload(startDate: string, currentDate = localDateKey(new Date())) {
  if (!startDate || startDate <= currentDate) throw new Error('Programa una fecha futura')
  const now = new Date().toISOString()
  await db.transaction('rw', db.deloadCycles, async () => {
    await closeOpenDeloadCycles(now, 'skipped', currentDate)
    await db.deloadCycles.add({
      completedAt: null,
      createdAt: now,
      id: createId('deload'),
      scheduledStartDate: startDate,
      skippedAt: null,
      startedAt: null,
      status: 'scheduled',
      suggestedAt: null,
      updatedAt: now,
    })
  })
}

export async function startDeloadNow(currentDate = localDateKey(new Date())) {
  const now = new Date().toISOString()
  await db.transaction('rw', db.deloadCycles, async () => {
    await closeOpenDeloadCycles(now, 'skipped', currentDate)
    await db.deloadCycles.add({
      completedAt: null,
      createdAt: now,
      id: createId('deload'),
      scheduledStartDate: null,
      skippedAt: null,
      startedAt: currentDate,
      status: 'active',
      suggestedAt: null,
      updatedAt: now,
    })
  })
}

export async function skipDeloadSuggestion(currentDate = localDateKey(new Date())) {
  const now = new Date().toISOString()
  const open = await getOpenDeloadCycle()
  if (!open || open.status !== 'suggested') return
  await db.deloadCycles.update(open.id, {
    skippedAt: currentDate,
    status: 'skipped',
    updatedAt: now,
  })
}

export async function completeActiveDeload(currentDate = localDateKey(new Date())) {
  const now = new Date().toISOString()
  const open = await getOpenDeloadCycle()
  if (!open || open.status !== 'active') return
  await db.deloadCycles.update(open.id, {
    completedAt: currentDate,
    status: 'completed',
    updatedAt: now,
  })
}

export async function updateDeloadReductionSettings(input: {
  seriesReductionPercent: number
  weightReductionPercent: number
}) {
  await db.settings.update('app', {
    deloadSeriesReductionPercent: normalizeDeloadSeriesPercent(input.seriesReductionPercent),
    deloadWeightReductionPercent: normalizeDeloadWeightPercent(input.weightReductionPercent),
    updatedAt: new Date().toISOString(),
  })
}
```

Add private helpers:

```ts
async function applyDeloadDateTransitions(currentDate: string) {
  const now = new Date().toISOString()
  const open = await getOpenDeloadCycle()
  if (!open) return

  if (open.status === 'scheduled' && open.scheduledStartDate && open.scheduledStartDate <= currentDate) {
    await db.deloadCycles.update(open.id, {
      startedAt: open.scheduledStartDate,
      status: 'active',
      updatedAt: now,
    })
    return
  }

  if (open.status === 'active' && open.startedAt && isDeloadComplete(open.startedAt, currentDate)) {
    await db.deloadCycles.update(open.id, {
      completedAt: currentDate,
      status: 'completed',
      updatedAt: now,
    })
  }
}

async function getOpenDeloadCycle() {
  const cycles = await db.deloadCycles.toArray()
  return cycles
    .filter((cycle) => isOpenDeloadStatus(cycle.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
}

async function createSuggestedDeload(currentDate: string) {
  const existing = await getOpenDeloadCycle()
  if (existing) return existing
  const now = new Date().toISOString()
  const cycle: DeloadCycle = {
    completedAt: null,
    createdAt: now,
    id: createId('deload'),
    scheduledStartDate: null,
    skippedAt: null,
    startedAt: null,
    status: 'suggested',
    suggestedAt: currentDate,
    updatedAt: now,
  }
  await db.deloadCycles.add(cycle)
  return cycle
}

async function closeOpenDeloadCycles(now: string, status: 'skipped', currentDate: string) {
  const openCycles = (await db.deloadCycles.toArray()).filter((cycle) => isOpenDeloadStatus(cycle.status))
  await Promise.all(
    openCycles.map((cycle) =>
      db.deloadCycles.update(cycle.id, {
        skippedAt: status === 'skipped' ? currentDate : cycle.skippedAt,
        status,
        updatedAt: now,
      }),
    ),
  )
}
```

- [ ] **Step 5: Run service tests**

Run: `pnpm test src/domains/settings/services.test.ts`

Expected: PASS.

---

### Task 4: Route Notifications Through The New Overview

**Files:**
- Modify: `src/domains/settings/notifications.ts`
- Modify: `src/domains/settings/pages/SettingsPage.test.tsx`

**Interfaces:**
- Consumes:
  - `getDeloadOverview` from `src/domains/settings/services.ts`.
- Produces:
  - Existing `requestDeloadNotifications()`
  - Existing `notifyDeloadIfNeeded()`

- [ ] **Step 1: Update mocks that import `getDeloadOverview` from notifications**

In `src/domains/settings/pages/SettingsPage.test.tsx`, move `getDeloadOverview` mocking from `../notifications` to `../services` once SettingsPage imports it from services in Task 6.

Use this mock shape:

```ts
getDeloadOverview: () => ({
  anchorDate: '2026-07-01',
  cooldownUntil: null,
  currentCycle: null,
  daysRemaining: null,
  firstLogDate: '2026-07-01',
  lastCompletedDate: null,
  phase: 'idle',
  seriesReductionPercent: 50,
  shouldNotify: false,
  weeksSinceAnchor: 2,
  weightReductionPercent: 80,
}),
```

- [ ] **Step 2: Update notifications implementation**

In `src/domains/settings/notifications.ts`, remove `shouldNotifyDeload` and `weeksSince` imports. Import:

```ts
import { getDeloadOverview } from './services'
```

Delete the old exported `getDeloadOverview` from this file.

Update notification body:

```ts
  new Notification('Arsen: semana de deload', {
    body: `Van ${deload.weeksSinceAnchor} semanas desde tu ultima referencia. Considera una semana de descarga.`,
    icon: '/icon.svg',
  })
```

Keep `requestDeloadNotifications` unchanged.

- [ ] **Step 3: Run notification service compile check**

Run: `pnpm test src/domains/settings/services.test.ts`

Expected: PASS.

---

### Task 5: AppShell Deload Active Theme

**Files:**
- Modify: `src/app/AppShell.tsx`
- Modify: `src/app/AppShell.test.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes:
  - `getDeloadOverview()` from settings services.
- Produces:
  - `data-deload-active="true"` on the app root column when phase is active.

- [ ] **Step 1: Write failing AppShell test**

In `src/app/AppShell.test.tsx`, mock `useLiveQuery` and `getDeloadOverview` if not already mocked:

```ts
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (callback: () => unknown) => callback(),
}))

vi.mock('../domains/settings/services', () => ({
  getDeloadOverview: () => ({
    anchorDate: '2026-02-01',
    cooldownUntil: null,
    currentCycle: { id: 'deload-1', status: 'active' },
    daysRemaining: 5,
    firstLogDate: '2026-01-01',
    lastCompletedDate: null,
    phase: 'active',
    seriesReductionPercent: 50,
    shouldNotify: false,
    weeksSinceAnchor: 0,
    weightReductionPercent: 80,
  }),
}))
```

Add assertion:

```ts
expect(screen.getByTestId('app-shell')).toHaveAttribute('data-deload-active', 'true')
```

- [ ] **Step 2: Run failing AppShell test**

Run: `pnpm test src/app/AppShell.test.tsx`

Expected: FAIL because no data attribute/test id exists.

- [ ] **Step 3: Implement active attribute**

In `src/app/AppShell.tsx`:

```ts
import { useLiveQuery } from 'dexie-react-hooks'
import { getDeloadOverview } from '../domains/settings/services'
```

Inside `AppShell`:

```ts
  const deload = useLiveQuery(() => getDeloadOverview(), [], undefined)
  const deloadActive = deload?.phase === 'active'
```

On the inner shell div:

```tsx
data-deload-active={deloadActive ? 'true' : undefined}
data-testid="app-shell"
```

- [ ] **Step 4: Add CSS variable overrides**

In `src/styles.css`, add:

```css
[data-deload-active="true"] {
  --color-arsen-purple: oklch(0.62 0.13 205);
  --color-arsen-purple2: oklch(0.76 0.12 198);
  --color-arsen-acid: oklch(0.82 0.16 170);
  --color-arsen-acid2: oklch(0.70 0.16 172);
}
```

Keep this scoped to the app shell attribute, not `:root`.

- [ ] **Step 5: Run AppShell test**

Run: `pnpm test src/app/AppShell.test.tsx`

Expected: PASS.

---

### Task 6: Configuracion Deload Controls

**Files:**
- Modify: `src/domains/settings/pages/SettingsPage.tsx`
- Modify: `src/domains/settings/pages/SettingsPage.test.tsx`

**Interfaces:**
- Consumes:
  - `getDeloadOverview`
  - `scheduleDeload`
  - `startDeloadNow`
  - `skipDeloadSuggestion`
  - `completeActiveDeload`
  - `updateDeloadReductionSettings`
  - `requestDeloadNotifications`
- Produces:
  - A "Deload" settings section with state/actions and bounded reduction controls.

- [ ] **Step 1: Write failing SettingsPage tests**

In `src/domains/settings/pages/SettingsPage.test.tsx`, extend service mocks:

```ts
const settingsPageMocks = {
  completeActiveDeload: vi.fn(),
  scheduleDeload: vi.fn(),
  skipDeloadSuggestion: vi.fn(),
  startDeloadNow: vi.fn(),
  updateAvailablePlateWeights: vi.fn(),
  updateDeloadReductionSettings: vi.fn(),
}
```

Return from `vi.mock('../services', ...)`:

```ts
completeActiveDeload: settingsPageMocks.completeActiveDeload,
getDeloadOverview: () => ({
  anchorDate: '2026-07-01',
  cooldownUntil: null,
  currentCycle: { id: 'deload-1', status: 'suggested', suggestedAt: '2026-08-05' },
  daysRemaining: null,
  firstLogDate: '2026-07-01',
  lastCompletedDate: null,
  phase: 'suggested',
  seriesReductionPercent: 50,
  shouldNotify: true,
  weeksSinceAnchor: 5,
  weightReductionPercent: 80,
}),
scheduleDeload: settingsPageMocks.scheduleDeload,
skipDeloadSuggestion: settingsPageMocks.skipDeloadSuggestion,
startDeloadNow: settingsPageMocks.startDeloadNow,
updateDeloadReductionSettings: settingsPageMocks.updateDeloadReductionSettings,
```

Add tests:

```ts
it('shows actionable deload settings', () => {
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )

  expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeInTheDocument()
  expect(screen.getByText('Deload')).toBeInTheDocument()
  expect(screen.getByText(/Sugerido/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Iniciar deload ahora/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Ahora no/ })).toBeInTheDocument()
  expect(screen.getByLabelText('Fecha de inicio deload')).toHaveAttribute('type', 'date')
  expect(screen.getByLabelText('Series deload')).toHaveValue(50)
  expect(screen.getByLabelText('Peso deload')).toHaveValue(80)
})

it('saves clamped deload reductions from settings', async () => {
  render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )

  fireEvent.change(screen.getByLabelText('Series deload'), { target: { value: '99' } })
  fireEvent.change(screen.getByLabelText('Peso deload'), { target: { value: '10' } })
  fireEvent.click(screen.getByRole('button', { name: /Guardar deload/ }))

  await waitFor(() => {
    expect(settingsPageMocks.updateDeloadReductionSettings).toHaveBeenCalledWith({
      seriesReductionPercent: 99,
      weightReductionPercent: 10,
    })
  })
})
```

- [ ] **Step 2: Run failing SettingsPage test**

Run: `pnpm test src/domains/settings/pages/SettingsPage.test.tsx`

Expected: FAIL because UI/actions are missing.

- [ ] **Step 3: Import deload services and icons**

In `SettingsPage.tsx`, import a useful icon such as `Moon` or `Activity` from `lucide-react`, and import deload services from `../services`:

```ts
  completeActiveDeload,
  getDeloadOverview,
  scheduleDeload,
  skipDeloadSuggestion,
  startDeloadNow,
  updateDeloadReductionSettings,
```

Keep `requestDeloadNotifications` imported from `../notifications`.

- [ ] **Step 4: Add local state and sync**

Near existing plate state:

```ts
  const [deloadStartDate, setDeloadStartDate] = useState(today)
  const [seriesReductionValue, setSeriesReductionValue] = useState('50')
  const [weightReductionValue, setWeightReductionValue] = useState('80')
```

Add effect:

```ts
  useEffect(() => {
    if (!deload) return
    setSeriesReductionValue(String(deload.seriesReductionPercent))
    setWeightReductionValue(String(deload.weightReductionPercent))
    setDeloadStartDate(deload.currentCycle?.scheduledStartDate ?? today)
  }, [deload, today])
```

- [ ] **Step 5: Add action handlers**

Inside `SettingsPage`:

```ts
  function saveDeloadReductions() {
    void runAction(
      'deload-settings',
      () =>
        updateDeloadReductionSettings({
          seriesReductionPercent: Number(seriesReductionValue),
          weightReductionPercent: Number(weightReductionValue),
        }),
      'Deload actualizado',
    )
  }

  function programDeload() {
    void runAction('deload-schedule', () => scheduleDeload(deloadStartDate), 'Deload programado')
  }
```

- [ ] **Step 6: Replace old notification-only Deload row with section**

Replace the existing `SettingsSection title="Notificaciones"` Deload row with:

```tsx
      <SettingsSection title="Deload">
        <Card className="space-y-3 p-3">
          <div className="grid grid-cols-[42px_1fr] items-center gap-3">
            <div className="grid size-10 place-items-center text-arsen-purple2">
              <Moon aria-hidden="true" className="size-6" />
            </div>
            <div>
              <strong>{deloadStatusLabel(deload?.phase)}</strong>
              <span className="mt-1 block text-xs text-arsen-muted">
                {deload?.anchorDate ? `${deload.weeksSinceAnchor} semanas desde ${deload.anchorDate}` : 'Sin registros aun'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button className="min-h-11 rounded-[10px] bg-arsen-purple px-3 text-sm font-extrabold text-white" onClick={() => runAction('deload-start', () => startDeloadNow(), 'Deload iniciado')} type="button">
              Iniciar deload ahora
            </button>
            {deload?.phase === 'suggested' ? (
              <button className="min-h-11 rounded-[10px] border border-white/10 px-3 text-sm font-extrabold text-arsen-ink" onClick={() => runAction('deload-skip', () => skipDeloadSuggestion(), 'Sugerencia saltada')} type="button">
                Ahora no
              </button>
            ) : null}
            {deload?.phase === 'active' ? (
              <button className="min-h-11 rounded-[10px] border border-white/10 px-3 text-sm font-extrabold text-arsen-ink" onClick={() => runAction('deload-complete', () => completeActiveDeload(), 'Deload finalizado')} type="button">
                Finalizar deload
              </button>
            ) : null}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Fecha de inicio deload</span>
            <input aria-label="Fecha de inicio deload" className="min-h-10 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-sm font-extrabold text-arsen-ink" min={today} onChange={(event) => setDeloadStartDate(event.target.value)} type="date" value={deloadStartDate} />
          </label>
          <button className="min-h-10 w-full rounded-[10px] border border-arsen-purple/40 bg-arsen-purple/15 px-3 text-sm font-extrabold text-arsen-purple2" onClick={programDeload} type="button">
            Programar deload
          </button>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-arsen-muted">Series deload</span>
              <input aria-label="Series deload" className="min-h-10 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-sm font-extrabold text-arsen-ink" max={60} min={40} onChange={(event) => setSeriesReductionValue(event.target.value)} type="number" value={seriesReductionValue} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-arsen-muted">Peso deload</span>
              <input aria-label="Peso deload" className="min-h-10 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-sm font-extrabold text-arsen-ink" max={90} min={70} onChange={(event) => setWeightReductionValue(event.target.value)} type="number" value={weightReductionValue} />
            </label>
          </div>
          <button className="min-h-10 w-full rounded-[10px] bg-gradient-to-b from-arsen-acid to-arsen-acid2 px-3 text-sm font-extrabold text-[#142100]" onClick={saveDeloadReductions} type="button">
            Guardar deload
          </button>
        </Card>
        <ActionRow
          busy={busyAction === 'notify'}
          icon={Flame}
          label="Notificacion deload"
          meta={appSettings?.notificationPermission ?? 'sin permiso'}
          onClick={() =>
            runAction(
              'notify',
              async () => {
                const permission = await requestDeloadNotifications()
                if (permission !== 'granted') throw new Error(`Permiso de notificacion: ${permission}`)
              },
              deload?.shouldNotify ? 'Aviso de deload activado' : 'Notificaciones activadas',
            )
          }
        />
      </SettingsSection>
```

Add helper below component:

```ts
function deloadStatusLabel(phase: string | undefined) {
  if (phase === 'suggested') return 'Sugerido'
  if (phase === 'scheduled') return 'Programado'
  if (phase === 'active') return 'Activo'
  if (phase === 'completed') return 'Completado'
  return 'Sin sugerencia activa'
}
```

- [ ] **Step 7: Run SettingsPage tests**

Run: `pnpm test src/domains/settings/pages/SettingsPage.test.tsx`

Expected: PASS.

---

### Task 7: Workout Deload Card And Adjusted Targets

**Files:**
- Modify: `src/domains/workout/hooks.ts`
- Modify: `src/domains/workout/pages/WorkoutPage.tsx`
- Modify: `src/domains/workout/pages/WorkoutPage.test.tsx`

**Interfaces:**
- Consumes:
  - `getDeloadOverview`
  - Deload lifecycle actions from settings services.
  - `getDeloadTargetSets`
  - `getDeloadSuggestedWeightKg`
- Produces:
  - `useDeloadOverview()`
  - Workout deload status card.
  - Active deload adjusted target labels.

- [ ] **Step 1: Write failing WorkoutPage UI test**

In `src/domains/workout/pages/WorkoutPage.test.tsx`, mock settings services:

```ts
vi.mock('../../settings/services', () => ({
  completeActiveDeload: vi.fn(),
  getDeloadOverview: () => ({
    anchorDate: '2026-02-01',
    cooldownUntil: null,
    currentCycle: { id: 'deload-1', startedAt: '2026-02-01', status: 'active' },
    daysRemaining: 5,
    firstLogDate: '2026-01-01',
    lastCompletedDate: null,
    phase: 'active',
    seriesReductionPercent: 50,
    shouldNotify: false,
    weeksSinceAnchor: 0,
    weightReductionPercent: 80,
  }),
  scheduleDeload: vi.fn(),
  skipDeloadSuggestion: vi.fn(),
  startDeloadNow: vi.fn(),
}))
```

Add assertions to an existing render test:

```ts
expect(screen.getByText('Modo deload activo')).toBeInTheDocument()
expect(screen.getByText('5 dias restantes')).toBeInTheDocument()
expect(screen.getByText('Peso deload')).toBeInTheDocument()
expect(screen.getByText('Series deload')).toBeInTheDocument()
expect(screen.getByText(formatWeight(48, 'kg'))).toBeInTheDocument()
```

Use the existing fixture exercise weight of `60 kg`; if the fixture weight differs, compute expected deload as `currentWeightKg * 0.8`.

- [ ] **Step 2: Run failing WorkoutPage test**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: FAIL because deload card/targets are missing.

- [ ] **Step 3: Add hook**

In `src/domains/workout/hooks.ts`:

```ts
import { getDeloadOverview } from '../settings/services'

export function useDeloadOverview() {
  return useLiveQuery(() => getDeloadOverview(), [], undefined)
}
```

- [ ] **Step 4: Import services/calculations in WorkoutPage**

In `WorkoutPage.tsx`, import:

```ts
import { getDeloadSuggestedWeightKg, getDeloadTargetSets } from '../../../shared/calculations/deload'
import { completeActiveDeload, scheduleDeload, skipDeloadSuggestion, startDeloadNow } from '../../settings/services'
```

Add `useDeloadOverview` to the existing hooks import.

- [ ] **Step 5: Derive current deload targets**

Inside `WorkoutPage`:

```ts
  const deload = useDeloadOverview()
  const isDeloadActive = deload?.phase === 'active'
  const currentDeloadTarget = currentExercise && isDeloadActive
    ? {
        targetSets: getDeloadTargetSets(currentExercise.targetSets, deload.seriesReductionPercent),
        weightKg: getDeloadSuggestedWeightKg(currentExercise.currentWeightKg, deload.weightReductionPercent),
      }
    : null
```

Update stats array:

```ts
[
  [
    isDeloadActive ? 'Peso deload' : 'Peso anterior',
    formatWeight(currentDeloadTarget?.weightKg ?? currentExercise?.currentWeightKg ?? 0, preferredUnit),
    'text-arsen-acid',
  ],
  [
    isDeloadActive ? 'Series deload' : 'Series',
    String(currentDeloadTarget?.targetSets ?? currentExercise?.targetSets ?? 0),
    'text-arsen-ink',
  ],
  ['Reps', currentExercise ? formatRepRange(currentExercise.repsMin, currentExercise.repsMax) : '-', 'text-arsen-ink'],
  ['RIR', currentExercise?.recommendedRir ?? '-', 'text-arsen-ink'],
]
```

- [ ] **Step 6: Add DeloadStatusCard component**

Add near other local components:

```tsx
function DeloadStatusCard({
  deload,
  onComplete,
  onSkip,
  onStart,
}: {
  deload: ReturnType<typeof useDeloadOverview>
  onComplete: () => void
  onSkip: () => void
  onStart: () => void
}) {
  if (!deload || deload.phase === 'idle') return null

  if (deload.phase === 'active') {
    return (
      <Card className="border-arsen-acid/35 p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <strong className="block text-sm text-arsen-acid">Modo deload activo</strong>
            <span className="text-xs text-arsen-muted">{deload.daysRemaining ?? 0} dias restantes</span>
          </div>
          <span className="rounded-full bg-arsen-acid/15 px-2 py-1 text-xs font-extrabold text-arsen-acid">
            {deload.seriesReductionPercent}% / {deload.weightReductionPercent}%
          </span>
        </div>
        <ActionButton className="mt-3 w-full" onClick={onComplete} tone="ghost" type="button">
          Finalizar deload
        </ActionButton>
      </Card>
    )
  }

  if (deload.phase === 'suggested') {
    return (
      <Card className="border-arsen-purple/35 p-3">
        <strong className="block text-sm text-arsen-purple2">Deload sugerido</strong>
        <span className="mt-1 block text-xs text-arsen-muted">{deload.weeksSinceAnchor} semanas desde la referencia</span>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <ActionButton onClick={onStart} type="button">Iniciar ahora</ActionButton>
          <ActionButton onClick={onSkip} tone="ghost" type="button">Ahora no</ActionButton>
        </div>
      </Card>
    )
  }

  if (deload.phase === 'scheduled') {
    return (
      <Card className="border-arsen-purple/35 p-3">
        <strong className="block text-sm text-arsen-purple2">Deload programado</strong>
        <span className="mt-1 block text-xs text-arsen-muted">Inicio {deload.currentCycle?.scheduledStartDate ?? '-'}</span>
        <ActionButton className="mt-3 w-full" onClick={onStart} type="button">Iniciar ahora</ActionButton>
      </Card>
    )
  }

  return null
}
```

- [ ] **Step 7: Render card and wire actions**

Create a generic action runner near `runSetAction`:

```ts
  function runWorkoutAction(action: () => Promise<void>, success: string) {
    startTransition(() => {
      action()
        .then(() => setMessage(success))
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo completar la accion'))
    })
  }
```

Near top of `WorkoutPage`, after off-calendar/missed notices:

```tsx
      <DeloadStatusCard
        deload={deload}
        onComplete={() => runWorkoutAction(() => completeActiveDeload(), 'Deload finalizado')}
        onSkip={() => runWorkoutAction(() => skipDeloadSuggestion(), 'Sugerencia saltada')}
        onStart={() => runWorkoutAction(() => startDeloadNow(), 'Deload iniciado')}
      />
```

- [ ] **Step 8: Run WorkoutPage tests**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: PASS.

---

### Task 8: Polish, Audit, And Full Verification

**Files:**
- Review all changed files.
- Run tests/build/detector.

**Interfaces:**
- Consumes all tasks.
- Produces verified implementation ready for human review, without committing.

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm test src/shared/calculations/deload.test.ts src/domains/settings/services.test.ts src/shared/validation/arsenImportSchemas.test.ts src/db/indexeddb.test.ts src/app/AppShell.test.tsx src/domains/settings/pages/SettingsPage.test.tsx src/domains/workout/pages/WorkoutPage.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `pnpm build`

Expected: PASS, including `tsc -b`, `vite build`, and `node scripts/generate-sw.mjs`.

- [ ] **Step 4: Run Impeccable detector**

Run:

```bash
node C:\Users\Chovy\.agents\skills\impeccable\scripts\detect.mjs --json src/app/AppShell.tsx src/styles.css src/domains/settings/pages/SettingsPage.tsx src/domains/workout/pages/WorkoutPage.tsx
```

Expected: JSON returns no blocking issues. Fix any reported accessibility, contrast, overlap, mobile, or design-token violations.

- [ ] **Step 5: Manual diff review**

Run: `git diff -- src/shared/calculations/deload.ts src/domains/settings src/db src/shared/validation src/app src/styles.css src/domains/workout`

Review for:

- No deload segmentation fields.
- No mutation of routine recipes/logs for deload.
- Exactly one `deloadCycles` table and no duplicate state model.
- Settings percentages normalized at service/import boundaries.
- Spanish UI copy.
- No new dependency.
- No unrelated refactor.

- [ ] **Step 6: Final status**

Run: `git status --short`

Report changed files, verification commands, and any remaining risk. Do not commit unless the human approves a commit.
