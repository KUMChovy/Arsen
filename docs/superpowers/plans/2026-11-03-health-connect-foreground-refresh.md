# Health Connect foreground refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Arsen re-read the current Health Connect store on app entry, foreground recovery, and while visible, with today's workout prioritized.

**Architecture:** Keep Health Connect access in the existing health service and Kotlin bridge. Add one current-day service and one lifecycle hook mounted by `AppShell`; the hook polls every 45 seconds only while the WebView is visible and deduplicates in-flight reads. Preserve the existing manual full-history sync for historical sessions.

**Tech Stack:** React 19, TypeScript, Vitest, Dexie, Capacitor Kotlin plugin, Android Health Connect.

**Spec:** `docs/superpowers/specs/2026-11-03-health-connect-foreground-refresh-design.md`

## Global Constraints

- All health data remains local in IndexedDB; no backend or raw sample table is introduced.
- Kotlin continues to query Health Connect with the requested time window; no 30-minute bucket assumption is added.
- Cross-domain access goes through `src/domains/health/services.ts` or `src/domains/health/hooks.ts`.
- Automatic reads run only while the app is in the foreground; errors must not interrupt the workout UI.
- UI copy remains Spanish (`es-MX`) and must work within the existing 360–430px mobile shell.
- Do not add a dependency for lifecycle events; use the existing WebView DOM lifecycle events.

## Review Focus

- A current-day sync must not read or rewrite sessions from other dates; covered in Task 1.
- A manual full sync must expose today's data before slow historical reads finish; covered in Task 1.
- Foreground events fired while a read is pending must not create concurrent Health Connect reads; covered in Task 2.
- Disabling the integration or leaving the foreground must stop automatic reads and clean up listeners/timers; covered in Task 2.
- The explanatory UI must not claim a fixed 30-minute Health Connect cadence; covered in Task 3.

### Task 1: Current-day health synchronization

**Files:**
- Modify: `src/domains/health/services.ts`
- Test: `src/domains/health/services.test.ts`

**Interfaces:**
- Consumes: existing `syncWorkoutHealth(sessionId: string, syncTime?: Date)` and `localDateKey`.
- Produces: `syncCurrentWorkoutHealth(syncTime?: Date): Promise<{ syncedSessions: number }>`; existing `syncAllWorkoutHealth` retains its public return type.

- [ ] **Step 1: Write the failing tests**

Add tests named `syncs only sessions from the current local date` and `prioritizes current-day sessions before historical sessions`. Assert the native adapter call order and that the current-day service does not touch a prior-date session.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `pnpm test src/domains/health/services.test.ts`

Expected: FAIL because `syncCurrentWorkoutHealth` is not exported and the full-sync order is still ascending by date.

- [ ] **Step 3: Implement the minimal service changes**

Implement `syncCurrentWorkoutHealth` by selecting the indexed `workoutSessions.date` rows equal to `localDateKey(syncTime)` and delegating each row to `syncWorkoutHealth`. In `syncAllWorkoutHealth`, keep all existing guards and filtering, but order matching current-day rows before historical rows.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `pnpm test src/domains/health/services.test.ts`

Expected: PASS with all health-service tests green.

### Task 2: Foreground auto-sync lifecycle

**Files:**
- Modify: `src/domains/health/hooks.ts`
- Modify: `src/app/AppShell.tsx`
- Test: `src/domains/health/hooks.test.tsx`

**Interfaces:**
- Consumes: `syncCurrentWorkoutHealth` from Task 1.
- Produces: `useHealthAutoSync(enabled: boolean): void`, mounted once by `AppShell`.

- [ ] **Step 1: Write the failing hook tests**

Add tests named `syncs immediately and on visible foreground events` and `does not overlap reads and cleans up when disabled`. Use fake timers and mocked `syncCurrentWorkoutHealth`; assert the initial call, `visibilitychange`/`focus`, 45-second interval, in-flight deduplication, and listener/timer cleanup.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `pnpm test src/domains/health/hooks.test.tsx`

Expected: FAIL because `useHealthAutoSync` does not exist.

- [ ] **Step 3: Implement the hook and mount it**

Add a 45-second foreground interval constant, a single in-flight promise guard, and listeners for `document.visibilitychange` and `window.focus`. Skip interval/focus work while `document.visibilityState` is hidden, remove listeners and the interval on cleanup, and swallow optional-integration errors. In `AppShell`, read app settings with the existing `useLiveQuery` pattern and call the hook only when `healthIntegrationEnabled` is true.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `pnpm test src/domains/health/hooks.test.tsx src/domains/health/services.test.ts`

Expected: PASS with the lifecycle and service tests green.

### Task 3: Correct Health Connect freshness copy

**Files:**
- Modify: `src/domains/health/components/HealthSummaryCard.tsx`
- Test: `src/domains/health/components/HealthSummaryCard.test.tsx`
- Modify: `src/domains/health/components/HealthSetupWizard.tsx`
- Test: `src/domains/health/components/HealthSetupWizard.test.tsx`

**Interfaces:**
- Consumes: the existing `HealthSummaryCard` props and `syncedAt` field.
- Produces: accurate Spanish explanatory copy only; no contract change.

- [ ] **Step 1: Write the failing UI assertion**

Update the existing availability-menu tests to assert that both menus explain Arsen's foreground Health Connect query and the provider publication dependency, and do not contain `30 minutos`. Update the timestamp assertion to expect `Última consulta`.

- [ ] **Step 2: Run the focused UI test to verify it fails**

Run: `pnpm test src/domains/health/components/HealthSummaryCard.test.tsx`

Expected: FAIL because the current copy still says `Health Connect puede entregar intervalos de aproximadamente 30 minutos` and labels the timestamp `Última lectura`.

- [ ] **Step 3: Implement the copy-only change**

Replace the inaccurate interval claim in both health surfaces with concise Spanish copy that says Arsen queries the current Health Connect state while visible and that the watch's companion app must have published the record. Rename the timestamp label to `Última consulta`.

- [ ] **Step 4: Run the focused UI test to verify it passes**

Run: `pnpm test src/domains/health/components/HealthSummaryCard.test.tsx`

Expected: PASS with the updated UI assertions.

### Task 4: Full verification and review

**Files:**
- Verify: all changed files from Tasks 1–3

- [ ] **Step 1: Run the complete TypeScript test suite**

Run: `pnpm test`

Expected: exit code 0 and no failed tests.

- [ ] **Step 2: Run the web production build**

Run: `pnpm build`

Expected: `tsc -b`, Vite build, and service-worker generation all succeed.

- [ ] **Step 3: Run Android unit tests**

Run: `cd android; .\gradlew.bat testDebugUnitTest --no-daemon`

Expected: Kotlin unit tests pass; if Gradle cache permissions prevent execution, record the exact environment blocker.

- [ ] **Step 4: Review the complete diff**

Check callers, listener cleanup, current-day date boundaries, optional integration guards, Spanish copy, and no accidental edits to the Kotlin bridge. Run the Impeccable detector over `src/app/AppShell.tsx`, `src/domains/health/components/HealthSummaryCard.tsx`, and `src/domains/health/hooks.ts`.

- [ ] **Step 5: Verify completion evidence**

Run `git diff --check`, confirm `git status --short`, and report test/build outcomes plus any device-only verification still required.
