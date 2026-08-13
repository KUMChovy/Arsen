# Workout Last Session Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This repository forbids implementation/review subagents for this task; execute inline.

**Goal:** Show a read-only last-session reference for the current exercise in `/entreno`, scoped to the same active routine and day.

**Architecture:** Add a Dexie repository query that fetches prior-session references for all exercises in the active day in one pass, keyed by `routineExerciseId`. Expose it through a live hook, then render only the current exercise's reference in `WorkoutPage` with read-only rows.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Dexie, dexie-react-hooks, Vitest, Testing Library.

## Global Constraints

- No commits: the user explicitly approved the spec "sin comit".
- UI copy is Spanish (`es-MX`) and must stay concise.
- Storage weight is always kg; display uses `formatWeight(weightKg, preferredUnit)`.
- The reference must filter by same `routineId`, same `dayId`, `date < current date`, and same `routineExerciseId`.
- Do not use `canonicalName` for this reference.
- Do not add edit/delete/click handlers to historical reference rows.
- Do not change Dexie schema.
- Do not add dependencies.
- Show the reference only in the `Ejercicio actual` card.

---

## File Structure

- Modify `src/domains/workout/types.ts`: export `LastSessionReference` and `LastSessionReferenceSet`.
- Modify `src/domains/workout/repository.ts`: add `getLastSessionReferencesForDay`.
- Modify `src/domains/workout/hooks.ts`: add `useLastSessionReferencesForDay`.
- Modify `src/domains/workout/pages/WorkoutPage.tsx`: render the reference block inside the current exercise card.
- Modify `src/domains/workout/pages/WorkoutPage.test.tsx`: add UI coverage with mocked hook data.
- Modify `src/db/indexeddb.test.ts`: add integration coverage for the repository query and scoping.

---

### Task 1: Repository Contract And Integration Tests

**Files:**
- Modify: `src/domains/workout/types.ts`
- Modify: `src/db/indexeddb.test.ts`
- Later tasks consume: `LastSessionReference`, `getLastSessionReferencesForDay`

**Interfaces:**
- Produces:

```ts
export type LastSessionReferenceSet = {
  dropSets: DropSetLog[]
  set: SetLog
}

export type LastSessionReference = {
  date: string
  sets: LastSessionReferenceSet[]
}
```

- Consumes planned function:

```ts
getLastSessionReferencesForDay(input: {
  date: string
  dayId: string | undefined
  exercises: RoutineExercise[]
  routineId: string | undefined
}): Promise<Map<string, LastSessionReference>>
```

- [ ] **Step 1: Export the types**

In `src/domains/workout/types.ts`, after `DropSetLog`, add:

```ts
export type LastSessionReferenceSet = {
  dropSets: DropSetLog[]
  set: SetLog
}

export type LastSessionReference = {
  date: string
  sets: LastSessionReferenceSet[]
}
```

- [ ] **Step 2: Import the repository function into the DB integration test**

In `src/db/indexeddb.test.ts`, extend the existing workout repository import:

```ts
import { getLastSessionReferencesForDay, getSessionsWithMainSets } from '../domains/workout/repository'
```

- [ ] **Step 3: Write the failing integration test for same routine/day with drop sets**

Add this test inside the existing `describe` block in `src/db/indexeddb.test.ts`:

```ts
it('loads last-session references for the same routine and day with drop sets', async () => {
  const routine = await createRoutine('Referencia')
  const day = await createRoutineDay(routine.id, 'Dia A', 1, 0)
  const exercise = await createRoutineExercise(day.id, {
    canonicalName: 'press-inclinado',
    name: 'Press inclinado',
  })

  const previous = await registerSetForExercise({
    date: '2026-08-10',
    dayId: day.id,
    displayUnit: 'kg',
    exercise,
    reps: 8,
    rir: 1,
    routineId: routine.id,
    weightKg: 60,
  })
  await addDropSet({
    displayUnit: 'kg',
    reps: 10,
    rir: 2,
    setLogId: previous.setId,
    weightKg: 45,
  })
  await registerSetForExercise({
    date: '2026-08-12',
    dayId: day.id,
    displayUnit: 'kg',
    exercise,
    reps: 9,
    rir: 2,
    routineId: routine.id,
    weightKg: 62.5,
  })

  const references = await getLastSessionReferencesForDay({
    date: '2026-08-13',
    dayId: day.id,
    exercises: [exercise],
    routineId: routine.id,
  })

  expect(references.get(exercise.id)).toMatchObject({
    date: '2026-08-12',
    sets: [
      {
        set: expect.objectContaining({ reps: 9, rir: 2, weightKg: 62.5 }),
      },
    ],
  })
})
```

- [ ] **Step 4: Write the failing integration test for ignoring other routine/day**

Add:

```ts
it('ignores last-session references from another routine or day with the same canonical name', async () => {
  const routine = await createRoutine('Rutina actual')
  const day = await createRoutineDay(routine.id, 'Dia A', 1, 0)
  const exercise = await createRoutineExercise(day.id, {
    canonicalName: 'press-inclinado',
    name: 'Press inclinado',
  })
  const otherDay = await createRoutineDay(routine.id, 'Dia B', 2, 1)
  const otherDayExercise = await createRoutineExercise(otherDay.id, {
    canonicalName: exercise.canonicalName,
    name: exercise.name,
  })
  const otherRoutine = await createRoutine('Rutina alterna')
  const alternateDay = await createRoutineDay(otherRoutine.id, 'Dia A', 1, 0)
  const alternateExercise = await createRoutineExercise(alternateDay.id, {
    canonicalName: exercise.canonicalName,
    name: exercise.name,
  })

  await registerSetForExercise({
    date: '2026-08-12',
    dayId: otherDay.id,
    displayUnit: 'kg',
    exercise: otherDayExercise,
    reps: 12,
    rir: 3,
    routineId: routine.id,
    weightKg: 70,
  })
  await registerSetForExercise({
    date: '2026-08-12',
    dayId: alternateDay.id,
    displayUnit: 'kg',
    exercise: alternateExercise,
    reps: 11,
    rir: 2,
    routineId: otherRoutine.id,
    weightKg: 80,
  })

  const references = await getLastSessionReferencesForDay({
    date: '2026-08-13',
    dayId: day.id,
    exercises: [exercise],
    routineId: routine.id,
  })

  expect(references.get(exercise.id)).toBeUndefined()
})
```

- [ ] **Step 5: Write the failing integration test for no history**

Add:

```ts
it('returns no last-session reference when an exercise has no prior history in the active routine and day', async () => {
  const routine = await createRoutine('Sin historial')
  const day = await createRoutineDay(routine.id, 'Dia A', 1, 0)
  const exercise = await createRoutineExercise(day.id, {
    canonicalName: 'remo-t',
    name: 'Remo T',
  })

  const references = await getLastSessionReferencesForDay({
    date: '2026-08-13',
    dayId: day.id,
    exercises: [exercise],
    routineId: routine.id,
  })

  expect(references.get(exercise.id)).toBeUndefined()
})
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `pnpm test src/db/indexeddb.test.ts`

Expected: FAIL because `getLastSessionReferencesForDay` is not exported.

---

### Task 2: Repository Implementation

**Files:**
- Modify: `src/domains/workout/repository.ts`
- Test: `src/db/indexeddb.test.ts`

**Interfaces:**
- Consumes: `LastSessionReference` from `src/domains/workout/types.ts`.
- Produces: `getLastSessionReferencesForDay(input): Promise<Map<string, LastSessionReference>>`.

- [ ] **Step 1: Add imports**

In `src/domains/workout/repository.ts`, update imports:

```ts
import type { RoutineExercise } from '../routine/types'
import type { LastSessionReference } from './types'
```

- [ ] **Step 2: Add the repository function**

Add below `getWorkoutProgressForDay`:

```ts
export async function getLastSessionReferencesForDay(input: {
  date: string
  dayId: string | undefined
  exercises: RoutineExercise[]
  routineId: string | undefined
}) {
  if (!input.dayId || !input.routineId || input.exercises.length === 0) return new Map<string, LastSessionReference>()

  const exerciseIds = input.exercises.map((exercise) => exercise.id)
  const sessions = (await db.workoutSessions.where('routineId').equals(input.routineId).toArray())
    .filter((session) => session.dayId === input.dayId && session.date < input.date)
    .sort((a, b) => b.date.localeCompare(a.date))
  if (sessions.length === 0) return new Map<string, LastSessionReference>()

  const sessionById = new Map(sessions.map((session) => [session.id, session]))
  const exerciseLogs = (await db.exerciseLogs.where('routineExerciseId').anyOf(exerciseIds).toArray())
    .filter((log) => sessionById.has(log.sessionId))
  if (exerciseLogs.length === 0) return new Map<string, LastSessionReference>()

  const exerciseLogIds = exerciseLogs.map((log) => log.id)
  const setLogs = exerciseLogIds.length > 0 ? await db.setLogs.where('exerciseLogId').anyOf(exerciseLogIds).toArray() : []
  const mainSets = setLogs.filter((set) => set.kind === 'main').sort((a, b) => a.order - b.order)
  const dropSetLogs =
    mainSets.length > 0 ? await db.dropSetLogs.where('setLogId').anyOf(mainSets.map((set) => set.id)).toArray() : []
  const dropsBySetId = new Map<string, typeof dropSetLogs>()
  for (const dropSet of dropSetLogs.sort((a, b) => a.order - b.order)) {
    const drops = dropsBySetId.get(dropSet.setLogId)
    if (drops) drops.push(dropSet)
    else dropsBySetId.set(dropSet.setLogId, [dropSet])
  }

  const setsByLogId = new Map<string, typeof mainSets>()
  for (const set of mainSets) {
    const sets = setsByLogId.get(set.exerciseLogId)
    if (sets) sets.push(set)
    else setsByLogId.set(set.exerciseLogId, [set])
  }

  const logsByExerciseId = new Map<string, typeof exerciseLogs>()
  for (const log of exerciseLogs) {
    const logs = logsByExerciseId.get(log.routineExerciseId)
    if (logs) logs.push(log)
    else logsByExerciseId.set(log.routineExerciseId, [log])
  }

  const references = new Map<string, LastSessionReference>()
  for (const exercise of input.exercises) {
    const logs = logsByExerciseId.get(exercise.id) ?? []
    for (const session of sessions) {
      const log = logs.find((candidate) => candidate.sessionId === session.id)
      if (!log) continue
      references.set(exercise.id, {
        date: session.date,
        sets: (setsByLogId.get(log.id) ?? []).map((set) => ({
          dropSets: dropsBySetId.get(set.id) ?? [],
          set,
        })),
      })
      break
    }
  }

  return references
}
```

- [ ] **Step 3: Run the DB integration tests**

Run: `pnpm test src/db/indexeddb.test.ts`

Expected: PASS for the new last-session reference tests and existing DB integration tests.

---

### Task 3: Hook And Page Tests

**Files:**
- Modify: `src/domains/workout/hooks.ts`
- Modify: `src/domains/workout/pages/WorkoutPage.test.tsx`

**Interfaces:**
- Produces hook:

```ts
useLastSessionReferencesForDay(input: {
  date: string
  dayId: string | undefined
  exercises: RoutineExercise[]
  routineId: string | undefined
}): Map<string, LastSessionReference>
```

- Page consumes: `lastSessionReferences.get(currentExercise.id)`.

- [ ] **Step 1: Add hook import and implementation stub**

In `src/domains/workout/hooks.ts`, update repository imports:

```ts
import {
  getLastSessionReferencesForDay,
  getSessionsWithMainSets,
  getWeightIncreaseRecommendations,
  getWorkoutProgressForDay,
} from './repository'
```

Add the hook:

```ts
export function useLastSessionReferencesForDay(input: {
  date: string
  dayId: string | undefined
  exercises: RoutineExercise[]
  routineId: string | undefined
}) {
  const exerciseKey = input.exercises.map((exercise) => exercise.id).join('|')

  return (
    useLiveQuery(
      () => getLastSessionReferencesForDay(input),
      [input.date, input.dayId, input.routineId, exerciseKey],
      undefined,
    ) ?? new Map()
  )
}
```

- [ ] **Step 2: Import the new type in the page test**

In `src/domains/workout/pages/WorkoutPage.test.tsx`, update the workout type import:

```ts
import type { DropSetLog, ExerciseLog, LastSessionReference, SetLog, WorkoutSession } from '../types'
```

- [ ] **Step 3: Add mocked hook state**

In `workoutMocks`, add:

```ts
lastSessionReferences: new Map<string, LastSessionReference>(),
```

In `vi.mock('../hooks', ...)`, add:

```ts
useLastSessionReferencesForDay: () => workoutMocks.lastSessionReferences,
```

In `beforeEach`, reset:

```ts
workoutMocks.lastSessionReferences = new Map()
```

- [ ] **Step 4: Add fixtures for reference data**

Near existing `setLog` fixtures, add:

```ts
const referenceSetLog: SetLog = {
  ...setLog,
  createdAt: '2026-07-18T00:00:00.000Z',
  id: 'reference-set-1',
  reps: 9,
  rir: 2,
  updatedAt: '2026-07-18T00:00:00.000Z',
  weightKg: 62.5,
}

const referenceDropSet: DropSetLog = {
  createdAt: '2026-07-18T00:00:00.000Z',
  displayUnit: 'kg',
  id: 'reference-drop-1',
  order: 0,
  reps: 8,
  rir: 3,
  setLogId: referenceSetLog.id,
  updatedAt: '2026-07-18T00:00:00.000Z',
  weightKg: 45,
}
```

- [ ] **Step 5: Write failing UI test for visible reference with drop sets**

Add:

```ts
it('shows the last-session reference for the current exercise', () => {
  workoutMocks.lastSessionReferences = new Map([
    [
      exercise.id,
      {
        date: '2026-07-18',
        sets: [{ dropSets: [referenceDropSet], set: referenceSetLog }],
      },
    ],
  ])

  render(<WorkoutPage />)

  expect(screen.getByText('Ultima sesion')).toBeInTheDocument()
  expect(screen.getByText('18 jul')).toBeInTheDocument()
  expect(screen.getByText('Referencia')).toBeInTheDocument()
  expect(screen.getByText('Serie 1 - 62.5 kg - 9 reps - RIR 2')).toBeInTheDocument()
  expect(screen.getByText('Drop 1 - 45 kg - 8 reps - RIR 3')).toBeInTheDocument()
})
```

- [ ] **Step 6: Write failing UI test for empty state**

Add:

```ts
it('shows an empty last-session reference state for exercises without day-scoped history', () => {
  render(<WorkoutPage />)

  expect(screen.getByText('Primera vez con este ejercicio en este dia')).toBeInTheDocument()
})
```

- [ ] **Step 7: Write failing UI test for read-only controls**

Add:

```ts
it('does not render edit or delete controls inside the last-session reference', () => {
  workoutMocks.lastSessionReferences = new Map([
    [
      exercise.id,
      {
        date: '2026-07-18',
        sets: [{ dropSets: [], set: referenceSetLog }],
      },
    ],
  ])

  render(<WorkoutPage />)

  const referenceBlock = screen.getByText('Ultima sesion').closest('section')
  expect(referenceBlock).not.toBeNull()
  expect(referenceBlock).not.toHaveTextContent(/Editar/i)
  expect(referenceBlock).not.toHaveTextContent(/Eliminar/i)
  expect(screen.queryByRole('button', { name: /Editar serie .*ultima/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Eliminar serie .*ultima/i })).not.toBeInTheDocument()
})
```

- [ ] **Step 8: Run page tests to verify UI tests fail**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: FAIL because `WorkoutPage` has not imported or rendered the hook/block yet.

---

### Task 4: Page Implementation

**Files:**
- Modify: `src/domains/workout/pages/WorkoutPage.tsx`
- Test: `src/domains/workout/pages/WorkoutPage.test.tsx`

**Interfaces:**
- Consumes: `useLastSessionReferencesForDay`.
- Consumes: `LastSessionReference`.
- Produces UI component: `LastSessionReferenceBlock`.

- [ ] **Step 1: Import the hook and type**

In `src/domains/workout/pages/WorkoutPage.tsx`, update imports:

```ts
import { useLastSessionReferencesForDay, useWeightIncreaseRecommendations, useWorkoutProgress, useWorkoutRotationStatus } from '../hooks'
import type { ExerciseState, LastSessionReference, SetLog, WeightUnit } from '../types'
```

- [ ] **Step 2: Read references in `WorkoutPage`**

After `dailyProgress`, add:

```ts
const lastSessionReferences = useLastSessionReferencesForDay({
  date: dateKey,
  dayId: workoutDay?.day.id,
  exercises: dayExercises,
  routineId: workoutDay?.routine.id,
})
```

After `currentLoadNote`, add:

```ts
const currentLastSessionReference = currentExercise ? lastSessionReferences.get(currentExercise.id) : undefined
```

- [ ] **Step 3: Render the block inside the current exercise card**

After the `currentLoadNote` block and before `ActionButton`, add:

```tsx
          {currentExercise ? (
            <LastSessionReferenceBlock reference={currentLastSessionReference} unit={preferredUnit} />
          ) : null}
```

- [ ] **Step 4: Add the block component**

Add near `WeightIncreaseCard`:

```tsx
function LastSessionReferenceBlock({
  reference,
  unit,
}: {
  reference: LastSessionReference | undefined
  unit: WeightUnit
}) {
  return (
    <section className="mb-3 rounded-[10px] border border-dashed border-arsen-purple/35 bg-arsen-bg/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-xs font-extrabold text-arsen-purple2">Ultima sesion</strong>
          <span className="mt-0.5 block text-xs text-arsen-muted">
            {reference ? formatShortWorkoutDate(reference.date) : 'Sin historial previo'}
          </span>
        </div>
        <span className="shrink-0 rounded-full border border-arsen-purple/35 bg-arsen-purple/15 px-2 py-1 text-[11px] font-extrabold text-arsen-purple2">
          Referencia
        </span>
      </div>
      {reference ? (
        <div className="space-y-2">
          {reference.sets.length > 0 ? (
            reference.sets.map(({ dropSets, set }) => (
              <div className="rounded-[9px] border border-white/10 bg-arsen-surface/55 p-2" key={set.id}>
                <div className="text-xs font-semibold text-arsen-ink">
                  Serie {set.order + 1} - {formatWeight(set.weightKg, unit)} - {set.reps} reps - RIR {set.rir}
                </div>
                {dropSets.length > 0 ? (
                  <div className="mt-2 space-y-1 border-l border-arsen-purple/30 pl-2">
                    {dropSets.map((dropSet) => (
                      <div className="text-xs text-arsen-muted" key={dropSet.id}>
                        Drop {dropSet.order + 1} - {formatWeight(dropSet.weightKg, unit)} - {dropSet.reps} reps - RIR {dropSet.rir}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-[9px] border border-white/10 bg-arsen-surface/55 p-2 text-xs text-arsen-muted">
              Sin series principales registradas esa vez.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-[9px] border border-white/10 bg-arsen-surface/55 p-2 text-xs text-arsen-muted">
          Primera vez con este ejercicio en este dia
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Add date formatter**

Near `weekdayLabel`, add:

```ts
function formatShortWorkoutDate(date: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))
}
```

- [ ] **Step 6: Run page tests**

Run: `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`

Expected: PASS.

---

### Task 5: Final Verification And UI Detector

**Files:**
- Verify: all modified files

**Interfaces:**
- Consumes: completed implementation from Tasks 1-4.
- Produces: verified local change set with no commit.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm test src/db/indexeddb.test.ts src/domains/workout/pages/WorkoutPage.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
pnpm build
```

Expected: PASS, including `tsc -b`, Vite build, and service worker generation.

- [ ] **Step 4: Run Impeccable detector**

Run:

```bash
node C:\Users\Chovy\.agents\skills\impeccable\scripts\detect.mjs --json src\domains\workout\pages\WorkoutPage.tsx
```

Expected: no blocking findings for the new reference block.

- [ ] **Step 5: Review diff manually**

Run:

```bash
git diff -- src/domains/workout/types.ts src/domains/workout/repository.ts src/domains/workout/hooks.ts src/domains/workout/pages/WorkoutPage.tsx src/domains/workout/pages/WorkoutPage.test.tsx src/db/indexeddb.test.ts docs/superpowers/specs/2026-08-13-workout-last-session-reference-design.md docs/superpowers/plans/2026-08-13-workout-last-session-reference.md
```

Check:

- The repository filters by `routineId`, `dayId`, and prior `date`.
- The repository keys references by `routineExerciseId`.
- The page renders the block only for current exercise.
- The block has no buttons or click handlers.
- Tests cover same routine/day, other routine/day ignored, no history, visible UI, empty UI, and read-only UI.

- [ ] **Step 6: Report status without committing**

Run:

```bash
git status --short
```

Expected: modified source/test files plus the uncommitted spec and plan.
