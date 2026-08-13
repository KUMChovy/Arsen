# Progress Manual Session Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. This repository's AGENTS.md forbids implementation/review subagents for this task; execute inline only. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add manual past-session creation from `/progreso/historial/:date` without changing today's `/entreno` flow or existing progress edit/delete behavior.

**Architecture:** Keep persistence on the existing workout service path: the UI collects draft sets and the page saves each one through `registerMainSetForExercise`, which reuses `getOrCreateSessionForDay`, `ensureExerciseLog`, and `saveMainSet`. The progress calendar can select any non-future date; untrained dates navigate to the date history route with `?create=1` so the creator opens immediately.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Dexie/IndexedDB, Vitest, Testing Library, lucide-react.

## Global Constraints

- Execution mode is inline only; do not dispatch subagents.
- Do not add this capability to `/entreno`.
- Do not change how today's session is created from `/entreno`.
- Do not add or change Dexie schema versions or indexes.
- UI strings remain Spanish and ASCII-compatible.
- Weight storage remains kg; use `unitToKg` / `kgToUnit` helpers, never manual multiplication in components.
- Use native `<input type="date">` with a max date; do not add a date picker dependency.
- Calendar dates after today are disabled; past or current dates without sessions open manual creation directly.
- Preserve existing progress edit/delete flows: `EditSetSheet`, `updateWorkoutSession`, `moveMainSetToExercise`, `updateMainSet`, `deleteMainSet`, and `deleteWorkoutSession` remain behaviorally unchanged.
- Cross-domain reads go through domain hooks/services/repositories.

---

## File Structure

- Modify `src/domains/progress/repository.ts`: add a read helper for existing `date + dayId` session detection, and keep `ProgressEditOptions` backward-compatible.
- Modify `src/domains/progress/hooks.ts`: expose a hook for the existing-session helper.
- Create `src/domains/progress/components/CreateSessionSheet.tsx`: bottom sheet UI, local draft-set state, future-date validation, and save callback.
- Create `src/domains/progress/components/CreateSessionSheet.test.tsx`: component tests for future-date blocking and save payload shape.
- Modify `src/domains/progress/pages/ProgressHistoryDatePage.tsx`: add `Crear sesion` actions, wire the sheet to options, settings, selected day detail, existing-session detection, and `registerMainSetForExercise`.
- Create `src/domains/progress/pages/ProgressHistoryDatePage.test.tsx`: page-level visibility tests for the button in empty and populated history states.
- Modify `src/domains/progress/components/TrainingCalendarSheet.tsx`: allow non-future untrained dates to be selected and tell the parent whether the selected date already had sessions.
- Create `src/domains/progress/components/TrainingCalendarSheet.test.tsx`: component tests for selecting untrained past dates and blocking future dates.
- Modify `src/domains/progress/pages/ProgressPage.tsx`: navigate to history normally for trained dates and with `create=1` for untrained dates.
- Modify `src/db/indexeddb.test.ts`: add integration coverage for creating a past session and appending another exercise to an existing `date + dayId` session.

---

### Task 1: Repository Helper And Integration Tests

**Files:**
- Modify: `src/domains/progress/repository.ts`
- Modify: `src/domains/progress/hooks.ts`
- Modify: `src/db/indexeddb.test.ts`

**Interfaces:**
- Produces: `getExistingSessionForDateAndDay(date: string, dayId: string): Promise<RecentSessionSummary | null>`
- Produces: `useExistingSessionForDateAndDay(date: string | undefined, dayId: string | null | undefined)`
- Consumes existing: `registerMainSetForExercise(input)`

- [ ] **Step 1: Add failing integration test for past manual session visibility**

Add this test near the other progress history tests in `src/db/indexeddb.test.ts`:

```ts
  it('creates a past manual session through the workout save path and includes it in progress', async () => {
    const routineA = routine('routine-a', 'Rutina A')
    const dayA = routineDay('day-a', routineA.id, 'Dia A')
    const exerciseA = routineExercise({ dayId: dayA.id, id: 'exercise-a', routineId: routineA.id })
    await db.routines.put(routineA)
    await db.routineDays.put(dayA)
    await db.routineExercises.put(exerciseA)

    const registered = await registerMainSetForExercise({
      date: '2026-08-01',
      dayId: dayA.id,
      displayUnit: 'kg',
      dropSet: { reps: 10, rir: 2, weightKg: 40 },
      exercise: exerciseA,
      reps: 8,
      rir: 1,
      routineId: routineA.id,
      weightKg: 60,
    })

    const sessions = await getSessionsForDate('2026-08-01')
    const dates = await getTrainingDates()
    const overview = await getProgressOverview()
    const detail = await getSessionDetail(registered.sessionId)

    expect(sessions).toEqual([
      expect.objectContaining({
        date: '2026-08-01',
        id: registered.sessionId,
        routineName: 'Rutina A',
        setCount: 1,
        volumeKg: 880,
      }),
    ])
    expect(dates).toContain('2026-08-01')
    expect(overview).toMatchObject({ sessionCount: 1, totalSets: 1, volumeKg: 880 })
    expect(overview.chartData).toHaveLength(1)
    expect(detail?.exercises).toHaveLength(1)
  })
```

Also add `getProgressOverview` to the existing import from `../domains/progress/repository`.

- [ ] **Step 2: Add failing integration test for appending another exercise to an existing session**

Add this test in the same describe block:

```ts
  it('adds another exercise to an existing date and day session without duplicating the session', async () => {
    const routineA = routine('routine-a', 'Rutina A')
    const dayA = routineDay('day-a', routineA.id, 'Dia A')
    const exerciseA = routineExercise({ dayId: dayA.id, id: 'exercise-a', name: 'Press inclinado', routineId: routineA.id })
    const exerciseB = routineExercise({ canonicalName: 'remo-barra', dayId: dayA.id, id: 'exercise-b', name: 'Remo barra', routineId: routineA.id })
    await db.routines.put(routineA)
    await db.routineDays.put(dayA)
    await db.routineExercises.bulkPut([exerciseA, exerciseB])

    const first = await registerMainSetForExercise({
      date: '2026-08-01',
      dayId: dayA.id,
      displayUnit: 'kg',
      exercise: exerciseA,
      reps: 8,
      rir: 1,
      routineId: routineA.id,
      weightKg: 60,
    })
    const second = await registerMainSetForExercise({
      date: '2026-08-01',
      dayId: dayA.id,
      displayUnit: 'kg',
      exercise: exerciseB,
      reps: 10,
      rir: 2,
      routineId: routineA.id,
      weightKg: 70,
    })

    expect(second.sessionId).toBe(first.sessionId)
    await expect(db.workoutSessions.where('[date+dayId]').equals(['2026-08-01', dayA.id]).count()).resolves.toBe(1)
    const detail = await getSessionDetail(first.sessionId)
    expect(detail?.exercises.map((exercise) => exercise.exerciseName).sort()).toEqual(['Press inclinado', 'Remo barra'])
    expect((await getSessionsForDate('2026-08-01'))[0]).toMatchObject({ exerciseCount: 2, setCount: 2 })
  })
```

- [ ] **Step 3: Add failing test for existing-session detection helper**

Add to `src/db/indexeddb.test.ts`:

```ts
  it('detects an existing progress session for a date and day', async () => {
    const routineA = routine('routine-a', 'Rutina A')
    const dayA = routineDay('day-a', routineA.id, 'Dia A')
    const exerciseA = routineExercise({ dayId: dayA.id, id: 'exercise-a', routineId: routineA.id })
    await db.routines.put(routineA)
    await db.routineDays.put(dayA)
    await db.routineExercises.put(exerciseA)

    const registered = await registerMainSetForExercise({
      date: '2026-08-01',
      dayId: dayA.id,
      displayUnit: 'kg',
      exercise: exerciseA,
      reps: 8,
      rir: 1,
      routineId: routineA.id,
      weightKg: 60,
    })

    await expect(getExistingSessionForDateAndDay('2026-08-01', dayA.id)).resolves.toMatchObject({
      id: registered.sessionId,
      dayName: 'Dia A',
      routineName: 'Rutina A',
    })
    await expect(getExistingSessionForDateAndDay('2026-08-02', dayA.id)).resolves.toBeNull()
  })
```

Add `getExistingSessionForDateAndDay` to the repository import. This test should fail until the helper exists.

- [ ] **Step 4: Run RED for the integration tests**

Run:

```bash
pnpm test src/db/indexeddb.test.ts
```

Expected: FAIL because `getProgressOverview` / `getExistingSessionForDateAndDay` imports or assertions are not satisfied yet.

- [ ] **Step 5: Implement the read helper**

In `src/domains/progress/repository.ts`, add this function after `getSessionsForDate`:

```ts
export async function getExistingSessionForDateAndDay(date: string, dayId: string): Promise<RecentSessionSummary | null> {
  if (!date || !dayId) return null

  const sessions = await getSessionsForDate(date, { dayId })

  return sessions.find((session) => session.date === date) ?? null
}
```

Keep this helper read-only and derived from existing progress summary logic.

- [ ] **Step 6: Expose hook**

In `src/domains/progress/hooks.ts`, import `getExistingSessionForDateAndDay` and add:

```ts
export function useExistingSessionForDateAndDay(date: string | undefined, dayId: string | null | undefined) {
  return useLiveQuery(
    () => (date && dayId ? getExistingSessionForDateAndDay(date, dayId) : Promise.resolve(null)),
    [date, dayId],
    undefined,
  )
}
```

- [ ] **Step 7: Run GREEN for integration tests**

Run:

```bash
pnpm test src/db/indexeddb.test.ts
```

Expected: PASS for this file.

---

### Task 2: CreateSessionSheet Component With TDD

**Files:**
- Create: `src/domains/progress/components/CreateSessionSheet.tsx`
- Create: `src/domains/progress/components/CreateSessionSheet.test.tsx`

**Interfaces:**
- Consumes: `ProgressEditOptions`
- Consumes: `RoutineExercise[]` for the currently selected day
- Consumes: `WeightUnit`
- Produces type: `ManualSessionSetDraft`
- Produces callback: `onSave(input: ManualSessionSaveInput): Promise<void> | void`

- [ ] **Step 1: Write failing component test for future date blocking**

Create `src/domains/progress/components/CreateSessionSheet.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RoutineExercise } from '../../routine/types'
import type { ProgressEditOptions } from '../repository'
import { CreateSessionSheet } from './CreateSessionSheet'

describe('CreateSessionSheet', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-12T12:00:00'))
  })

  it('blocks saving a future date', () => {
    const onSave = vi.fn()
    render(<Sheet onSave={onSave} />)

    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-08-13' } })
    fireEvent.click(screen.getByRole('button', { name: /Agregar serie/i }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar sesion/i }))

    expect(screen.getByText('No puedes crear sesiones en fechas futuras.')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })
})

function Sheet({ onSave }: { onSave: Parameters<typeof CreateSessionSheet>[0]['onSave'] }) {
  return (
    <CreateSessionSheet
      date="2026-08-01"
      disabled={false}
      displayUnit="kg"
      existingSession={null}
      exercisesForDay={[exercise]}
      maxDate="2026-08-12"
      onClose={vi.fn()}
      onDateChange={vi.fn()}
      onDayChange={vi.fn()}
      onSave={onSave}
      options={options}
    />
  )
}

const options: ProgressEditOptions = {
  routines: [{ id: 'routine-1', name: 'Rutina A' }],
  days: [{ id: 'day-1', name: 'Dia A', routineId: 'routine-1', routineName: 'Rutina A' }],
  exercises: [{ dayId: 'day-1', id: 'exercise-1', name: 'Press inclinado', routineId: 'routine-1' }],
}

const exercise: RoutineExercise = {
  assetKind: null,
  bundledAssetId: null,
  canonicalName: 'press-inclinado',
  createdAt: '2026-08-01T00:00:00.000Z',
  currentWeightKg: 60,
  customAssetId: null,
  dayId: 'day-1',
  equipment: 'Barra',
  loadMode: 'split',
  barWeightKg: 20,
  id: 'exercise-1',
  mainMuscle: 'Pecho',
  name: 'Press inclinado',
  order: 0,
  recommendedRir: 2,
  repsMax: 10,
  repsMin: 8,
  rest: '90 seg',
  restSeconds: 90,
  routineId: 'routine-1',
  sourceExerciseId: null,
  targetSets: 4,
  technicalNotes: '',
  updatedAt: '2026-08-01T00:00:00.000Z',
  warmupProtocol: '',
  warmupSets: 0,
}
```

- [ ] **Step 2: Run RED for future-date test**

Run:

```bash
pnpm test src/domains/progress/components/CreateSessionSheet.test.tsx
```

Expected: FAIL because `CreateSessionSheet` does not exist.

- [ ] **Step 3: Implement minimal component skeleton and validation**

Create `src/domains/progress/components/CreateSessionSheet.tsx` with:

- Exported types:

```ts
export type ManualSessionSetDraft = {
  dropSet: { reps: number; rir: number; weightKg: number } | null
  exercise: RoutineExercise
  reps: number
  rir: number
  weightKg: number
}

export type ManualSessionSaveInput = {
  date: string
  dayId: string
  routineId: string
  sets: ManualSessionSetDraft[]
}
```

- Props:

```ts
type CreateSessionSheetProps = {
  date: string
  disabled: boolean
  displayUnit: WeightUnit
  existingSession: RecentSessionSummary | null | undefined
  exercisesForDay: RoutineExercise[]
  maxDate: string
  onClose: () => void
  onDateChange: (date: string) => void
  onDayChange: (dayId: string) => void
  onSave: (input: ManualSessionSaveInput) => Promise<void> | void
  options: ProgressEditOptions
}
```

- State: `form.date`, `form.routineId`, `form.dayId`, `form.exerciseId`, numeric strings for main/drop, `dropEnabled`, `draftSets`, `message`.
- Call `onDateChange(nextDate)` whenever the date input changes so the page can refresh existing-session detection for the selected date, not only the route date.
- Use `useMemo` for `daysForRoutine`, `selectedExercise`, and `exerciseOptionsForDay`.
- Use `useEffect` to keep day and exercise selections valid when routine/day changes.
- Validate in `saveSession()`:

```ts
if (form.date > maxDate) {
  setMessage('No puedes crear sesiones en fechas futuras.')
  return
}
if (!form.dayId || !form.routineId || draftSets.length === 0) {
  setMessage('Agrega al menos una serie antes de guardar.')
  return
}
```

- Render a bottom sheet matching existing sheet classes.
- Use `ActionButton`, `Card`, lucide `Check`, `Plus`, `X`, and `Flame`.
- Date input label text must be exactly `Fecha` and use `max={maxDate}`.
- Save button text must include `Guardar sesion`.

- [ ] **Step 4: Run GREEN for future-date test**

Run:

```bash
pnpm test src/domains/progress/components/CreateSessionSheet.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Add failing component test for save payload with drop set and existing-session notice**

Append this test:

```tsx
  it('adds a set draft and saves it with an existing-session notice', async () => {
    const onSave = vi.fn()
    render(
      <CreateSessionSheet
        date="2026-08-01"
        disabled={false}
        displayUnit="kg"
        existingSession={{
          bestSetId: 'set-1',
          bestSetLabel: '60 kg x 8',
          date: '2026-08-01',
          dayName: 'Dia A',
          exerciseCount: 1,
          id: 'session-1',
          routineName: 'Rutina A',
          setCount: 1,
          volumeKg: 480,
        }}
        exercisesForDay={[exercise]}
        maxDate="2026-08-12"
        onClose={vi.fn()}
        onDateChange={vi.fn()}
        onDayChange={vi.fn()}
        onSave={onSave}
        options={options}
      />,
    )

    expect(screen.getByText('Ya existe una sesion ese dia, se agregara a ella')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('KG'), { target: { value: '80' } })
    fireEvent.change(screen.getAllByLabelText('Reps')[0]!, { target: { value: '6' } })
    fireEvent.change(screen.getAllByLabelText('RIR')[0]!, { target: { value: '1' } })
    fireEvent.click(screen.getByLabelText('Agregar drop set'))
    fireEvent.change(screen.getByLabelText('KG drop'), { target: { value: '64' } })
    fireEvent.change(screen.getAllByLabelText('Reps')[1]!, { target: { value: '10' } })
    fireEvent.change(screen.getAllByLabelText('RIR')[1]!, { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: /Agregar serie/i }))
    fireEvent.click(screen.getByRole('button', { name: /Guardar sesion/i }))

    expect(onSave).toHaveBeenCalledWith({
      date: '2026-08-01',
      dayId: 'day-1',
      routineId: 'routine-1',
      sets: [
        expect.objectContaining({
          dropSet: { reps: 10, rir: 2, weightKg: 64 },
          exercise,
          reps: 6,
          rir: 1,
          weightKg: 80,
        }),
      ],
    })
  })
```

- [ ] **Step 6: Run RED for save-payload test**

Run:

```bash
pnpm test src/domains/progress/components/CreateSessionSheet.test.tsx
```

Expected: FAIL until draft adding and existing-session notice are implemented.

- [ ] **Step 7: Implement draft adding and payload save**

In `CreateSessionSheet.tsx`:

- `addDraftSet()` validates selected exercise and non-future date, then pushes converted values.
- Use `unitToKg(numberOrZero(weightValue), displayUnit)` for main and drop weights.
- Use `kgToUnit(exercise.currentWeightKg || 60, displayUnit)` to seed the weight field when selected exercise changes.
- Render draft count/list as compact rows: exercise name, weight/reps/RIR, drop count.
- Show existing-session notice only when `existingSession` is truthy.
- Disable `Guardar sesion` when `disabled || draftSets.length === 0`.

- [ ] **Step 8: Run GREEN for component tests**

Run:

```bash
pnpm test src/domains/progress/components/CreateSessionSheet.test.tsx
```

Expected: PASS.

---

### Task 3: Wire The Sheet Into Progress History Page

**Files:**
- Modify: `src/domains/progress/pages/ProgressHistoryDatePage.tsx`
- Create: `src/domains/progress/pages/ProgressHistoryDatePage.test.tsx`

**Interfaces:**
- Consumes: `CreateSessionSheet` and `ManualSessionSaveInput`
- Consumes: `useProgressEditOptions`, `useExistingSessionForDateAndDay`, `useRoutineDayDetail`, `getAppSettings`
- Consumes existing: `registerMainSetForExercise`

- [ ] **Step 1: Write failing page test for empty history action**

Create `src/domains/progress/pages/ProgressHistoryDatePage.test.tsx`:

```tsx
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProgressHistoryDatePage } from './ProgressHistoryDatePage'

const progressMocks = vi.hoisted(() => ({
  sessions: [] as Array<Record<string, unknown>>,
}))

vi.mock('../hooks', () => ({
  useExistingSessionForDateAndDay: () => null,
  useProgressEditOptions: () => ({ routines: [], days: [], exercises: [] }),
  useSessionDetail: () => null,
  useSessionsForDate: () => progressMocks.sessions,
}))

vi.mock('../../routine/hooks', () => ({
  useRoutineDayDetail: () => null,
}))

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (callback: () => unknown) => callback(),
}))

vi.mock('../../settings/services', () => ({
  getAppSettings: () => Promise.resolve({ preferredUnit: 'kg' }),
}))

vi.mock('../../workout/services', () => ({
  deleteMainSet: vi.fn(),
  deleteWorkoutSession: vi.fn(),
  moveMainSetToExercise: vi.fn(),
  registerMainSetForExercise: vi.fn(),
  updateMainSet: vi.fn(),
  updateWorkoutSession: vi.fn(),
}))

describe('ProgressHistoryDatePage', () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    progressMocks.sessions = []
  })

  it('shows create session action on an empty date', () => {
    renderPage()

    expect(screen.getByRole('button', { name: /Crear sesion/i })).toBeInTheDocument()
    expect(screen.getByText(/No hay sesiones para esta fecha/i)).toBeInTheDocument()
  })
})

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/progreso/historial/2026-08-01']}>
      <Routes>
        <Route element={<ProgressHistoryDatePage />} path="/progreso/historial/:date" />
      </Routes>
    </MemoryRouter>,
  )
}
```

This should fail until the button exists.

- [ ] **Step 2: Run RED for empty page action**

Run:

```bash
pnpm test src/domains/progress/pages/ProgressHistoryDatePage.test.tsx
```

Expected: FAIL because there is no `Crear sesion` button.

- [ ] **Step 3: Wire visible action and sheet state**

In `ProgressHistoryDatePage.tsx`:

- Import `Plus`, `ActionButton`, `CreateSessionSheet`, `type ManualSessionSaveInput`, `useRoutineDayDetail`, `useLiveQuery`, `getAppSettings`, `localDateKey`, and `registerMainSetForExercise`.
- Add state:

```ts
const [creatingSession, setCreatingSession] = useState(false)
const [createDate, setCreateDate] = useState(date)
const [createDayId, setCreateDayId] = useState<string | null>(null)
```

- Derive:

```ts
const maxSessionDate = localDateKey(new Date())
const appSettings = useLiveQuery(() => getAppSettings(), [], undefined)
const createDayDetail = useRoutineDayDetail(createDayId)
const existingCreateSession = useExistingSessionForDateAndDay(createDate, createDayId)
```

- Add one visible `ActionButton` above the sessions section:

```tsx
<ActionButton className="w-full" disabled={!editOptions} onClick={() => setCreatingSession(true)} tone="acid" type="button">
  <Plus aria-hidden="true" className="size-5" />
  Crear sesion
</ActionButton>
```

- Keep the empty `Card` text intact.

- [ ] **Step 4: Run GREEN for empty page action**

Run:

```bash
pnpm test src/domains/progress/pages/ProgressHistoryDatePage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Add failing page test for populated history action**

Append:

```tsx
  it('shows create session action when the date already has sessions', () => {
    progressMocks.sessions = [
      {
        bestSetId: 'set-1',
        bestSetLabel: '60 kg x 8',
        date: '2026-08-01',
        dayName: 'Dia A',
        exerciseCount: 1,
        id: 'session-1',
        routineName: 'Rutina A',
        setCount: 1,
        volumeKg: 480,
      },
    ]

    renderPage()

    expect(screen.getByRole('button', { name: /Crear sesion/i })).toBeInTheDocument()
    expect(screen.queryByText(/No hay sesiones para esta fecha/i)).not.toBeInTheDocument()
  })
```

- [ ] **Step 6: Run page tests**

Run:

```bash
pnpm test src/domains/progress/pages/ProgressHistoryDatePage.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Implement save handler through existing workout service**

In `ProgressHistoryDatePage.tsx`, add:

```ts
function saveManualSession(input: ManualSessionSaveInput) {
  runHistoryAction(async () => {
    for (const set of input.sets) {
      await registerMainSetForExercise({
        date: input.date,
        dayId: input.dayId,
        displayUnit: appSettings?.preferredUnit ?? 'kg',
        dropSet: set.dropSet,
        exercise: set.exercise,
        reps: set.reps,
        rir: set.rir,
        routineId: input.routineId,
        weightKg: set.weightKg,
      })
    }
    setCreatingSession(false)
  }, input.date === date ? 'Sesion guardada' : 'Sesion guardada; cambia de fecha para verla')
}
```

Render `CreateSessionSheet` when `creatingSession && editOptions`:

```tsx
<CreateSessionSheet
  date={createDate}
  disabled={isPending}
  displayUnit={appSettings?.preferredUnit ?? 'kg'}
  existingSession={existingCreateSession}
  exercisesForDay={createDayDetail?.exercises ?? []}
  maxDate={maxSessionDate}
  onClose={() => setCreatingSession(false)}
  onDateChange={setCreateDate}
  onDayChange={setCreateDayId}
  onSave={saveManualSession}
  options={editOptions}
/>
```

Ensure `createDate` resets from the route date and `createDayId` initializes to the first valid day when the sheet opens or options load:

```ts
useEffect(() => {
  if (!creatingSession) return
  setCreateDate(date)
  if (!createDayId && editOptions?.days[0]) setCreateDayId(editOptions.days[0].id)
}, [createDayId, creatingSession, date, editOptions])
```

- [ ] **Step 8: Run component and page tests together**

Run:

```bash
pnpm test src/domains/progress/components/CreateSessionSheet.test.tsx src/domains/progress/pages/ProgressHistoryDatePage.test.tsx
```

Expected: PASS.

---

### Task 4: UI Quality Pass And Regression Safety

**Files:**
- Modify as needed: `src/domains/progress/components/CreateSessionSheet.tsx`
- Modify as needed: `src/domains/progress/pages/ProgressHistoryDatePage.tsx`

**Interfaces:**
- Consumes: Impeccable `craft-floor`, `critique`, `polish`, `audit`, `harden` references.

- [ ] **Step 1: Load Impeccable craft floor before UI edits/refinement**

Run/read:

```powershell
Get-Content -LiteralPath 'C:\Users\Chovy\.agents\skills\impeccable\reference\craft-floor.md'
```

Apply the rules to the new sheet: no nested cards beyond legitimate row grouping, touch-friendly controls, no text overlap at 360px, no broad palette drift.

- [ ] **Step 2: Run focused tests after any UI refinement**

Run:

```bash
pnpm test src/domains/progress/components/CreateSessionSheet.test.tsx src/domains/progress/pages/ProgressHistoryDatePage.test.tsx src/db/indexeddb.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run Impeccable detector once**

Run:

```bash
node C:\Users\Chovy\.agents\skills\impeccable\scripts\detect.mjs --json src/domains/progress/components/CreateSessionSheet.tsx src/domains/progress/pages/ProgressHistoryDatePage.tsx
```

Expected: JSON output with no blocking design findings. If findings appear, fix them once, then rerun the focused tests from Step 2.

---

### Task 5: Full Verification And Diff Review

**Files:**
- Review all changed files.

**Interfaces:**
- Consumes: verification-before-completion, requesting-code-review/receiving-code-review as inline diff review because AGENTS.md forbids review subagents.

- [ ] **Step 1: Review diff manually**

Run:

```bash
git diff -- src/domains/progress/repository.ts src/domains/progress/hooks.ts src/domains/progress/components/CreateSessionSheet.tsx src/domains/progress/components/CreateSessionSheet.test.tsx src/domains/progress/pages/ProgressHistoryDatePage.tsx src/domains/progress/pages/ProgressHistoryDatePage.test.tsx src/db/indexeddb.test.ts docs/superpowers/specs/2026-08-12-progress-manual-session-create-design.md docs/superpowers/plans/2026-08-12-progress-manual-session-create.md
```

Check:

- Existing edit/delete flows are still present and wired to the same services.
- `/entreno` files are unchanged unless only tests/docs mention them.
- `registerMainSetForExercise` is the only write path for manual creation.
- Future-date validation exists in the sheet and the date input has `max`.
- Existing-session copy exactly says `Ya existe una sesion ese dia, se agregara a ella`.
- Weight conversion uses shared helpers.

- [ ] **Step 2: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
pnpm build
```

Expected: PASS, including `tsc -b`, Vite build, and `scripts/generate-sw.mjs`.

- [ ] **Step 4: Final status**

Report changed files, verification evidence, and any residual risk. Do not commit unless the user explicitly approves a git commit after seeing the final diff state.
