# SPEC 02 Continuation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline. Do not create branches, commits or deploy without explicit approval.

**Goal:** Complete the initial Android access, global catalog distribution and administrative workflows without compromising offline personal data.

**Architecture:** Extend the existing account bridge and guarded local-first app shell; reuse the existing restore preview. Extend the current versioned catalog and administrator-only API rather than introducing parallel stores. Keep historical image references recoverable independently of publication state.

**Tech Stack:** React, TypeScript, Capacitor, Clerk, Dexie, PostgreSQL, Vercel Blob, Vitest.

**Spec:** docs/superpowers/specs/2026-11-24-spec-02-continuation-design.md and the original SPEC 02 architecture.

## Global Constraints

- Keep training usable offline and retain existing local records, historical snapshots and recipes.
- Registration remains invitation-only; all administrative actions check server permissions.
- Never activate external services without applicable authorization or disclose secrets.
- Preserve recent backup work, local revision checks and explicit restore confirmation.

## Review Focus

- Guest restart offline and unavailable linked session must not block local training.
- Changed account, pending backup or changed local revision must prevent restoration.
- Interrupted catalog or image downloads must preserve the previous valid catalog.
- Archived historical images must remain recoverable without exposing private objects.
- Non-admin requests and malformed pagination or search input must be rejected.

## Tasks

1. Correct product platform context using the project design workflow. Verify current product facts against source.
2. Add tested access selection and native invitation registration; persist guest access offline and offer safe restore after login. Verify failure, cancellation and existing-data paths.
3. Verify initial catalog, version sync and image references; implement and test recovery of archived image assets and invalid-update rollback.
4. Add tested server-authorized audit and catalog search/filter operations; complete the responsive admin UI with real data.
5. Verify development configuration and migration readiness without activating services. Run web tests, builds and Android checks; review the entire diff and document manual device and deployment checks.

## Estado de ejecución

- Existe un inventario local verificable del catálogo inicial en `generated/arsen-catalog-seed-inventory.json`, generado con `node scripts/prepare-catalog-seed.mjs`. Contiene 74 identificadores y metadatos de imagen; el panel permite seleccionar ese inventario y los PNG de `src/assets/ejercicios/`, validar los bytes y publicar los ejercicios ausentes mediante las operaciones administrativas. El panel conserva los ejercicios existentes y puede reanudar un borrador idéntico tras una interrupción.
- La migración 007 se aplicó en la base de desarrollo con autorización explícita; se verificó la tabla y que el catálogo seguía en versión 0, sin ejercicios. La carga inicial, la verificación de las imágenes en el almacén y la habilitación de rutas en desarrollo requieren autorización antes de actuar sobre servicios externos. No asumir que los apuntes históricos de despliegue describen su estado actual.
- Tras autorización adicional se habilitaron las rutas administrativas privadas en Preview, se desplegó el código y se actualizó el alias de desarrollo. Las rutas privadas devolvieron 401 sin sesión y 200 con la sesión administrativa de desarrollo.
- La carga inicial autorizada finalizó con 74 ejercicios publicados y versión 74. Se compararon los 74 registros con el inventario y se descargaron las 74 imágenes para verificar origen, tipo, tamaño y SHA-256; no hubo discrepancias. La lectura pública se activó después con autorización específica; el alias entregó el contrato válido, la versión ligera, una respuesta condicional 304 y CORS para Android.
- La prueba optativa `RUN_CATALOG_PUBLIC_LIVE_CHECK=1` descargó el catálogo real en IndexedDB simulado y comprobó que la copia se conserva sin conexión. No utiliza la base personal del dispositivo.
- La variable de compilación `VITE_CATALOG_API_ORIGIN` se preparó en el entorno local con el origen HTTPS de desarrollo existente. Las rutas públicas siguen necesitando activación y verificación antes de que la sincronización funcione.
- La consulta administrativa de auditoría muestra los 100 eventos más recientes. Las comprobaciones reales de Clerk, restauración, catálogo y presentación en teléfono permanecen pendientes hasta disponer de los servicios y un dispositivo.
