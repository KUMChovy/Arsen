# Acceso, respaldo y administración: plan de implementación

> Para esta ejecución se usa `executing-plans` en línea; no se crean ramas ni commits sin autorización.

**Objetivo:** clarificar el acceso y la protección de datos en Android y facilitar la gestión del catálogo y las cuentas.

**Arquitectura:** conservar los servicios de cuenta, Dexie y restauración existentes; separar las vistas de acceso y administración de cuenta. Mantener la autorización administrativa en servidor y obtener identidad mínima desde Clerk solo tras comprobar el rol.

**Tecnologías:** React, TypeScript, Capacitor, Kotlin, WorkManager, Clerk, SweetAlert y Vitest.

**Diseño:** `docs/superpowers/specs/2026-11-25-acceso-respaldo-admin-diseno.md`.

## Restricciones

- Mantener el entrenamiento y los datos locales disponibles sin conexión; respetar las tres opciones de acceso y el registro por invitación.
- La restauración conserva las verificaciones existentes y exige confirmación expresa.
- Las notificaciones dependen del permiso de Android; respaldo programado y copia confirmada son estados distintos.
- No exponer secretos ni datos personales en logs; no desplegar ni modificar servicios externos sin autorización.

## Riesgos a probar

- Fallo o cancelación de WorkManager no debe presentarse como activación exitosa ni borrar copias pendientes.
- Cambios de cuenta y denegación del permiso no deben bloquear el uso local ni restaurar datos.
- Una restauración cancelada o fallida no debe modificar IndexedDB.
- Respuestas incompletas, fallos o nombres ausentes de Clerk deben conservar el control de rol y una alternativa segura.
- Respuestas tardías de búsqueda y vistas previas deben descartarse al cambiar filtros, sesión o archivo.

## Tareas verificables

1. **Programación confiable:** `automaticBackup.ts`, `BackupWorker.kt`, `ArsenBackupPlugin.kt` y sus pruebas. Reproducir una programación fallida; esperar la operación de WorkManager y evitar persistir una activación falsa. Verificar reintento, preservación de datos y cancelación.
2. **Acceso y cuenta:** `AccessGate.tsx`, `AccountPage.tsx`, componentes y pruebas de cuenta. Incorporar `tkh.png`, separar acceso de gestión y solicitar permiso de notificación después del acceso. Dar protagonismo a la confirmación de restauración y mostrar estados reales de respaldo, con pruebas de aceptación, rechazo y fallo.
3. **Identidad administrativa:** `server/auth/adminAccounts.ts`, `clerkSession.ts`, `adminVercel.ts`, `src/admin/api.ts` y pruebas. Recuperar identidad mínima después de autorizar; validar, limitar y manejar falla de Clerk sin exponer datos privados. Probar permisos y paginación.
4. **Panel:** `src/admin/AdminApp.tsx`, `admin/styles.css` y pruebas. Implementar búsqueda/filtros dinámicos sin respuestas obsoletas, vista previa y confirmaciones SweetAlert, y mejorar resumen y editor sin inventar datos ni cambiar operaciones.
5. **Revisión y verificación:** inspeccionar el diff completo, probar las rutas afectadas y ejecutar la batería y builds web/Android. Verificar accesibilidad y tamaños visuales disponibles; documentar pruebas que requieran teléfono y solicitar autorización antes de cualquier despliegue.
