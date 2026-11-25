# Plan de refinamiento de acceso y catálogo

**Objetivo:** acceso móvil a pantalla completa, respaldos comprensibles y catálogo con edición modal y filtros completos.

**Diseño:** `docs/superpowers/specs/2026-11-25-acceso-catalogo-refinamiento-diseno.md`.

1. Probar y adaptar `AccessGate.tsx` y `AccountPage.tsx`, manteniendo navegación y autenticación.
2. Agrupar acciones y enfocar resultados en `AccountPage.tsx`; probar activación, versiones y restauración.
3. Añadir filtro validado de músculo a `server/catalog/adminDrafts.ts` y `src/admin/api.ts`, con pruebas de paginación, valores inválidos y autorización.
4. Convertir el editor de `AdminApp.tsx` en diálogo accesible y reorganizar lista; probar apertura, edición, cierre, guardado y filtros.
5. Revisar accesibilidad, ejecutar pruebas, compilaciones web y Android, y documentar limitaciones de dispositivo y despliegue.
