# Health Connect authoritative heart-rate aggregate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use Health Connect's own heart-rate summary values instead of recalculating pulse statistics inside Arsen.

**Architecture:** Query Health Connect's official heart-rate aggregate metrics for each requested window and pass them through unchanged. Raw `HeartRateRecord` samples are not read or averaged by Arsen; raw sample reads remain only for oxygen, which has no equivalent local pulse calculation here.

**Tech Stack:** Kotlin, Android Health Connect client 1.1.0, JUnit, existing Capacitor bridge.

**Spec:** Existing Health Connect integration in `docs/superpowers/specs/2026-10-31-smartwatch-health-integration-design.md`; official aggregate support is documented at https://developer.android.com/health-and-fitness/health-connect/aggregate-data.

## Global Constraints

- Keep all health data local; do not persist raw heart-rate samples in Arsen.
- Keep the existing permission contract: `android.permission.health.READ_HEART_RATE`.
- Query the exact requested `TimeRangeFilter`; do not add fixed time buckets.
- Keep other metrics independent so a heart-rate read failure does not discard calories, steps, or oxygen.
- Do not add dependencies or change the TypeScript bridge payload.
- Do not calculate heart-rate average, maximum, or minimum in Arsen; use Health Connect's aggregate values.

## Review Focus

- Health Connect aggregate values are the only source for heart-rate summary fields.
- No local average, maximum, or minimum is calculated from `HeartRateRecord.samples`.
- A missing aggregate metric remains `null`, never zero or fabricated data.
- Heart-rate fallback works independently for day, session, and exercise windows.
- Existing permissions, pagination, and error handling remain intact.

### Task 1: Health Connect heart-rate aggregate summary

**Files:**
- Modify: `android/app/src/main/kotlin/com/kumchovy/arsen/codex/health/HealthSummaryCalculator.kt`
- Test: `android/app/src/test/kotlin/com/kumchovy/arsen/codex/health/HealthSummaryCalculatorTest.kt`

- [x] **Step 1: Write the failing test**

Add a test where raw-looking values differ from Health Connect's aggregate values and assert the aggregate values are returned in `CalculatedHealthMetrics`.

- [x] **Step 2: Run the focused test to verify it fails**

Run: `cd android; .\gradlew.bat :app:testDebugUnitTest --tests com.kumchovy.arsen.codex.health.HealthSummaryCalculatorTest --no-daemon`

Expected: FAIL because the calculator currently averages the raw samples before considering the aggregate values.

- [x] **Step 3: Implement the minimal calculator fallback**

Make `HealthSamples.heartRate` carry the typed aggregate and make `HealthSummaryCalculator.summarize` pass its average, maximum, and minimum through unchanged.

- [x] **Step 4: Run the focused test to verify it passes**

Run the same Gradle test command and expect the calculator tests to pass.

### Task 2: Query Health Connect heart-rate aggregates

**Files:**
- Modify: `android/app/src/main/kotlin/com/kumchovy/arsen/codex/health/HealthConnectManager.kt`

- [x] **Step 1: Add aggregate heart-rate metrics to the existing aggregate read**

Request `HeartRateRecord.BPM_AVG`, `BPM_MAX`, and `BPM_MIN` in the same requested window and pass those values to the calculator. Do not issue a raw heart-rate record read.

- [x] **Step 2: Preserve isolated error handling**

Keep heart-rate aggregate failures isolated from calories, steps, and oxygen.

- [x] **Step 3: Run Android unit tests**

Run: `cd android; .\gradlew.bat :app:testDebugUnitTest --no-daemon`

Expected: `BUILD SUCCESSFUL` with all Kotlin unit tests passing.

### Task 3: Full verification

**Files:**
- Verify: all changed Kotlin and test files.

- [x] **Step 1: Run the complete web test suite**

Run: `pnpm test`

- [x] **Step 2: Run the production build**

Run: `pnpm build`

- [x] **Step 3: Review the diff and checks**

Run `git diff --check` and inspect the Kotlin diff for unchanged permissions, bridge names, and JSON field names. A physical device test remains necessary to confirm the exact watch/provider record is readable at runtime.
