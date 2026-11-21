# Arsen Historial Redesign Implementation Plan

> **For inline execution:** Use `superpowers:executing-plans` to implement this plan task-by-task. Do not use subagents or `subagent-driven-development`.

**Goal:** Convert the current Progreso Historial into an offline training diary with all-history exploration, direct session navigation, reliable detail/editing, safe duplication, comparison and individual export.

**Architecture:** Extend the existing progress repository and workout services instead of adding parallel data models. Keep the current Progress calculations/analysis as the only metrics source, expose session detail by ID, and move all multi-record writes behind transactional workout services. Build the UI as a list/calendar history workspace plus a dedicated session detail route that reuses existing cards, sheets, tokens and Health Connect summaries.

**Tech Stack:** React 19, TypeScript, React Router 7, Dexie/IndexedDB, dexie-react-hooks, Vitest, Testing Library, Tailwind v4, existing Lucide/Recharts/PapaParse dependencies.

**Spec:** `docs/superpowers/specs/2026-11-21-arsen-history-redesign-design.md` and the supplied Historial spec.

## Global Constraints

- Keep IndexedDB/Dexie and offline operation; add no backend, cloud sync, authentication or external AI.
- UI strings and demo data remain Spanish (`es-MX`).
- Store weight in kg; convert only through `shared/utils/weight.ts`.
- Preserve historical snapshots and fallback labels when routines/days are renamed or deleted.
- Drop sets contribute to volume but never to main-set counts or progression recommendations.
- Reuse `progress/calculations.ts`, `progress/analysis.ts`, existing repositories/services and Health Connect summaries.
- Do not change the complete backup format or native Health Connect permissions.
- Keep the mobile shell usable from 360px to 430px with keyboard/focus accessibility and touch targets of at least 44px.
- Do not run git commands that create commits, branches, worktrees, pushes or merges without explicit user approval.

## Review Focus

- Two sessions on the same date must remain independently addressable and must not collapse into one calendar/list result. Test in the repository and route-level UI.
- A session whose routine/day rows were deleted must still render snapshot exercise names and explicit deleted-context fallbacks. Test with missing rows.
- A draft or session without main sets may appear in history but must not affect progress totals, comparisons or records. Test both query paths.
- A failed compound edit must leave date, associations, sets and drop sets unchanged. Test a transaction rejection path.
- A future date and a deleted/nonexistent session must not create or expose an invalid record. Test calendar and detail route states.

---

### Task 1: Historical query contracts and session identity

**Files:**
- Modify: `src/domains/progress/repository.ts`
- Modify: `src/domains/progress/hooks.ts`
- Modify: `src/domains/progress/components/HistoryView.tsx`
- Modify: `src/domains/progress/pages/ProgressPage.tsx`
- Modify: `src/app/router.tsx`
- Test: `src/domains/progress/repository.test.ts` (create)
- Test: `src/domains/progress/components/HistoryView.test.tsx`
- Test: `src/domains/progress/pages/ProgressPage.test.tsx`

**Interfaces:**
- Produces `HistoryFilters`, `HistoryMode`, `HistorySummary`, `HistorySessionSummary` and `getHistory(filters)` with `sessionId`, date, historical labels, status, exercise/main-set/drop-set counts and volume.
- Produces `getSessionDetail(sessionId, filters?)` that returns a session even with missing routine/day rows and includes notes, status, timestamps, health and snapshot exercise data.
- Adds `useHistory`, `useSessionDetailById` and preserves the existing date query helpers until compatibility migration is complete.
- Adds lazy route `/progreso/historial/sesion/:sessionId`; old `/progreso/historial/:date` remains valid.

- [ ] **Step 1: Write failing repository tests** for all-history default, date/routine/day/exercise/status/search filters, normalized accents/case, summary counts, multiple sessions on one date, drafts without sets, deleted routine/day labels and direct detail-by-ID.
- [ ] **Step 2: Run the focused tests**

  Run: `pnpm test src/domains/progress/repository.test.ts`

  Expected: FAIL because the new history contracts and tests do not exist.
- [ ] **Step 3: Implement one dataset-derived history query** over existing tables. Search snapshot names and current labels, normalize with `shared/utils/normalize.ts`, keep drafts visible in history, and exclude drafts/no-main-set records only from performance aggregates.
- [ ] **Step 4: Extend session detail** with historical notes/status/timestamps and explicit fallback labels; never reconstruct missing historical names from current routine rows.
- [ ] **Step 5: Write failing navigation/UI tests** proving cards and calendar selections navigate with the exact session ID, and the old date route still lists multiple sessions.
- [ ] **Step 6: Implement route registration and query-string/session-state wiring** for all-history default, mode, filters, selected calendar month and approximate scroll restoration.
- [ ] **Step 7: Run focused repository/UI tests and typecheck**

  Run: `pnpm test src/domains/progress/repository.test.ts src/domains/progress/components/HistoryView.test.tsx src/domains/progress/pages/ProgressPage.test.tsx && pnpm exec tsc -b`

  Expected: all new/legacy tests pass and TypeScript reports no errors.

### Task 2: Atomic session and record mutations

**Files:**
- Modify: `src/domains/workout/services.ts`
- Modify: `src/domains/workout/repository.ts`
- Modify: `src/domains/progress/repository.ts`
- Test: `src/domains/workout/services.test.ts`
- Test: `src/db/indexeddb.test.ts`

**Interfaces:**
- Produces `updateHistoricalSession(sessionId, input)`, `addExerciseToHistoricalSession(input)`, `updateHistoricalSet(input)`, `deleteHistoricalExercise(exerciseLogId)`, `duplicateSessionAsDraft(input)` and `exportableSessionSnapshot(sessionId)`.
- Existing Entreno functions remain compatible; shared validation checks future dates, session conflicts, valid routine/day ownership and numeric ranges before writes.
- Compound operations include session, exercise log, set, drop set, skip and timestamp/status updates in one Dexie transaction where more than one table is touched.

- [ ] **Step 1: Write failing service/DB tests** for atomic general edits, conflict rejection, notes/status updates, adding an exercise and sets, editing/reordering a main set with attached drops, deleting a set/exercise/session, and rollback when a related write fails.
- [ ] **Step 2: Run focused tests**

  Run: `pnpm test src/domains/workout/services.test.ts src/db/indexeddb.test.ts`

  Expected: FAIL on the new service contracts or on rollback expectations.
- [ ] **Step 3: Implement session validation and atomic general updates** without changing historical snapshots or touching unrelated logs.
- [ ] **Step 4: Implement add/edit/delete record operations** with order normalization, drop-set ownership preservation and session status/timestamp refresh.
- [ ] **Step 5: Implement draft duplication** by copying structure/reference values into a new draft session without copying completion state, and reject future target dates or unsafe existing-session collisions.
- [ ] **Step 6: Run focused service/DB tests**

  Run: `pnpm test src/domains/workout/services.test.ts src/db/indexeddb.test.ts`

  Expected: all mutation, deletion, rollback and compatibility tests pass.

### Task 3: History workspace with list, calendar, search and filters

**Files:**
- Modify: `src/domains/progress/components/HistoryView.tsx`
- Modify: `src/domains/progress/pages/ProgressPage.tsx`
- Modify: `src/domains/progress/components/TrainingCalendarSheet.tsx` only if behavior is reused in-place
- Create: `src/domains/progress/components/HistoryFilters.tsx` if the existing page becomes unwieldy
- Test: `src/domains/progress/components/HistoryView.test.tsx`
- Test: `src/domains/progress/components/HistoryFilters.test.tsx` if created

**Interfaces:**
- Consumes `getHistory`, `HistoryFilters`, settings unit and session-ID navigation from Task 1.
- Produces accessible Lista/Calendario modes, month navigation, selected-day session list, filter chips/reset, all-history default, period summary and empty/error/loading states.

- [ ] **Step 1: Write failing component tests** for mode switching with shared filters, chronological month grouping, same-day multiple sessions, search/filter combinations, clear action, no-results recovery, future-date prevention, selected month persistence and session-ID navigation.
- [ ] **Step 2: Run focused UI tests**

  Run: `pnpm test src/domains/progress/components/HistoryView.test.tsx`

  Expected: FAIL on the new controls and behavior.
- [ ] **Step 3: Implement compact mobile filters** for search, date range, routine, day, exercise and status, with quick periods and custom range support; do not alter Resumen/Ejercicios period defaults.
- [ ] **Step 4: Implement list/calendar composition** using the same filtered query, explicit count/period/summary labels, accessible controls and exact-ID navigation.
- [ ] **Step 5: Run focused tests at 360px/430px-compatible markup and typecheck**

  Run: `pnpm test src/domains/progress/components/HistoryView.test.tsx src/domains/progress/pages/ProgressPage.test.tsx && pnpm exec tsc -b`

  Expected: all history workspace tests pass with no type errors.

### Task 4: Dedicated session detail and mobile editing

**Files:**
- Create: `src/domains/progress/pages/ProgressHistorySessionPage.tsx`
- Create: `src/domains/progress/components/SessionActionMenu.tsx`
- Create: `src/domains/progress/components/EditHistoricalSessionSheet.tsx`
- Create: `src/domains/progress/components/EditHistoricalExerciseSheet.tsx` if needed
- Modify: `src/domains/progress/pages/ProgressHistoryDatePage.tsx`
- Modify: `src/domains/progress/pages/ProgressPage.tsx` only for shared editor extraction
- Modify: `src/domains/progress/repository.ts`
- Test: `src/domains/progress/pages/ProgressHistorySessionPage.test.tsx`
- Test: `src/domains/progress/pages/ProgressHistoryDatePage.test.tsx`

**Interfaces:**
- Consumes `useSessionDetailById`, Task 2 mutation services, existing `EditSetSheet`, `CreateSessionSheet`, `HealthSummaryCard`, `ExerciseArt`, `formatWeight`, `confirmDanger` and Progress exercise route.
- Produces header, summary stats, notes, expandable exercises, main/drop set rows, add/edit/delete actions, health states, progress links, back-context preservation and deleted-session handling.

- [ ] **Step 1: Write failing page tests** for exact session rendering, historical labels, notes, draft/incomplete state, units, drop-set association, health partial/missing states, exercise-to-Progreso link and nonexistent-session recovery.
- [ ] **Step 2: Run focused page tests**

  Run: `pnpm test src/domains/progress/pages/ProgressHistorySessionPage.test.tsx`

  Expected: FAIL because the dedicated page and route contract do not exist.
- [ ] **Step 3: Implement detail page** with compact summary and expandable exercise cards; exclude artificial duration and show only stored/reliable health data.
- [ ] **Step 4: Add general session editor and action menu** using transactional services, preserving `location.state`/query context on return.
- [ ] **Step 5: Add exercise/set/drop-set editing and deletion affordances** with confirmation, disabled states during writes, success/error messages and no nested modal flow.
- [ ] **Step 6: Adapt the legacy date page** to link/open exact sessions while preserving create-session compatibility and old links.
- [ ] **Step 7: Run focused page/date tests and typecheck**

  Run: `pnpm test src/domains/progress/pages/ProgressHistorySessionPage.test.tsx src/domains/progress/pages/ProgressHistoryDatePage.test.tsx && pnpm exec tsc -b`

  Expected: detail, legacy compatibility and TypeScript checks pass.

### Task 5: Comparison, records, notes and individual exports

**Files:**
- Modify: `src/domains/progress/repository.ts`
- Modify: `src/domains/progress/analysis.ts`
- Modify: `src/domains/settings/services.ts`
- Create: `src/domains/progress/components/SessionComparison.tsx`
- Create: `src/domains/progress/components/SessionExportMenu.tsx`
- Test: `src/domains/progress/repository.test.ts`
- Test: `src/domains/progress/analysis.test.ts`
- Test: `src/domains/settings/services.test.ts`
- Test: `src/domains/progress/components/SessionComparison.test.tsx`

**Interfaces:**
- Produces `compareSessions(leftId, rightId)`, verified session record marks, `exportSessionJson(sessionId)` and `exportSessionCsv(sessionId)` without altering full-backup exports.
- Reuses Progress calculations and analysis thresholds; returns insufficient/non-comparable explanations instead of overstating improvement.

- [ ] **Step 1: Write failing tests** for automatic previous-equivalent selection, manual pair selection, shared exercises, absolute/percentage differences, insufficient data, verified records against earlier history, notes/drop sets in exports and unit/date serialization.
- [ ] **Step 2: Run focused tests**

  Run: `pnpm test src/domains/progress/repository.test.ts src/domains/progress/analysis.test.ts src/domains/settings/services.test.ts`

  Expected: FAIL on comparison/record/session-export contracts.
- [ ] **Step 3: Implement comparison and record queries** using existing aggregate/analysis helpers and snapshot canonical names.
- [ ] **Step 4: Implement session-scoped JSON/CSV export** with one row per main set and associated drop rows, preserving notes and stored kg values plus display-unit metadata.
- [ ] **Step 5: Implement compact comparison/export UI** and attach it to session actions.
- [ ] **Step 6: Run focused comparison/export tests**

  Run: `pnpm test src/domains/progress/repository.test.ts src/domains/progress/analysis.test.ts src/domains/settings/services.test.ts src/domains/progress/components/SessionComparison.test.tsx`

  Expected: all comparison, records, notes and export tests pass.

### Task 6: Full UI hardening and verification

**Files:**
- Modify: affected history/progress/workout/settings files only when a verified test or visual review requires it
- Test: affected test files from Tasks 1–5

**Interfaces:**
- Consumes the integrated Historial implementation and produces no new product surface; closes accessibility, responsive, performance, offline and regression gaps.

- [ ] **Step 1: Run the full unit/integration suite**

  Run: `pnpm test`

  Expected: zero failures.
- [ ] **Step 2: Run the production build**

  Run: `pnpm build`

  Expected: strict TypeScript, Vite bundle and service-worker generation all succeed.
- [ ] **Step 3: Run Impeccable visual checks** against the changed history routes: `critique` + `polish`, then separately `audit` + `harden`; run `impeccable.cmd detect --json` once over changed UI targets. If the launcher lacks a command, document the exact limitation and use direct rendered inspection.
- [ ] **Step 4: Inspect rendered Historial at 360px and 430px** for clipped month labels, horizontal overflow, focus states, touch targets, color-only status, loading/error/empty states and excessive vertical density; fix only observed issues with a failing test first for behavior changes.
- [ ] **Step 5: Re-run focused tests for visual fixes, then repeat `pnpm test` and `pnpm build`**.
- [ ] **Step 6: Review the complete diff with the requesting-code-review checklist, classify deferred minors, and request separate approval before any git operation.**

## Self-review checklist

- Spec coverage: Task 1 covers query/navigation/history integrity; Task 2 covers atomic management and duplication; Task 3 covers list/calendar/search/filter/context; Task 4 covers detail/editing/health/accessibility; Task 5 covers comparison/records/notes/export; Task 6 covers responsive/offline/regression verification.
- Type consistency: Task 1 owns `HistoryFilters`, `HistorySessionSummary` and session-ID detail; Task 2 owns mutation contracts; Tasks 3–5 consume those contracts without direct Dexie access.
- Review focus: each high-risk input has a named test in the owning task.
- Proportion: existing Progress calculations, Health Connect persistence, calendar patterns and editor controls are reused; no schema/version change is planned without evidence.
