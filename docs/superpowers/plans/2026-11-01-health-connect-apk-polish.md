# Health Connect y APK ARSEN — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. No commits are allowed for this task.

**Goal:** Mover la detección al botón de activación, hacer más visible la sección de salud, endurecer la lectura diaria y etiquetar el APK como ARSEN v2.

**Architecture:** TypeScript conserva el servicio como frontera de activación y el plugin Kotlin como frontera de lectura. Ajustes recibe solo el resultado de la activación; el lector nativo consulta cada métrica con su estrategia oficial y reporta una lectura vacía de forma explicable.

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest, Capacitor, Kotlin, AndroidX Health Connect Client 1.1.0, Gradle.

**Spec:** `docs/superpowers/specs/2026-11-01-health-connect-apk-polish-design.md`

## Global Constraints

- No commits, ramas, worktrees, pushes ni cambios destructivos.
- La integración sigue opcional y apagada por defecto.
- El resumen continúa siendo diario; no se recupera la ventana de sesión.
- La salida actual conserva `com.kumchovy.arsen.codex`; cada nueva salida debe cambiar `arsenPackageSuffix` y `arsenVersionCode` para actualizar la instalación existente.
- Los datos faltantes siguen siendo `null`, nunca cero.

## Review Focus

- Health Connect ausente o pendiente de actualización: el botón de activación debe abrir Play Store y no activar la integración.
- Permisos parciales: las métricas autorizadas deben seguir llegando aunque otra consulta no tenga permiso.
- Agregados vacíos: pasos/calorías deben usar el acceso tipado de `AggregateResult` y no perderse por una clave incorrecta.
- Lectura vacía: la interfaz debe informar que la consulta terminó sin registros y pedir sincronizar la app del fabricante.
- APK: el label visible, icono y nombre de salida debug deben corresponder a ARSEN v2 sin romper el namespace Kotlin existente.

---

### Task 1: Activación única y tarjeta de salud

**Files:**
- Modify: `src/domains/settings/pages/SettingsPage.tsx`, `src/domains/settings/pages/SettingsPage.test.tsx`
- Modify: `src/domains/health/components/HealthSetupWizard.tsx`, `src/domains/health/components/HealthSetupWizard.test.tsx`
- Modify: `src/domains/workout/pages/WorkoutPage.tsx`, `src/domains/workout/pages/WorkoutPage.test.tsx`

**Interfaces:**
- `enableHealthIntegration()` sigue siendo la única acción que detecta disponibilidad y pide permisos.
- El wizard recibe el estado resultante y muestra una acción primaria única; no recibe un botón separado de instalación.

- [x] **Step 1: Escribir pruebas rojas** para que Ajustes no consulte disponibilidad al montar, el botón `Activar integración` dispare la detección, el error de proveedor abra instalación y la tarjeta tipo Deload muestre una alerta cuando la lectura termina sin datos.
- [x] **Step 2: Ejecutar los tests enfocados y observar el fallo** contra el wizard y el flujo actual.
- [x] **Step 3: Implementar el flujo y la tarjeta** con cabecera diferenciada, estados de instalación/actualización como información y una acción primaria `Activar integración`.
- [x] **Step 4: Ejecutar los tests enfocados** y confirmar que pasan.

### Task 2: Lectura nativa resistente

**Files:**
- Modify: `android/app/src/main/kotlin/com/kumchovy/arsen/codex/health/HealthConnectManager.kt`
- Modify: `android/app/src/main/kotlin/com/kumchovy/arsen/codex/health/HealthConnectPlugin.kt`
- Modify: `android/app/src/test/kotlin/com/kumchovy/arsen/codex/health/HealthSummaryCalculatorTest.kt` if the stable contract needs coverage

**Interfaces:**
- `readDay` mantiene `HealthReadResult.day` y sus métricas existentes.
- Los agregados usan `result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]` y `result[StepsRecord.COUNT_TOTAL]`.

- [x] **Step 1: Añadir una prueba o comprobación mínima** que pinte la lectura vacía y mantenga valores `null` sin inventar datos.
- [x] **Step 2: Ejecutar la prueba antes del cambio** y documentar el estado actual.
- [x] **Step 3: Corregir la lectura nativa** para extraer agregados tipados, aislar fallas por métrica y registrar solo conteos/estado técnico sin datos sensibles.
- [x] **Step 4: Ejecutar la prueba unitaria y compilar el APK debug**.

### Task 3: Identidad y versión del APK

**Files:**
- Modify: `android/app/build.gradle`
- Modify: `android/app/src/main/AndroidManifest.xml`
- Modify: `android/app/src/main/res/values/strings.xml`
- Create: `android/app/src/main/res/drawable/arsen_logo.png` copied from `ARsen logo.png`

- [x] **Step 1: Actualizar la prueba/configuración** de label, versión `1.0.0-v2`, código `1` y nombre de salida `Arsen-v2-debug.apk`.
- [x] **Step 2: Implementar el label, icono y nombre de APK** con `applicationId` versionado y namespace Kotlin estable.
- [x] **Step 3: Ejecutar `assembleDebug` y verificar la ruta/nombre generado**.

### Task 4: Verificación final

- [x] **Step 1: Ejecutar `pnpm test` completo.**
- [x] **Step 2: Ejecutar `pnpm build`.**
- [x] **Step 3: Ejecutar `testDebugUnitTest` y `assembleDebug`.**
- [x] **Step 4: Ejecutar Impeccable `critique`, `polish`, `audit`, `harden` de forma manual según sus referencias y el detector una vez sobre los objetivos UI modificados.**
- [x] **Step 5: Revisar diff/status y confirmar que no se creó commit.**
