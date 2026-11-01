# Salud por ejercicio y carrusel de entrenamiento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Calcular y mostrar salud diaria, de sesión y por ejercicio con una tarjeta compacta/expandida y navegación táctil.

**Architecture:** La capa de cálculo resolverá ventanas con las series principales. El servicio enviará día, sesión y ejercicios al plugin Health Connect; la respuesta se guardará en `WorkoutSession.health`. Componentes compartidos renderizarán el carrusel y Progreso consumirá los datos derivados desde IndexedDB.

**Tech Stack:** React, TypeScript, Vitest, Dexie, Capacitor, Kotlin Health Connect.

**Spec:** `docs/superpowers/specs/2026-11-01-health-exercise-stats-carousel-design.md`

## Global Constraints

- No se crea una tabla Dexie ni se cambia el schema 7.
- Los valores no disponibles permanecen como `null` y se muestran como `—`.
- La integración solo consulta Health Connect cuando está activada y el usuario sincroniza.
- El paquete Android existente se conserva.

## Review Focus

- Un ejercicio con una sola serie no debe producir un intervalo invertido o vacío.
- Una sesión abierta debe terminar su ventana de lectura en la hora de sincronización.
- Las sesiones legacy sin salud deben seguir cargando y mostrando el resumen diario disponible.
- El carrusel debe funcionar con botones, teclado y gesto táctil sin impedir el scroll vertical.
- Health Connect debe recibir únicamente rangos válidos y mantener permisos parciales como valores nulos.

---

### Task 1: Ventanas y contrato de salud

**Files:**
- Modify: `src/domains/health/types.ts`
- Modify: `src/domains/health/calculations.ts`
- Test: `src/domains/health/calculations.test.ts`

- [ ] Add failing tests for session and per-exercise windows.
- [ ] Implement `resolveHealthWindows` and the exercise summary contract.
- [ ] Run the focused calculation tests, then the full TypeScript suite.

### Task 2: Lectura nativa y persistencia

**Files:**
- Modify: `src/domains/health/native.ts`
- Modify: `src/domains/health/services.ts`
- Modify: `android/app/src/main/kotlin/com/kumchovy/arsen/codex/health/HealthConnectPlugin.kt`
- Modify: `android/app/src/main/kotlin/com/kumchovy/arsen/codex/health/HealthConnectManager.kt`
- Test: `src/domains/health/services.test.ts`

- [ ] Add failing service tests for day, session and exercise range requests.
- [ ] Extend the native contract and Kotlin manager to read each requested window.
- [ ] Persist `session` and `exercises` while keeping legacy compatibility.
- [ ] Run focused service tests and Android unit tests.

### Task 3: Carrusel de Entreno

**Files:**
- Modify: `src/domains/health/components/HealthSummaryCard.tsx`
- Modify: `src/domains/health/components/HealthSummaryCard.test.tsx`
- Modify: `src/domains/workout/pages/WorkoutPage.tsx`
- Modify: `src/domains/workout/pages/WorkoutPage.test.tsx`

- [ ] Add failing component tests for the three states, compact/expanded mode and swipe controls.
- [ ] Implement the accessible touch carousel and move it below Calentamiento.
- [ ] Add the real-time/third-party/30-minute freshness note.

### Task 4: Progreso e Historial

**Files:**
- Modify: `src/domains/health/repository.ts`
- Modify: `src/domains/health/components/HealthProgressCard.tsx`
- Modify: `src/domains/progress/pages/ProgressPage.tsx`
- Modify: `src/domains/progress/pages/ProgressHistoryDatePage.tsx`
- Test: `src/domains/health/repository.test.ts`, `src/domains/progress/pages/ProgressPage.test.tsx`

- [ ] Add failing repository/UI tests for exercise duration and metrics below Última sesión.
- [ ] Project the latest exercise health data for the selected exercise.
- [ ] Render it in Progreso and the expanded history detail.

### Task 5: Verification and APK assets

**Files:**
- Modify: `docs/integracion-smartwatch.md`

- [ ] Update the integration map and data limitations.
- [ ] Run `pnpm test`, `pnpm build`, Android unit tests and `pnpm cap:build`.
- [ ] Verify the generated APK contains the new hashed web assets.
