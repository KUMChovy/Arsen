# Documentación de integración de salud — Implementation Plan

> **For agentic workers:** Ejecutar inline, sin subagentes, commits ni operaciones GitHub. Los pasos usan casillas para seguimiento.

**Goal:** Explicar en español la integración de Health Connect, su implementación Kotlin y el consumo desde React, con enlaces directos a los archivos clave.

**Architecture:** La documentación seguirá el flujo real `reloj → app del fabricante → Health Connect → plugin Capacitor/Kotlin → servicios TypeScript → componentes React → Dexie`. Los comentarios se limitarán a las fronteras y decisiones que no son obvias por el código.

**Tech Stack:** React 19, TypeScript, Vite, Capacitor, Kotlin, AndroidX Health Connect Client, Dexie e IndexedDB.

**Spec:** `docs/integracion-smartwatch.md` y la implementación existente en `src/domains/health` y `android/app/src/main/kotlin/com/kumchovy/arsen/codex/health`.

## Global Constraints

- La integración es opcional y permanece apagada por defecto.
- Arsen no se conecta al reloj por Bluetooth, no escribe en Health Connect y no sincroniza en segundo plano.
- Los permisos son parciales: ausencia de permiso o de registros se representa como `null`, nunca como cero.
- No se modificará el comportamiento de la aplicación ni el modelo de persistencia.
- No se ejecutarán commits, ramas, pushes ni operaciones de GitHub.

## Review Focus

- La documentación debe distinguir el origen de datos del reloj y la responsabilidad de Arsen.
- El flujo React/Kotlin debe coincidir con los nombres y rutas reales del plugin.
- Las ventanas diaria, de sesión y de ejercicio deben explicar sus límites y su relación con las series registradas.
- Las limitaciones visibles en Ajustes y Entreno deben quedar reflejadas para una presentación.

### Task 1: Redactar la documentación

**Files:**
- Modify: `docs/integracion-smartwatch.md`

- [ ] Reorganizar la explicación con los apartados `Introducción`, `Metodología`, `Desarrollo`, `Códigos explicados` y `Conclusión`.
- [ ] Incluir el flujo de datos, permisos, persistencia, pantallas, limitaciones y enlaces de código.

### Task 2: Comentar el código clave

**Files:**
- Modify: `src/domains/health/native.ts`
- Modify: `src/domains/health/calculations.ts`
- Modify: `src/domains/health/services.ts`
- Modify: `src/domains/health/repository.ts`
- Modify: `src/domains/health/components/HealthSetupWizard.tsx`
- Modify: `src/domains/health/components/HealthSummaryCard.tsx`
- Modify: `src/domains/health/components/HealthProgressCard.tsx`
- Modify: `android/app/src/main/kotlin/com/kumchovy/arsen/codex/health/HealthConnectManager.kt`
- Modify: `android/app/src/main/kotlin/com/kumchovy/arsen/codex/health/HealthConnectPlugin.kt`

- [ ] Añadir comentarios breves y orientados al propósito, sin cambiar nombres, tipos ni lógica.

### Task 3: Verificar

**Files:**
- None.

- [ ] Ejecutar la suite TypeScript.
- [ ] Ejecutar el build web para comprobar tipos y empaquetado.
- [ ] Revisar el diff y confirmar que no se modificaron archivos ajenos al alcance.
