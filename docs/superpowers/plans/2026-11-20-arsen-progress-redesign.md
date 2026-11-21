# Arsen Progress Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `/progreso` into a trustworthy offline progress workspace with Resumen, Ejercicios and Historial views, correct 1RM/volume metrics, explainable insights, consistent units and preserved editing/export behavior.

**Architecture:** Keep Dexie as the only source of truth and add a reusable progress dataset/query layer above the existing tables. Pure progress calculations and the local insight engine stay outside React; pages and components consume typed query results through reactive hooks. Existing workout services, snapshots, Health Connect persistence, and backup behavior remain the integration boundaries.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Dexie/useLiveQuery, Recharts, Vitest, Testing Library, existing Lucide/UI components.

**Spec:** `docs/superpowers/specs/2026-11-20-arsen-progress-redesign-design.md`

## Global Constraints

- All durable data remains client-side in IndexedDB; no backend, account, cloud sync or external AI.
- Storage weight remains kg; UI conversion uses `shared/utils/weight.ts` and never multiplies in components.
- Historical logs remain snapshot-based and must work after routines, days or exercises are renamed/deleted.
- Drop sets contribute to volume and do not count as main working sets or progression recommendations.
- The UI remains Spanish (`es-MX`), mobile-first, offline-capable and usable down to 360px inside `max-w-[430px]`.
- Do not add a Dexie schema version unless a functional requirement proves it necessary; prefer derived metrics.
- Do not introduce a new dependency when Recharts, Lucide and existing shared components cover the requirement.
- Do not change the complete backup format or the main workout/routine editors.
- No git branch, worktree, commit, push or merge is allowed without explicit approval from the human.

## Review Focus

- Invalid, zero, negative, non-finite and out-of-range repetitions must not create performance points or records; cover in `progressCalculations.test.ts`.
- Multiple sessions on one day must not duplicate daily Health Connect totals; cover in `health/repository.test.ts`.
- Exercises from deleted routines/days must remain discoverable with historical labels; cover in `db/indexeddb.test.ts`.
- A period with no previous equal-length window must not manufacture a comparison or a negative trend; cover in `progressCalculations.test.ts` and `progressAnalysis.test.ts`.
- Changing or deleting a set/session must update derived summary, exercise detail and insights through the reactive repository; cover in `db/indexeddb.test.ts`.

## File Map

- Create `src/domains/progress/calculations.ts`: pure 1RM, periods, weekly volume, exercise-session aggregations and personal-record calculations.
- Create `src/domains/progress/analysis.ts`: documented thresholds and deterministic insight generation.
- Modify `src/domains/progress/repository.ts`: shared dataset/query results, global exercise queries, period summary, exercise detail and history filters; preserve compatible helpers used by existing flows.
- Modify `src/domains/progress/hooks.ts`: reactive hooks for the new typed queries and period/view filters.
- Modify `src/domains/progress/components/ProgressChart.tsx`: configurable metric/unit chart, dynamic domain, accessible tooltip and empty state.
- Create `src/domains/progress/components/ProgressTabs.tsx`, `ProgressSummary.tsx`, `ExerciseExplorer.tsx`, `ProgressInsights.tsx` and `HistoryView.tsx` only where each component has one clear responsibility.
- Modify `src/domains/progress/pages/ProgressPage.tsx`: route-level view shell, tab state, export choice, summary/explorer/history composition; keep editing helpers working.
- Create `src/domains/progress/pages/ProgressExercisePage.tsx`: canonical exercise detail, metric/period selection, comparison and original-session links.
- Modify `src/domains/progress/pages/ProgressHistoryDatePage.tsx`: unit-aware historical detail and preserved create/edit/delete behavior.
- Modify `src/app/router.tsx`: lazy route for `/progreso/ejercicio/:canonicalName`.
- Modify `src/domains/health/repository.ts` and `src/domains/health/components/HealthProgressCard.tsx`: deduplicated daily points and explicit missing-data labels.
- Modify `src/domains/settings/services.ts`: progress export fields and period/filter support while preserving complete backup behavior.
- Extend `src/domains/progress/pages/ProgressPage.test.tsx`, add `src/domains/progress/calculations.test.ts`, `src/domains/progress/analysis.test.ts`, and extend relevant DB/health/component tests.

---

### Task 1: Replace Score semantics with tested progress calculations

**Files:**
- Create: `src/domains/progress/calculations.ts`
- Test: `src/domains/progress/calculations.test.ts`
- Modify: `src/shared/calculations/workout.ts` and `src/shared/calculations/workout.test.ts` only if shared callers need a compatibility rename

**Interfaces:**
- Produces `ProgressMetricKey = 'weight' | 'reps' | 'volume' | 'estimatedOneRm'` and `ProgressPeriodKey = '4w' | '8w' | '12w' | 'all'`.
- Produces `estimatedOneRm(set: Pick<SetLog, 'weightKg' | 'reps'>): { valueKg: number; kind: 'direct' | 'estimated' } | null`.
- Produces `getPeriodBounds(dates: string[], period: ProgressPeriodKey): { current: DateRange; previous: DateRange | null }`.
- Produces `aggregateExerciseSession(input: ExerciseSessionInput): ExerciseSessionAggregate` and `buildWeeklyVolume(sessions, range)` for repository consumers.
- Preserves `totalVolume` and existing workout callers; no public `performanceScore` consumer may remain in progress UI.

- [ ] **Step 1: Write failing calculation tests** for Epley 2–12 reps, direct 1-rep loads, exclusion of reps outside 1–12/invalid values, volume including drops, main-set-only count, per-session aggregation, period bounds and weekly grouping.
- [ ] **Step 2: Run the focused tests**

  Run: `pnpm test src/domains/progress/calculations.test.ts`

  Expected: FAIL because the new calculation module and interfaces do not exist.
- [ ] **Step 3: Implement the pure calculations** with explicit validation, date-safe local parsing, stable sorting and no UI/unit conversion.
- [ ] **Step 4: Update existing workout calculation tests/callers** only where the old name or semantics would expose Score /100 to Progreso; keep the mathematical Epley helper available under a truthful name if another domain needs it.
- [ ] **Step 5: Run focused and existing calculation tests**

  Run: `pnpm test src/domains/progress/calculations.test.ts src/shared/calculations/workout.test.ts src/shared/calculations/progression.test.ts`

  Expected: all focused calculation tests pass with no regression in progression behavior.

### Task 2: Build the reusable progress dataset and period queries

**Files:**
- Modify: `src/domains/progress/repository.ts`
- Modify: `src/domains/progress/hooks.ts`
- Test: `src/db/indexeddb.test.ts`
- Test: `src/domains/progress/repository.test.ts` (create if a focused repository fixture is more readable than the existing DB suite)

**Interfaces:**
- Consumes `estimatedOneRm`, `aggregateExerciseSession`, `getPeriodBounds` and `buildWeeklyVolume` from Task 1.
- Produces `ProgressDataset`, `ProgressQueryFilters`, `ProgressSummary`, `ProgressExerciseDetail`, `ProgressHistoryFilters`, `getProgressDataset()`, `getProgressSummary(filters)`, `getProgressExerciseDetail(canonicalName, filters)`, and `getProgressHistory(filters)`.
- Keeps `getProgressOverview`, `getProgressExerciseOptions`, `getTrainingDates`, `getSessionsForDate`, `getSessionDetail` and edit-option helpers available until all callers migrate.

- [ ] **Step 1: Add failing Dexie tests** for global exercise discovery across routines, deleted routine/day labels, no-day summary queries, equal-length period comparison, weekly volume, combined history filters and latest/previous exercise sessions.
- [ ] **Step 2: Run the focused DB tests**

  Run: `pnpm test src/db/indexeddb.test.ts`

  Expected: FAIL on the new query names/expected derived fields while the pre-existing cases remain green.
- [ ] **Step 3: Implement one dataset loader** that reads the existing tables once, indexes sessions/logs/sets/drop sets in memory, and derives all new query results without direct Dexie access from components.
- [ ] **Step 4: Implement period filtering and comparison rules**: current period anchored to the latest visible training date, previous equal-length period when available, and no comparison for `all`.
- [ ] **Step 5: Implement global exercise options/detail** using only persisted `snapshot.canonicalName`, including records whose routine/day rows are missing.
- [ ] **Step 6: Implement optional history filters** for period, routine, day and canonical exercise while retaining create/edit/delete session pathways.
- [ ] **Step 7: Add reactive hooks** with dependency arrays that include all filter inputs and preserve undefined loading states.
- [ ] **Step 8: Run the focused DB/repository suite**

  Run: `pnpm test src/db/indexeddb.test.ts src/domains/progress/repository.test.ts`

  Expected: all new and existing progress persistence tests pass; no schema version changes are present.

### Task 3: Add deterministic local performance interpretations

**Files:**
- Create: `src/domains/progress/analysis.ts`
- Test: `src/domains/progress/analysis.test.ts`

**Interfaces:**
- Consumes `ProgressSummary`, `ProgressExerciseDetail` and period aggregates from Task 2.
- Produces `ProgressInsight` with `kind: 'improvement' | 'stable' | 'decline' | 'insufficient'`, title, message, period labels, evidence dates and optional metric values.
- Produces `analyzeProgress(input: ProgressAnalysisInput): ProgressInsight[]`.
- Exposes documented constants for `MIN_COMPARISON_SESSIONS`, `MIN_TREND_SESSIONS`, `PERFORMANCE_CHANGE_TOLERANCE`, and `VOLUME_CHANGE_TOLERANCE`.

- [ ] **Step 1: Write failing tests** for a comparable improvement, stable sessions within tolerance, decline without diagnosis, insufficient data, no previous period, two-session comparison vs. multi-session trend, and evidence dates.
- [ ] **Step 2: Run focused tests**

  Run: `pnpm test src/domains/progress/analysis.test.ts`

  Expected: FAIL because the insight engine does not exist.
- [ ] **Step 3: Implement the rule engine** using 5% performance tolerance, 10% volume tolerance, minimum 2 sessions for comparison and minimum 3 for trends; never infer a cause from absence or decline.
- [ ] **Step 4: Run focused tests**

  Run: `pnpm test src/domains/progress/analysis.test.ts`

  Expected: all insight classifications pass and every positive/negative insight carries dates and metric evidence.

### Task 4: Normalize units, Health Connect aggregation and progress exports

**Files:**
- Modify: `src/domains/health/repository.ts`
- Modify: `src/domains/health/components/HealthProgressCard.tsx`
- Modify: `src/domains/settings/services.ts`
- Test: `src/domains/health/repository.test.ts`
- Test: `src/domains/health/components/HealthProgressCard.test.tsx`
- Test: `src/domains/settings/services.test.ts`
- Test: `src/db/indexeddb.test.ts`

**Interfaces:**
- Consumes the progress dataset and calculation contracts from Tasks 1–2.
- Produces Health Connect daily points deduplicated by calendar date, exercise points filtered by canonical name, and export rows with truthful `estimatedOneRmKg`/direct-load fields.
- Keeps `buildProgressExport`, `exportProgressJson` and `exportProgressCsv` callable by Settings and Progress.

- [ ] **Step 1: Write failing tests** for multiple sessions sharing one day, partial/null health metrics, exercise-specific health filtering, kg/lb display values in progress exports, drop-set volume and explicit CSV/JSON export choice.
- [ ] **Step 2: Run focused tests**

  Run: `pnpm test src/domains/health/repository.test.ts src/domains/health/components/HealthProgressCard.test.tsx src/domains/settings/services.test.ts`

  Expected: FAIL on deduplication/new field expectations while existing Health Connect and backup tests identify compatibility constraints.
- [ ] **Step 3: Deduplicate daily health summaries** by local session date without summing the same day-level calories/steps; retain session/exercise windows as separate records and render `Sin datos` for nulls.
- [ ] **Step 4: Update progress export derivation** to use the new metric names and period/filter scope, preserve the complete backup schema, and keep CSV one-row-per-main-set plus drop-set rows.
- [ ] **Step 5: Route all progress weight labels through `formatWeight`/`kgToUnit`** at query/presentation boundaries so storage remains kg and no component performs conversion arithmetic.
- [ ] **Step 6: Run focused plus existing integration tests**

  Run: `pnpm test src/domains/health/repository.test.ts src/domains/health/components/HealthProgressCard.test.tsx src/domains/settings/services.test.ts src/db/indexeddb.test.ts`

  Expected: all health, export and backup compatibility tests pass.

### Task 5: Build the shared chart, tabs and Resumen workspace

**Files:**
- Create: `src/domains/progress/components/ProgressTabs.tsx`
- Create: `src/domains/progress/components/ProgressSummary.tsx`
- Create: `src/domains/progress/components/ProgressInsights.tsx`
- Modify: `src/domains/progress/components/ProgressChart.tsx`
- Modify: `src/domains/progress/pages/ProgressPage.tsx`
- Modify: `src/domains/progress/hooks.ts`
- Test: `src/domains/progress/components/ProgressChart.test.tsx`
- Modify: `src/domains/progress/pages/ProgressPage.test.tsx`

**Interfaces:**
- Consumes summary/insight/health query results from Tasks 2–4.
- Produces `ProgressView = 'summary' | 'exercises' | 'history'`, accessible tab navigation via `?vista=`, and a chart accepting metric-keyed points, unit label, date/session tooltip data and dynamic Y domain.

- [ ] **Step 1: Write failing UI tests** for default Resumen, no mandatory day filter, period options, comparison labels, no Score/100 copy, tab navigation, empty/loading/insufficient states, accessible textual chart summary and export menu choices.
- [ ] **Step 2: Run focused UI tests**

  Run: `pnpm test src/domains/progress/pages/ProgressPage.test.tsx src/domains/progress/components/ProgressChart.test.tsx`

  Expected: FAIL on new tabs/summary/chart behavior.
- [ ] **Step 3: Implement `ProgressChart`** with the existing Recharts dependency, configurable metric/key/unit, dynamic domain based on visible values, touch-friendly dots/tooltips, date/session labels and an accessible fallback summary.
- [ ] **Step 4: Implement `ProgressTabs`, ProgressSummary and ProgressInsights`** using existing Card/ActionButton/ExerciseArt tokens; keep text Spanish and avoid color-only status communication.
- [ ] **Step 5: Refactor `ProgressPage` into the view shell** with default summary, period state, `?vista=` synchronization, optional filters, health summary, export choice and preserved history navigation; remove Score/100 labels and inline statistical loops.
- [ ] **Step 6: Run focused UI tests and typecheck**

  Run: `pnpm test src/domains/progress/pages/ProgressPage.test.tsx src/domains/progress/components/ProgressChart.test.tsx && pnpm exec tsc -b`

  Expected: all focused UI tests pass and TypeScript reports no errors under strict/noUnused settings.

### Task 6: Add global Exercise Explorer and exercise detail route

**Files:**
- Create: `src/domains/progress/components/ExerciseExplorer.tsx`
- Create: `src/domains/progress/pages/ProgressExercisePage.tsx`
- Modify: `src/domains/progress/pages/ProgressPage.tsx`
- Modify: `src/domains/progress/components/ProgressChart.tsx` if detail-specific metric formatting is needed
- Modify: `src/app/router.tsx`
- Test: `src/domains/progress/components/ExerciseExplorer.test.tsx`
- Test: `src/domains/progress/pages/ProgressExercisePage.test.tsx`

**Interfaces:**
- Consumes `getProgressExerciseOptions`, `getProgressExerciseDetail`, `ProgressMetricKey`, `ProgressPeriodKey`, `ProgressInsight` and the chart contract.
- Produces lazy route `/progreso/ejercicio/:canonicalName`, links to original session details, and a list searchable/sortable/filterable by name, latest date, muscle, routine and day.

- [ ] **Step 1: Write failing tests** for global exercise search, alphabetical/latest sorting, muscle/routine/day filters, deleted-routine exercise visibility, detail metric switching, direct-vs-estimated 1RM labeling, previous-session comparison and original-session link.
- [ ] **Step 2: Run focused tests**

  Run: `pnpm test src/domains/progress/components/ExerciseExplorer.test.tsx src/domains/progress/pages/ProgressExercisePage.test.tsx`

  Expected: FAIL because the explorer/detail route does not exist.
- [ ] **Step 3: Implement the explorer** as a compact mobile list with search, clearable filters, ExerciseArt and last-trained metadata; navigate using encoded canonical names.
- [ ] **Step 4: Implement the detail page** with summary identity, metric/period controls, dynamic chart, comparison card, evidence-backed exercise insights and links to `/progreso/historial/:date?exercise=...`.
- [ ] **Step 5: Register the route lazy in `router.tsx`** and make the Resumen/Exercise tab navigation preserve the selected view context.
- [ ] **Step 6: Run focused UI tests and route typecheck**

  Run: `pnpm test src/domains/progress/components/ExerciseExplorer.test.tsx src/domains/progress/pages/ProgressExercisePage.test.tsx src/domains/progress/pages/ProgressPage.test.tsx && pnpm exec tsc -b`

  Expected: all exercise navigation/detail tests pass and the router builds under strict TypeScript.

### Task 7: Integrate the chronological Historial view without losing editing

**Files:**
- Create: `src/domains/progress/components/HistoryView.tsx`
- Modify: `src/domains/progress/pages/ProgressPage.tsx`
- Modify: `src/domains/progress/pages/ProgressHistoryDatePage.tsx`
- Modify: `src/domains/progress/repository.ts` only for missing history query fields
- Test: `src/domains/progress/components/HistoryView.test.tsx`
- Modify: `src/domains/progress/pages/ProgressHistoryDatePage.test.tsx`
- Modify: `src/db/indexeddb.test.ts`

**Interfaces:**
- Consumes `getProgressHistory`, existing `TrainingCalendarSheet`, `CreateSessionSheet`, `getSessionDetail`, `updateMainSet`, `deleteMainSet`, `deleteWorkoutSession` and `confirmDanger`.
- Produces a history tab with optional period/routine/day/exercise filters, clear action, calendar/list access and unchanged create/edit/delete session behavior.

- [ ] **Step 1: Write failing tests** for unfiltered chronological history, optional combined filters, reset filters, calendar date navigation, future/no-training date states, session detail with main/drop sets, edit/delete propagation and preserved destructive confirmation.
- [ ] **Step 2: Run focused tests**

  Run: `pnpm test src/domains/progress/components/HistoryView.test.tsx src/domains/progress/pages/ProgressHistoryDatePage.test.tsx src/db/indexeddb.test.ts`

  Expected: FAIL on the new history tab behavior; existing date-detail tests expose regressions if editing contracts change.
- [ ] **Step 3: Implement `HistoryView`** with calendar plus chronological rows, clearly scoped filters and a reset action; use existing route for date details and manual past-session creation.
- [ ] **Step 4: Adapt date detail** to preferred-unit formatting and new summary fields while preserving all current mutation services, health details and confirmation dialogs.
- [ ] **Step 5: Verify derived updates after mutations** through live queries and DB tests; do not add persistent caches or duplicate session/set models.
- [ ] **Step 6: Run focused history and integration tests**

  Run: `pnpm test src/domains/progress/components/HistoryView.test.tsx src/domains/progress/pages/ProgressHistoryDatePage.test.tsx src/db/indexeddb.test.ts`

  Expected: history navigation and all create/edit/delete/drop-set compatibility tests pass.

### Task 8: Full UI hardening, visual review and final verification

**Files:**
- Modify: all changed progress/health/settings files only as needed by review findings
- Test: affected progress, health, settings and DB test files

**Interfaces:**
- Consumes the complete implementation from Tasks 1–7.
- Produces no new product surface; this task closes accessibility, responsive, loading/error/empty-state and regression gaps.

- [ ] **Step 1: Run the full test suite**

  Run: `pnpm test`

  Expected: all tests pass with zero failures.
- [ ] **Step 2: Run the production build**

  Run: `pnpm build`

  Expected: `tsc -b`, Vite build and service-worker generation all exit successfully.
- [ ] **Step 3: Run Impeccable visual checks** on changed targets: `critique` + `polish`, then separately `audit` + `harden`; run the mechanical detector once with `impeccable.cmd detect --json`.
- [ ] **Step 4: Inspect the rendered `/progreso` at 360px and 430px** and fix only verified issues: clipped labels, inaccessible controls, chart overflow, missing focus states, color-only meaning, or excessive vertical density.
- [ ] **Step 5: Re-run focused tests for every visual fix, then repeat `pnpm test` and `pnpm build`**.
- [ ] **Step 6: Perform the required full-diff self-review and report any deferred minor risks; request separate approval before any git operation.**

## Self-review checklist

- Spec coverage: Tasks 1–4 cover all calculation, interpretation, unit, Health Connect and export requirements; Tasks 5–7 cover all three views, exercise detail, chart behavior, filters, history editing and navigation; Task 8 covers accessibility, offline/build and visual verification.
- Type consistency: Task 1 defines metric/period primitives consumed by Tasks 2–7; Task 2 defines repository result contracts consumed by analysis and UI; Task 3 defines insight shape consumed by summary/detail.
- Review focus: all five high-risk inputs have named tests in the owning task.
- Proportion: the plan adds only domain-level derived calculations and the UI units required by the supplied spec; no schema, backend, dependency or unrelated editor work is planned.
  