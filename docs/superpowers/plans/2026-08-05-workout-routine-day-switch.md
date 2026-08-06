# Workout Routine And Day Switch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This repository task is explicitly inline-only: do not use subagent-driven-development.

**Goal:** Make `/entreno` persist today's manual day selection, protect active routine changes, support rotation-based continuation, warn about missed training days, and auto-complete sessions when all exercises are done.

**Architecture:** Keep calculations pure in `src/domains/workout/calculations/trainingRotation.ts`, keep Dexie access in `workout/repository.ts`, keep mutations in `workout/services.ts`, and keep UI orchestration in `WorkoutPage.tsx`. Use `localStorage` only for same-day UI choices and notice dismissal.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Dexie/IndexedDB, Tailwind v4, SweetAlert2 through `shared/utils/alerts.ts`.

## Global Constraints

- Execution mode is inline only; no subagents.
- Do not commit.
- Do not change Dexie schema.
- Do not add a rest timer, last-session reference block, date selector, planner table, backend, or sync.
- UI copy stays Spanish (`es-MX`).
- Persist manual day selection in `localStorage` by date and active routine.
- Use one exported missed-training threshold constant.
- The missed-training notice state/component stays separate from any deload notice.
- Tests must be written and observed failing before production code for each behavior task.
- Use existing domain boundaries: repositories own Dexie, services own mutations, components stay UI-only.

---

## File Structure

- Create `src/domains/workout/calculations/trainingRotation.ts`: pure helpers for default day, next rotation day, calendar day differences, missed-training detection, and localStorage parsing helpers if kept pure/testable.
- Create `src/domains/workout/calculations/trainingRotation.test.ts`: unit tests for rotation and missed-training logic.
- Modify `src/domains/workout/repository.ts`: add read queries for workout sessions that have main sets and for the visible day's current progress.
- Modify `src/domains/workout/hooks.ts`: expose `useWorkoutRotationStatus` using `useLiveQuery`.
- Modify `src/domains/workout/services.ts`: add session status synchronization after set mutations.
- Modify `src/domains/workout/pages/WorkoutPage.tsx`: wire persistence, confirm routine changes, sheet action, badge, missed notice, undo bar, and auto-completion UI feedback.
- Modify `src/domains/workout/pages/WorkoutPage.test.tsx`: add UI tests for persistence, confirmation, sheet action, off-calendar badge, missed notice dismissal, undo, and direct routine change.

---

### Task 1: Pure Rotation And Missed-Training Calculations

**Files:**
- Create: `src/domains/workout/calculations/trainingRotation.ts`
- Create: `src/domains/workout/calculations/trainingRotation.test.ts`

**Interfaces:**
- Produces:
  - `export const MISSED_TRAINING_DAY_THRESHOLD = 2`
  - `export type SessionWithMainSets = { date: string; dayId: string; routineId: string }`
  - `export function getDefaultWorkoutDayId(days: RoutineDay[], weekday: number): string | null`
  - `export function getNextRotationDay(days: RoutineDay[], lastDayId: string | null, fallbackDayId: string | null): RoutineDay | null`
  - `export function calendarDaysBetween(fromDate: string, toDate: string): number`
  - `export function getLatestSessionWithMainSets(sessions: SessionWithMainSets[]): SessionWithMainSets | null`
  - `export function buildMissedTrainingNotice(input: { activeRoutineId: string; days: RoutineDay[]; sessionsWithMainSets: SessionWithMainSets[]; todayDate: string; todayWeekday: number; threshold?: number }): { daysWithoutTraining: number; missedScheduledDay: boolean; shouldShow: boolean; nextDay: RoutineDay | null }`

- Consumes:
  - `RoutineDay` from `src/domains/routine/types.ts`

- [ ] **Step 1: Write failing tests for default day and next rotation day**

Add this test file:

```ts
import { describe, expect, it } from 'vitest'
import type { RoutineDay } from '../../routine/types'
import { getDefaultWorkoutDayId, getNextRotationDay } from './trainingRotation'

describe('training rotation calculations', () => {
  it('uses weekday match as default before falling back to the first ordered day', () => {
    expect(getDefaultWorkoutDayId([dayB, dayA], 1)).toBe('day-a')
    expect(getDefaultWorkoutDayId([dayB, dayA], 4)).toBe('day-a')
  })

  it('returns the next ordered day after the latest trained day with wraparound', () => {
    expect(getNextRotationDay([dayC, dayA, dayB], 'day-a', 'day-c')?.id).toBe('day-b')
    expect(getNextRotationDay([dayC, dayA, dayB], 'day-c', 'day-a')?.id).toBe('day-a')
  })

  it('uses a valid fallback when the latest trained day is not in the active routine', () => {
    expect(getNextRotationDay([dayB, dayA], 'deleted-day', 'day-b')?.id).toBe('day-b')
  })
})

const baseDay = {
  createdAt: '2026-08-01T00:00:00.000Z',
  description: '',
  routineId: 'routine-1',
  updatedAt: '2026-08-01T00:00:00.000Z',
} satisfies Omit<RoutineDay, 'id' | 'name' | 'order' | 'weekday'>

const dayA: RoutineDay = { ...baseDay, id: 'day-a', name: 'Dia A', order: 0, weekday: 1 }
const dayB: RoutineDay = { ...baseDay, id: 'day-b', name: 'Dia B', order: 1, weekday: null }
const dayC: RoutineDay = { ...baseDay, id: 'day-c', name: 'Dia C', order: 2, weekday: 3 }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/domains/workout/calculations/trainingRotation.test.ts`

Expected: FAIL because `trainingRotation.ts` does not exist.

- [ ] **Step 3: Implement default and next-day helpers**

Create `trainingRotation.ts` with the minimal implementation:

```ts
import type { RoutineDay } from '../../routine/types'

export const MISSED_TRAINING_DAY_THRESHOLD = 2

export type SessionWithMainSets = {
  date: string
  dayId: string
  routineId: string
}

export function getDefaultWorkoutDayId(days: RoutineDay[], weekday: number) {
  const orderedDays = orderDays(days)
  return orderedDays.find((day) => day.weekday === weekday)?.id ?? orderedDays[0]?.id ?? null
}

export function getNextRotationDay(days: RoutineDay[], lastDayId: string | null, fallbackDayId: string | null) {
  const orderedDays = orderDays(days)
  if (orderedDays.length === 0) return null

  const latestIndex = lastDayId ? orderedDays.findIndex((day) => day.id === lastDayId) : -1
  if (latestIndex >= 0) return orderedDays[(latestIndex + 1) % orderedDays.length] ?? null

  return orderedDays.find((day) => day.id === fallbackDayId) ?? orderedDays[0] ?? null
}

function orderDays(days: RoutineDay[]) {
  return [...days].sort((a, b) => a.order - b.order)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/domains/workout/calculations/trainingRotation.test.ts`

Expected: PASS.

- [ ] **Step 5: Add failing tests for latest session, calendar threshold, and weekday-missed detection**

Extend the existing import from `./trainingRotation` so all imported helpers stay at the top of the file, then append these tests inside the same `describe` block:

```ts
it('finds the latest session with main sets by date', () => {
  expect(
    getLatestSessionWithMainSets([
      { date: '2026-08-01', dayId: 'day-a', routineId: 'routine-1' },
      { date: '2026-08-03', dayId: 'day-b', routineId: 'routine-1' },
    ]),
  ).toEqual({ date: '2026-08-03', dayId: 'day-b', routineId: 'routine-1' })
})

it('counts calendar days between local date keys', () => {
  expect(calendarDaysBetween('2026-08-03', '2026-08-05')).toBe(2)
})

it('shows a missed-training notice at the configured threshold and reuses next rotation day', () => {
  expect(
    buildMissedTrainingNotice({
      activeRoutineId: 'routine-1',
      days: [dayA, dayB, dayC],
      sessionsWithMainSets: [{ date: '2026-08-03', dayId: 'day-a', routineId: 'routine-1' }],
      todayDate: '2026-08-05',
      todayWeekday: 3,
      threshold: 2,
    }),
  ).toEqual({
    daysWithoutTraining: 2,
    missedScheduledDay: false,
    nextDay: dayB,
    shouldShow: true,
  })
})

it('shows a missed-training notice when an anchored scheduled weekday was skipped before today', () => {
  expect(
    buildMissedTrainingNotice({
      activeRoutineId: 'routine-1',
      days: [dayA, dayB, dayC],
      sessionsWithMainSets: [{ date: '2026-08-03', dayId: 'day-a', routineId: 'routine-1' }],
      todayDate: '2026-08-05',
      todayWeekday: 3,
      threshold: 7,
    }).missedScheduledDay,
  ).toBe(true)
})
```

- [ ] **Step 6: Run test to verify new tests fail**

Run: `pnpm test src/domains/workout/calculations/trainingRotation.test.ts`

Expected: FAIL because new helpers are missing.

- [ ] **Step 7: Implement missed-training helpers**

Add:

```ts
export function calendarDaysBetween(fromDate: string, toDate: string) {
  return Math.max(0, Math.round((dateMs(toDate) - dateMs(fromDate)) / 86_400_000))
}

export function getLatestSessionWithMainSets(sessions: SessionWithMainSets[]) {
  return [...sessions].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
}

export function buildMissedTrainingNotice(input: {
  activeRoutineId: string
  days: RoutineDay[]
  sessionsWithMainSets: SessionWithMainSets[]
  todayDate: string
  todayWeekday: number
  threshold?: number
}) {
  const threshold = input.threshold ?? MISSED_TRAINING_DAY_THRESHOLD
  const latestSession = getLatestSessionWithMainSets(input.sessionsWithMainSets)
  const fallbackDayId = getDefaultWorkoutDayId(input.days, input.todayWeekday)
  const nextDay = getNextRotationDay(input.days, latestSession?.routineId === input.activeRoutineId ? latestSession.dayId : null, fallbackDayId)
  const daysWithoutTraining = latestSession ? calendarDaysBetween(latestSession.date, input.todayDate) : 0
  const missedScheduledDay = latestSession ? hasMissedAnchoredWeekday(input.days, input.sessionsWithMainSets, latestSession.date, input.todayDate, input.todayWeekday) : false

  return {
    daysWithoutTraining,
    missedScheduledDay,
    nextDay,
    shouldShow: daysWithoutTraining >= threshold || missedScheduledDay,
  }
}

function hasMissedAnchoredWeekday(
  days: RoutineDay[],
  sessionsWithMainSets: SessionWithMainSets[],
  latestDate: string,
  todayDate: string,
  todayWeekday: number,
) {
  if (!days.some((day) => day.weekday === todayWeekday)) return false

  const anchoredWeekdays = new Set(days.flatMap((day) => (day.weekday === null ? [] : [day.weekday])))
  const trainedDates = new Set(sessionsWithMainSets.map((session) => session.date))
  for (let time = dateMs(latestDate) + 86_400_000; time < dateMs(todayDate); time += 86_400_000) {
    const date = new Date(time)
    const dateKey = date.toISOString().slice(0, 10)
    if (anchoredWeekdays.has(date.getUTCDay() as RoutineDay['weekday']) && !trainedDates.has(dateKey)) return true
  }

  return false
}

function dateMs(date: string) {
  return Date.parse(`${date}T00:00:00.000Z`)
}
```

- [ ] **Step 8: Run pure calculation tests**

Run: `pnpm test src/domains/workout/calculations/trainingRotation.test.ts`

Expected: PASS.

---

### Task 2: Repository And Hook For Rotation Status

**Files:**
- Modify: `src/domains/workout/repository.ts`
- Modify: `src/domains/workout/hooks.ts`

**Interfaces:**
- Consumes from Task 1:
  - `SessionWithMainSets`
  - `buildMissedTrainingNotice`
  - `getDefaultWorkoutDayId`
- Produces:
  - `export async function getSessionsWithMainSets(): Promise<SessionWithMainSets[]>`
  - `export function useWorkoutRotationStatus(input: { activeRoutineId: string | undefined; dateKey: string; days: RoutineDay[]; todayWeekday: number })`

- [ ] **Step 1: Add failing repository integration-style unit test**

Extend `src/db/indexeddb.test.ts`. Add `getSessionsWithMainSets` to the imports from `src/domains/workout/repository.ts`, then add a test that creates two sessions, one with only logs and one with a main set, and expects `getSessionsWithMainSets()` to return only the session with a main set.

Run: `pnpm test src/db/indexeddb.test.ts`

Expected: FAIL because `getSessionsWithMainSets` is not exported.

- [ ] **Step 2: Implement `getSessionsWithMainSets`**

Add to `workout/repository.ts`:

```ts
import type { SessionWithMainSets } from './calculations/trainingRotation'

export async function getSessionsWithMainSets(): Promise<SessionWithMainSets[]> {
  const [sessions, exerciseLogs, setLogs] = await Promise.all([
    db.workoutSessions.toArray(),
    db.exerciseLogs.toArray(),
    db.setLogs.where('kind').equals('main').toArray(),
  ])
  const logById = new Map(exerciseLogs.map((log) => [log.id, log]))
  const sessionIdsWithMainSets = new Set(setLogs.flatMap((set) => {
    const log = logById.get(set.exerciseLogId)
    return log ? [log.sessionId] : []
  }))

  return sessions
    .filter((session) => sessionIdsWithMainSets.has(session.id))
    .map((session) => ({
      date: session.date,
      dayId: session.dayId,
      routineId: session.routineId,
    }))
}
```

- [ ] **Step 3: Run repository test**

Run: `pnpm test src/db/indexeddb.test.ts`

Expected: PASS.

- [ ] **Step 4: Add hook implementation**

Modify `workout/hooks.ts`:

```ts
import type { RoutineDay } from '../routine/types'
import { buildMissedTrainingNotice } from './calculations/trainingRotation'
import { getSessionsWithMainSets } from './repository'

export function useWorkoutRotationStatus(input: {
  activeRoutineId: string | undefined
  dateKey: string
  days: RoutineDay[]
  todayWeekday: number
}) {
  const sessionsWithMainSets = useLiveQuery(() => getSessionsWithMainSets(), [], [])

  return useMemo(() => {
    if (!input.activeRoutineId) {
      return {
        daysWithoutTraining: 0,
        missedScheduledDay: false,
        nextDay: null,
        sessionsWithMainSets: sessionsWithMainSets ?? [],
        shouldShow: false,
      }
    }

    return {
      ...buildMissedTrainingNotice({
        activeRoutineId: input.activeRoutineId,
        days: input.days,
        sessionsWithMainSets: sessionsWithMainSets ?? [],
        todayDate: input.dateKey,
        todayWeekday: input.todayWeekday,
      }),
      sessionsWithMainSets: sessionsWithMainSets ?? [],
    }
  }, [input.activeRoutineId, input.dateKey, input.days, input.todayWeekday, sessionsWithMainSets])
}
```

- [ ] **Step 5: Run workout tests impacted by hook import changes**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: PASS before UI wiring because no component uses the hook yet.

---

### Task 3: Auto-Complete Session Status From Set Mutations

**Files:**
- Modify: `src/domains/workout/services.ts`
- Test: `src/db/indexeddb.test.ts`

**Interfaces:**
- Produces:
  - internal `syncSessionStatusFromExercises(sessionId: string): Promise<void>`
- Consumes:
  - existing `refreshExerciseState`
  - `WorkoutSession.status`

- [ ] **Step 1: Write failing DB tests for auto-complete and draft rollback**

Add tests that:

1. Create a routine/day with one exercise whose `targetSets` is `1`.
2. Register one main set through `registerMainSetForExercise`.
3. Expect the session status to become `completed`.
4. Delete that set through `deleteMainSet`.
5. Expect the session status to become `draft`.

Run: `pnpm test src/db/indexeddb.test.ts`

Expected: FAIL because registering a set currently leaves status `draft`.

- [ ] **Step 2: Implement session status synchronization**

In `services.ts`, after `refreshExerciseState`, synchronize the owning session.

Implementation shape:

```ts
async function syncSessionStatusFromExercises(sessionId: string) {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return

  const exercises = await db.routineExercises.where('dayId').equals(session.dayId).toArray()
  if (exercises.length === 0) return

  const logs = await db.exerciseLogs.where('sessionId').equals(sessionId).toArray()
  const logByExerciseId = new Map(logs.map((log) => [log.routineExerciseId, log]))
  const isCompleted = exercises.every((exercise) => logByExerciseId.get(exercise.id)?.state === 'done')
  const nextStatus = isCompleted ? 'completed' : 'draft'

  if (session.status !== nextStatus) {
    await db.workoutSessions.update(sessionId, {
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    })
  }
}
```

Call it:

- after `registerMainSetForExercise` saves the main set and updates current weight;
- after `updateMainSet`;
- after `deleteMainSet`;
- after `moveMainSetToExercise` for the affected session.

- [ ] **Step 3: Run DB tests**

Run: `pnpm test src/db/indexeddb.test.ts`

Expected: PASS.

---

### Task 4: Day Selection Persistence And Off-Calendar Badge In WorkoutPage

**Files:**
- Modify: `src/domains/workout/pages/WorkoutPage.tsx`
- Modify: `src/domains/workout/pages/WorkoutPage.test.tsx`

**Interfaces:**
- Consumes:
  - `getDefaultWorkoutDayId` from Task 1

- [ ] **Step 1: Write failing UI tests for same-day persistence and next-day reset**

Update `WorkoutPage.test.tsx` mocks so `useActiveRoutineBundle` and `useWorkoutDayById` can vary selected day. Add tests:

```ts
it('keeps a manually selected workout day after same-day reload', () => {
  vi.setSystemTime(new Date('2026-08-05T12:00:00'))
  render(<WorkoutPage />)
  fireEvent.click(screen.getByRole('button', { name: /Cambiar rutina/i }))
  fireEvent.change(screen.getByLabelText(/Dia de entrenamiento/i), { target: { value: 'day-2' } })
  cleanup()

  render(<WorkoutPage />)

  expect(screen.getByText('Mi rutina actual - Dia 2')).toBeInTheDocument()
})

it('uses the weekday default on the next calendar day when no manual choice exists for that date', () => {
  window.localStorage.setItem('arsen.workoutDaySelection.v1', JSON.stringify({ date: '2026-08-05', selectionsByRoutineId: { 'routine-1': 'day-2' } }))
  vi.setSystemTime(new Date('2026-08-06T12:00:00'))

  render(<WorkoutPage />)

  expect(screen.getByText('Mi rutina actual - Dia 1')).toBeInTheDocument()
})
```

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: FAIL because persistence does not exist and mocks may need day-2 support.

- [ ] **Step 2: Implement localStorage helpers inside `WorkoutPage.tsx`**

Add minimal helpers near the bottom:

```ts
const daySelectionStorageKey = 'arsen.workoutDaySelection.v1'

function readStoredDaySelection(date: string, routineId: string | undefined) {
  if (!routineId || typeof window === 'undefined') return null
  try {
    const parsed = JSON.parse(window.localStorage.getItem(daySelectionStorageKey) ?? 'null') as { date?: string; selectionsByRoutineId?: Record<string, string> } | null
    if (parsed?.date !== date) return null
    return parsed.selectionsByRoutineId?.[routineId] ?? null
  } catch {
    return null
  }
}

function writeStoredDaySelection(date: string, routineId: string | undefined, dayId: string) {
  if (!routineId || typeof window === 'undefined') return
  const existing = (() => {
    try {
      return JSON.parse(window.localStorage.getItem(daySelectionStorageKey) ?? 'null') as { date?: string; selectionsByRoutineId?: Record<string, string> } | null
    } catch {
      return null
    }
  })()
  const selectionsByRoutineId = existing?.date === date ? existing.selectionsByRoutineId ?? {} : {}
  window.localStorage.setItem(daySelectionStorageKey, JSON.stringify({ date, selectionsByRoutineId: { ...selectionsByRoutineId, [routineId]: dayId } }))
}
```

Use `getDefaultWorkoutDayId(days, selectedDate.getDay())` for default and initialize/reset `selectedDayId` from stored selection when valid.

- [ ] **Step 3: Run persistence tests**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: PASS for persistence tests.

- [ ] **Step 4: Add failing UI test for `Fuera de calendario`**

Add a test selecting a day whose `weekday` differs from the mocked today and expecting `Fuera de calendario`.

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: FAIL.

- [ ] **Step 5: Implement badge**

Compute:

```ts
const isOffCalendar = workoutDay?.day.weekday !== null && workoutDay?.day.weekday !== selectedDate.getDay()
```

Render a compact badge near the message/header area:

```tsx
{isOffCalendar ? (
  <div className="inline-flex min-h-8 items-center rounded-full border border-arsen-purple/40 bg-arsen-purple/15 px-3 text-xs font-extrabold text-arsen-purple2">
    Fuera de calendario
  </div>
) : null}
```

- [ ] **Step 6: Run WorkoutPage tests**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: PASS.

---

### Task 5: Safe Routine Change, Undo, And Sheet Continue Action

**Files:**
- Modify: `src/domains/workout/pages/WorkoutPage.tsx`
- Modify: `src/domains/workout/pages/WorkoutPage.test.tsx`

**Interfaces:**
- Consumes:
  - `getNextRotationDay` from Task 1
  - `useWorkoutRotationStatus` from Task 2

- [ ] **Step 1: Write failing tests for blocking and direct routine change**

Mock multiple routines. Add tests:

```ts
it('blocks routine changes in the sheet when today has registered sets', () => {
  render(<WorkoutPage />)
  fireEvent.click(screen.getByRole('button', { name: /Cambiar rutina/i }))
  const routineSelect = screen.getByLabelText(/Rutina activa/i)

  expect(routineSelect).toBeDisabled()
  expect(screen.getByText(/No puedes cambiar la rutina activa/i)).toBeInTheDocument()
  fireEvent.change(routineSelect, { target: { value: 'routine-2' } })
  expect(setActiveRoutine).not.toHaveBeenCalled()
})

it('changes routine when today has no registered sets', async () => {
  workoutMocks.setLogs = []
  render(<WorkoutPage />)
  fireEvent.click(screen.getByRole('button', { name: /Cambiar rutina/i }))
  fireEvent.change(screen.getByLabelText(/Rutina activa/i), { target: { value: 'routine-2' } })

  await waitFor(() => expect(setActiveRoutine).toHaveBeenCalledWith('routine-2'))
})
```

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: FAIL because the routine select is not blocked yet.

- [ ] **Step 2: Implement safe routine change block**

Compute registered sets:

```ts
const hasRegisteredSetsToday = dailyProgress.setLogs.length > 0
```

Pass that into `RoutineDaySheet`, disable the routine select when true, and show an inline warning explaining that the session already has registered series. Only call `setActiveRoutine` when no sets exist.

- [ ] **Step 3: Run routine-change tests**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: PASS for confirmation tests.

- [ ] **Step 4: Write failing tests for continue-next-day and undo**

Add tests:

```ts
it('selects the next logical rotation day from the sheet action', () => {
  workoutMocks.rotationStatus = { nextDay: day2, shouldShow: false, daysWithoutTraining: 0, missedScheduledDay: false, sessionsWithMainSets: [] }
  render(<WorkoutPage />)
  fireEvent.click(screen.getByRole('button', { name: /Cambiar rutina/i }))
  fireEvent.click(screen.getByRole('button', { name: /Continuar con el siguiente dia/i }))

  expect(screen.getByText('Mi rutina actual - Dia 2')).toBeInTheDocument()
})

it('offers undo after changing day', () => {
  render(<WorkoutPage />)
  fireEvent.click(screen.getByRole('button', { name: /Cambiar rutina/i }))
  fireEvent.change(screen.getByLabelText(/Dia de entrenamiento/i), { target: { value: 'day-2' } })

  expect(screen.getByText(/Antes: Mi rutina actual - Dia 1/i)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Deshacer/i }))
  expect(screen.getByText('Mi rutina actual - Dia 1')).toBeInTheDocument()
})
```

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: FAIL because UI does not have continue/undo.

- [ ] **Step 5: Implement continue-next-day and undo state**

Add `lastSelectionChange` state:

```ts
type SelectionSnapshot = {
  dayId: string | null
  dayName: string
  routineId: string
  routineName: string
}
```

Before changing day/routine, store previous snapshot. Render:

```tsx
{lastSelectionChange ? (
  <div className="flex items-center justify-between gap-3 rounded-[10px] border border-arsen-purple/40 bg-arsen-purple/15 px-3 py-2 text-xs">
    <span className="min-w-0 truncate text-arsen-purple2">Antes: {lastSelectionChange.routineName} - {lastSelectionChange.dayName}</span>
    <button className="shrink-0 font-extrabold text-arsen-acid" onClick={undoSelectionChange} type="button">
      Deshacer
    </button>
  </div>
) : null}
```

Pass `nextRotationDay` to `RoutineDaySheet` and render an `ActionButton` with `tone="ghost"`.

- [ ] **Step 6: Run WorkoutPage tests**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: PASS.

---

### Task 6: Missed-Training Notice UI And Dismissal

**Files:**
- Modify: `src/domains/workout/pages/WorkoutPage.tsx`
- Modify: `src/domains/workout/pages/WorkoutPage.test.tsx`

**Interfaces:**
- Consumes:
  - `useWorkoutRotationStatus`

- [ ] **Step 1: Write failing tests for notice, resume action, and dismissal**

Add tests:

```ts
it('shows missed-training notice with action to resume the logical next day', () => {
  workoutMocks.rotationStatus = { daysWithoutTraining: 3, missedScheduledDay: false, nextDay: day2, sessionsWithMainSets: [], shouldShow: true }
  render(<WorkoutPage />)

  expect(screen.getByText(/Llevas 3 dias sin entrenar/i)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Retomar Dia 2/i }))
  expect(screen.getByText('Mi rutina actual - Dia 2')).toBeInTheDocument()
})

it('does not show missed-training notice again after dismissal on the same date', () => {
  workoutMocks.rotationStatus = { daysWithoutTraining: 3, missedScheduledDay: false, nextDay: day2, sessionsWithMainSets: [], shouldShow: true }
  render(<WorkoutPage />)
  fireEvent.click(screen.getByRole('button', { name: /Descartar aviso de dias faltantes/i }))
  cleanup()
  render(<WorkoutPage />)

  expect(screen.queryByText(/Llevas 3 dias sin entrenar/i)).not.toBeInTheDocument()
})
```

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: FAIL because notice does not exist.

- [ ] **Step 2: Implement dismissal localStorage helpers**

Add:

```ts
const missedNoticeDismissedStorageKey = 'arsen.missedTrainingNoticeDismissedDate.v1'

function isMissedNoticeDismissed(date: string) {
  return typeof window !== 'undefined' && window.localStorage.getItem(missedNoticeDismissedStorageKey) === date
}

function dismissMissedNotice(date: string) {
  if (typeof window !== 'undefined') window.localStorage.setItem(missedNoticeDismissedStorageKey, date)
}
```

- [ ] **Step 3: Render `MissedTrainingNotice` as a separate component**

Add a small component in `WorkoutPage.tsx`:

```tsx
function MissedTrainingNotice({ daysWithoutTraining, nextDay, onDismiss, onResume }: {
  daysWithoutTraining: number
  nextDay: RoutineDay | null
  onDismiss: () => void
  onResume: () => void
}) {
  return (
    <Card className="border-arsen-acid/35 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block text-sm text-arsen-acid">Llevas {daysWithoutTraining} dias sin entrenar</strong>
          <span className="mt-1 block text-xs text-arsen-muted">Retoma tu rotacion sin perseguir el calendario.</span>
        </div>
        <button aria-label="Descartar aviso de dias faltantes" className="grid size-8 shrink-0 place-items-center rounded-[9px] text-arsen-muted" onClick={onDismiss} type="button">
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <ActionButton className="mt-3 w-full" disabled={!nextDay} onClick={onResume} tone="acid">
        Retomar {nextDay?.name ?? 'siguiente dia'}
      </ActionButton>
    </Card>
  )
}
```

Use state so dismissal hides immediately and persists for `dateKey`.

- [ ] **Step 4: Run WorkoutPage tests**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: PASS.

---

### Task 7: Final UI Polish, Impeccable Checks, And Full Verification

**Files:**
- Modify as needed: `src/domains/workout/pages/WorkoutPage.tsx`

**Interfaces:**
- Consumes all previous tasks.

- [ ] **Step 1: Run targeted test files**

Run:

```txt
pnpm test src/domains/workout/calculations/trainingRotation.test.ts src/domains/workout/pages/WorkoutPage.test.tsx src/db/indexeddb.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full tests**

Run: `pnpm test`

Expected: PASS.

- [ ] **Step 3: Run build**

Run: `pnpm build`

Expected: PASS and service worker generation succeeds.

- [ ] **Step 4: Run Impeccable detector**

Run:

```txt
node C:\Users\Chovy\.agents\skills\impeccable\scripts\detect.mjs --json src/domains/workout/pages/WorkoutPage.tsx
```

Expected: no blocking findings. Fix any overlapping text, inaccessible labels, unstable dimensions, or palette drift.

- [ ] **Step 5: Review diff manually**

Run:

```txt
git diff -- src/domains/workout/calculations/trainingRotation.ts src/domains/workout/calculations/trainingRotation.test.ts src/domains/workout/repository.ts src/domains/workout/hooks.ts src/domains/workout/services.ts src/domains/workout/pages/WorkoutPage.tsx src/domains/workout/pages/WorkoutPage.test.tsx docs/superpowers/specs/2026-08-05-workout-routine-day-switch-design.md docs/superpowers/plans/2026-08-05-workout-routine-day-switch.md
```

Check:

- No schema changes.
- No rest timer, date selector, last-session block, planner, backend, or sync.
- LocalStorage keys are separate for day selection and missed notice dismissal.
- Missed-training notice is separate from deload state.
- Routine and day changes are blocked inline in the sheet when visible today progress has registered sets and the session is not completed.
- Undo restores prior routine/day selection.
- Session status sync updates `completed` and `draft`.

- [ ] **Step 6: Final status**

Report tests/build/detector evidence and any remaining risk. Do not commit.
