# Registro directo — plan de implementación

**Objetivo:** permitir activación por registro directo preservando seguridad y acceso offline.

**Diseño:** `docs/superpowers/specs/2026-11-25-registro-directo-design.md`. Trabajo inline; no desplegar ni modificar servicios externos sin autorización.

1. En `server/auth/activationHandler.test.ts`, probar con PGlite la creación idempotente del perfil para una identidad autenticada y correo verificado sin invitación, el rechazo de identidades inválidas o sin correo verificado y la preservación del rol administrador. Ejecutar para observar el fallo.
2. En `server/auth/activationHandler.ts`, crear el perfil usando el usuario verificado por el servidor y `ON CONFLICT DO NOTHING`; no tomar rol o identidad del cuerpo. Ejecutar la prueba y las pruebas de autenticación pertinentes.
3. En `src/domains/account/AccessGate.test.tsx`, comprobar el texto y la cancelación del registro directo. Actualizar textos correspondientes en `AccessGate.tsx` y `pages/AccountPage.tsx`, sin cambiar diseño ni accesibilidad. Ejecutar las pruebas de interfaz.
4. Revisar rutas de copia, errores y estado de la cuenta existente; ejecutar `pnpm test --run`, `pnpm build`, `pnpm server:bundle` y pruebas Android si corresponde. Documentar pruebas reales y despliegue pendientes.
