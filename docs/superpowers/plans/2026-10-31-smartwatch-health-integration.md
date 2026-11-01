# Integración diaria de Health Connect — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. This repository requires inline execution; do not use implementation subagents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorientar la integración de Health Connect a un resumen general diario y guiar al usuario para completar la cadena reloj → app fabricante → Health Connect → Arsen.

**Architecture:** El plugin Kotlin seguirá siendo la única frontera con Health Connect y leerá una sola ventana diaria. TypeScript persistirá `health.day`; los campos de resumen de sesión se conservan solo como legacy opcional para no romper importaciones anteriores. Ajustes tendrá un asistente inline con estados de disponibilidad, permisos y conexión de terceros.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Dexie, Capacitor, Kotlin, AndroidX Health Connect Client, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-31-smartwatch-health-integration-design.md`

## Global Constraints

- La integración permanece opcional y apagada por defecto.
- Arsen no lee el reloj por Bluetooth, no escribe en Health Connect y no sincroniza en segundo plano.
- Solo se muestra y persiste el resumen general del día; no se consulta ni se renderiza una ventana de sesión.
- Los valores sin permiso o sin registros son `null`, nunca cero.
- Health Connect no se presenta como conectado al reloj: la app del fabricante debe publicar los datos primero.
- No se añade tabla ni índice Dexie; la compatibilidad de backups legacy se mantiene.
- No se ejecutan commits ni otras operaciones Git.
- Se usa `pnpm`; no se ejecuta `npm install`.

## Review Focus

- Ventana diaria local: el rango debe terminar en `min(syncTime, siguiente medianoche)` y probarse alrededor de medianoche.
- Pasos/calorías: deben seguir agregándose desde Health Connect y no duplicarse por leer intervalos manualmente.
- Permiso parcial o cero registros: la integración debe poder activarse con permisos parciales y mostrar una ausencia explicable sin inventar datos.
- Dependencia de terceros: el wizard debe explicar Mi Fitness/Samsung Health y no afirmar que Arsen detecta su conexión.
- Backup anterior: un resumen con `session` legacy debe importarse sin aparecer en la UI nueva.

---

### Task 1: Contrato diario y lectura nativa

**Files:**
- Modify: `src/domains/health/types.ts`, `src/domains/health/native.ts`, `src/domains/health/services.ts`
- Modify: `android/app/src/main/kotlin/com/kumchovy/arsen/codex/health/HealthConnectManager.kt`
- Modify: `android/app/src/main/kotlin/com/kumchovy/arsen/codex/health/HealthConnectPlugin.kt`
- Modify: `android/app/src/main/kotlin/com/kumchovy/arsen/codex/health/HealthSummaryCalculator.kt`
- Test: `src/domains/health/services.test.ts`, `android/app/src/test/kotlin/com/kumchovy/arsen/codex/health/HealthSummaryCalculatorTest.kt`

**Interfaces:**
- Produces `HealthSummary { syncedAt, day }` for new writes and `readDayHealth({ dayStart, dayEnd })` across the Capacitor boundary.
- `getHealthAvailability` and `getHealthPermissions` remain available to the wizard.

- [ ] **Step 1: Write failing tests** for a day-only native call, daily persistence, no session range, and partial/empty metrics.
- [ ] **Step 2: Run focused TypeScript tests** and confirm failure caused by the old session/day contract.
- [ ] **Step 3: Implement the minimum day-only TypeScript contract and service**, deriving local midnight from `session.date` and preserving the last saved summary on native errors.
- [ ] **Step 4: Update Kotlin manager/plugin** to accept only `dayStart`/`dayEnd`, read records and aggregates once, paginate samples, and return one `day` payload.
- [ ] **Step 5: Run focused TypeScript and Kotlin tests** and confirm they pass.

### Task 2: Remove session presentation and update persistence projections

**Files:**
- Modify: `src/domains/health/components/HealthSummaryCard.tsx`, its test, `src/domains/health/components/HealthProgressCard.tsx`
- Modify: `src/domains/health/repository.ts`
- Modify: `src/domains/progress/repository.ts`, `src/domains/progress/pages/ProgressPage.tsx`, `src/domains/progress/pages/ProgressHistoryDatePage.tsx`
- Modify: `src/domains/workout/pages/WorkoutPage.tsx`, tests
- Modify: `src/shared/validation/arsenImportSchemas.ts`, `src/db/indexeddb.test.ts`
- Remove or stop importing: `src/domains/health/calculations.ts` and its tests if no production caller remains.

**Interfaces:**
- Consumers read only `session.health.day` and render “Resumen del día”.
- Legacy imported fields remain accepted but are ignored by projections and components.

- [ ] **Step 1: Write failing component/repository/backup tests** asserting one daily block, no “Sesión”, day-only progress points, and legacy import compatibility.
- [ ] **Step 2: Run focused tests and confirm the old two-window behavior fails the new assertions.**
- [ ] **Step 3: Implement the smallest day-only UI and repository projection**, including `Sin datos publicados todavía` for an empty successful read.
- [ ] **Step 4: Update schemas and fixtures** so new backups serialize day-only health while older session/day health remains valid.
- [ ] **Step 5: Run focused tests and then the TypeScript suite.**

### Task 3: Settings wizard for the complete connection chain

**Files:**
- Modify: `src/domains/health/services.ts`
- Modify: `src/domains/settings/pages/SettingsPage.tsx`, `src/domains/settings/pages/SettingsPage.test.tsx`
- Create if needed: `src/domains/health/components/HealthSetupWizard.tsx` and test
- Modify: `docs/integracion-smartwatch.md`

**Interfaces:**
- Wizard consumes availability, granted permissions, and activation actions from health services.
- It produces explicit recovery actions: install/update, open Health Connect, request permissions, and retry manufacturer synchronization.

- [ ] **Step 1: Write failing UI tests** for installed/unavailable/update-required states, permission step, and manufacturer-app guidance.
- [ ] **Step 2: Run the settings tests and confirm the old copy lacks the required wizard states.**
- [ ] **Step 3: Implement the inline wizard** with accessible headings, touch-sized actions, Spanish copy, and no claim that Arsen can detect the manufacturer app.
- [ ] **Step 4: Run focused Settings/UI tests and confirm they pass.**

### Task 4: Full verification and review pass

**Files:**
- Review all changed files and the updated design/plan.

- [ ] **Step 1: Run `pnpm test` and read the complete result.**
- [ ] **Step 2: Run `pnpm build` and read the complete result.**
- [ ] **Step 3: Run the Android unit test for `HealthSummaryCalculatorTest` and, if available, the debug APK build without installing it.**
- [ ] **Step 4: Run Impeccable `critique`, `polish`, `audit`, and `harden` passes for the Settings health surface; fix any Critical/Important findings with a failing test first.**
- [ ] **Step 5: Run the Impeccable detector once over changed UI targets and inspect the final diff/status without committing.**
