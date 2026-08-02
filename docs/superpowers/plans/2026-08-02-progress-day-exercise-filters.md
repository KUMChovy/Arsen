# Progress Day And Exercise Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify `/progreso` so all visible progress, metrics, charts, and history use only combined day and exercise filters.

**Architecture:** Reuse the existing progress repository instead of adding a new filtering layer. `ProgressPage` owns the selected `dayId` and `canonicalName`; hooks pass those filters into repository functions; the history route carries the same filters through query params.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Dexie, Vitest, fake-indexeddb.

## Global Constraints

- UI strings stay in Spanish.
- No Dexie schema change.
- Import/export and backup stay unchanged.
- Use `ExerciseLog.snapshot.canonicalName` for historical exercise filtering.
- Keep mobile layout usable down to 360px.
- Do not commit without explicit human confirmation.

---

### Task 1: Repository Filters

**Files:**
- Modify: `src/domains/progress/repository.ts`
- Modify: `src/domains/progress/hooks.ts`
- Test: `src/db/indexeddb.test.ts`

**Interfaces:**
- Consumes: existing `ProgressOverviewFilters`.
- Produces:
  - `getTrainingDates(filters?: ProgressOverviewFilters): Promise<string[]>`
  - `getSessionsForDate(date: string, filters?: ProgressOverviewFilters): Promise<RecentSessionSummary[]>`
  - `getSessionDetail(sessionId: string, filters?: ProgressOverviewFilters): Promise<SessionDetail | null>`
  - matching hook parameters in `useTrainingDates`, `useSessionsForDate`, and `useSessionDetail`.

- [ ] **Step 1: Add failing repository coverage**

Add one Dexie integration test that creates two sessions on the same date with different days and exercises, then asserts:

```ts
expect((await getSessionsForDate('2026-08-02', { dayId: 'day-a' })).map((session) => session.id)).toEqual(['session-a'])
expect((await getSessionsForDate('2026-08-02', { canonicalName: 'press-banca' })).map((session) => session.id)).toEqual(['session-b'])
expect(await getTrainingDates({ canonicalName: 'press-banca' })).toEqual(['2026-08-02'])
```

Add one assertion for detail filtering:

```ts
const detail = await getSessionDetail('session-b', { canonicalName: 'press-banca' })
expect(detail?.exercises.map((exercise) => exercise.exerciseName)).toEqual(['Press banca'])
```

- [ ] **Step 2: Run focused test**

Run:

```bash
pnpm test src/db/indexeddb.test.ts
```

Expected before implementation: the new filter assertions fail because the functions do not accept or apply filters yet.

- [ ] **Step 3: Implement minimal repository filters**

In `repository.ts`:

```ts
export async function getTrainingDates(filters: ProgressOverviewFilters = {}): Promise<string[]> {
  const overview = await getProgressOverview(filters)

  return [...new Set(overview.recentSessions.map((session) => session.date))].sort((a, b) => b.localeCompare(a))
}

export async function getSessionsForDate(date: string, filters: ProgressOverviewFilters = {}): Promise<RecentSessionSummary[]> {
  if (!date) return []

  const overview = await getProgressOverview(filters)

  return overview.recentSessions.filter((session) => session.date === date)
}
```

Update `getSessionDetail` to accept filters and filter mapped exercises:

```ts
const visibleExerciseLogs = filters.canonicalName
  ? exerciseLogs.filter((log) => log.snapshot.canonicalName === filters.canonicalName)
  : exerciseLogs
```

Then map `visibleExerciseLogs`.

- [ ] **Step 4: Update hooks**

In `hooks.ts`:

```ts
export function useTrainingDates(filters: ProgressOverviewFilters = {}) {
  return useLiveQuery(() => getTrainingDates(filters), [filters.canonicalName, filters.dayId], undefined)
}

export function useSessionDetail(sessionId: string | null, filters: ProgressOverviewFilters = {}) {
  return useLiveQuery(
    () => (sessionId ? getSessionDetail(sessionId, filters) : Promise.resolve(null)),
    [sessionId, filters.canonicalName, filters.dayId],
    undefined,
  )
}

export function useSessionsForDate(date: string | undefined, filters: ProgressOverviewFilters = {}) {
  return useLiveQuery(() => getSessionsForDate(date ?? '', filters), [date, filters.canonicalName, filters.dayId], undefined)
}
```

- [ ] **Step 5: Run focused test again**

Run:

```bash
pnpm test src/db/indexeddb.test.ts
```

Expected: focused repository and existing DB tests pass.

### Task 2: Main Progress UI

**Files:**
- Modify: `src/domains/progress/pages/ProgressPage.tsx`

**Interfaces:**
- Consumes:
  - `useProgressDayOptions(): ProgressDayOption[] | undefined`
  - `useProgressExerciseOptions(): ProgressExerciseOption[] | undefined`
  - `useProgressOverview({ dayId, canonicalName })`
  - `useTrainingDates({ dayId, canonicalName })`
- Produces filtered navigation to `/progreso/historial/:date?dayId=<id>&exercise=<canonicalName>`.

- [ ] **Step 1: Remove general/global state**

Delete:

```ts
type ProgressMode = 'general' | 'day' | 'exercise' | 'global'
const [mode, setMode] = useState<ProgressMode>('general')
```

Keep only `panelMode`, `selectedDayId`, and `selectedExercise`.

- [ ] **Step 2: Ensure day defaults when data exists**

Use the existing options:

```ts
const selectedDay = dayOptions.find((day) => day.dayId === selectedDayId) ?? dayOptions[0] ?? null
const activeDayId = selectedDay?.dayId ?? null
```

Add a small effect:

```ts
useEffect(() => {
  if (!selectedDayId && dayOptions[0]) setSelectedDayId(dayOptions[0].dayId)
}, [dayOptions, selectedDayId])
```

- [ ] **Step 3: Apply combined filters**

Use:

```ts
const progressFilters = {
  canonicalName: selectedExercise,
  dayId: activeDayId,
}
const overview = useProgressOverview(progressFilters)
const trainingDates = useTrainingDates(progressFilters) ?? []
```

- [ ] **Step 4: Replace tabs with two selects**

Render one `Card` containing:

```tsx
<select aria-label="Filtrar por dia" value={activeDayId ?? ''} onChange={(event) => setSelectedDayId(event.target.value || null)}>
  {dayOptions.length === 0 ? <option value="">Sin dias con registros</option> : null}
  {dayOptions.map((option) => (
    <option key={option.dayId} value={option.dayId}>
      {option.name} - {option.routineName} ({option.sessions})
    </option>
  ))}
</select>
<select aria-label="Filtrar por ejercicio" value={selectedExercise ?? ''} onChange={(event) => setSelectedExercise(event.target.value || null)}>
  <option value="">Todos los ejercicios</option>
  {exerciseOptions.map((option) => (
    <option key={option.canonicalName} value={option.canonicalName}>
      {option.name} ({option.sessions})
    </option>
  ))}
</select>
```

- [ ] **Step 5: Remove visible general/global UI**

Delete:

- mode tabs.
- duplicate summary card with `ChevronDown`.
- copy branches that mention `General`, `Global`, `Todas las sesiones registradas`, or `Une sesiones aunque cambies de rutina`.

- [ ] **Step 6: Add mobile empty state**

When `overview` exists and `overview.totalSets === 0`, show:

```tsx
<Card className="p-4 text-sm font-semibold text-arsen-muted">
  No hay series para este dia y ejercicio. Cambia el filtro o registra una sesion.
</Card>
```

Avoid showing misleading metric cards as the primary result before that state.

- [ ] **Step 7: Preserve history and export actions**

Build history URLs with the active filters:

```ts
const params = new URLSearchParams()
if (activeDayId) params.set('dayId', activeDayId)
if (selectedExercise) params.set('exercise', selectedExercise)
navigate(`/progreso/historial/${date}${params.size ? `?${params.toString()}` : ''}`)
```

Keep `exportProgressJson` and `exportProgressCsv` unchanged.

### Task 3: Filtered History Route

**Files:**
- Modify: `src/domains/progress/pages/ProgressHistoryDatePage.tsx`

**Interfaces:**
- Consumes query params `dayId` and `exercise`.
- Consumes `useSessionsForDate(date, filters)` and `useSessionDetail(expandedSessionId, filters)`.
- Produces the same editing actions as before.

- [ ] **Step 1: Read query params**

Use React Router:

```ts
const [searchParams] = useSearchParams()
const filters = {
  canonicalName: searchParams.get('exercise'),
  dayId: searchParams.get('dayId'),
}
```

- [ ] **Step 2: Pass filters into hooks**

Use:

```ts
const sessions = useSessionsForDate(date, filters) ?? []
const expandedDetail = useSessionDetail(expandedSessionId, filters)
```

- [ ] **Step 3: Keep editing unchanged**

Do not change calls to `updateWorkoutSession`, `moveMainSetToExercise`, `updateMainSet`, `deleteMainSet`, or `deleteWorkoutSession`.

- [ ] **Step 4: Clarify empty state**

Replace the no-sessions copy with:

```tsx
<Card className="p-4 text-sm text-arsen-muted">
  No hay sesiones para esta fecha con el filtro actual.
</Card>
```

### Task 4: Verification

**Files:**
- Run checks only.

**Interfaces:**
- Consumes all modified code and tests.
- Produces evidence for completion.

- [ ] **Step 1: Run full tests**

Run:

```bash
pnpm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run production build**

Run:

```bash
pnpm build
```

Expected: `tsc -b`, `vite build`, and `scripts/generate-sw.mjs` succeed.

- [ ] **Step 3: Run Impeccable detector**

Run:

```bash
node C:\Users\Chovy\.agents\skills\impeccable\scripts\detect.mjs --json src/domains/progress/pages/ProgressPage.tsx src/domains/progress/pages/ProgressHistoryDatePage.tsx
```

Expected: no blocking UI findings. Fix any concrete overlap, contrast, inaccessible control, or mobile layout issue it reports.

- [ ] **Step 4: Review diff**

Run:

```bash
git diff -- src/domains/progress/repository.ts src/domains/progress/hooks.ts src/domains/progress/pages/ProgressPage.tsx src/domains/progress/pages/ProgressHistoryDatePage.tsx src/db/indexeddb.test.ts docs/superpowers/specs/2026-08-02-progress-day-exercise-filters-design.md docs/superpowers/plans/2026-08-02-progress-day-exercise-filters.md
```

Expected: diff only contains the approved progress simplification and docs.
