# Plan: contrato de metadatos de respaldos remotos

> Ejecución completamente inline con TDD. No se crean ramas ni commits.

**Objetivo:** establecer la validación compartida de los metadatos de una instantánea antes de agregar transporte o persistencia remota.

**Arquitectura:** Zod define un contrato estricto sin credenciales ni datos personales; el servidor seguirá siendo responsable de autenticar, autorizar y verificar bytes, propiedad y hash. Las revisiones se representan como enteros seguros; la revisión base remota permite detectar divergencia.

**Tecnología:** TypeScript, Zod, Vitest. Diseño: `docs/superpowers/specs/2026-11-23-spec-02-architecture-design.md`.

**Restricciones:** modo sin cuenta y datos locales existentes intactos; no incluir resúmenes de salud sin consentimiento; no confiar en valores enviados para identificar al propietario; no conectar ni desplegar servicios en esta tarea.

**Riesgos a cubrir:** datos desconocidos o de identidad rechazados; tamaños y revisiones fuera del rango seguro rechazados; hashes inválidos rechazados; solicitud de salud con consentimiento falso rechazada; revisión base remota ausente representada explícitamente.

### Tarea 1: validar metadatos de preparación

**Archivos:** crear `src/shared/validation/remoteBackup.ts` y `src/shared/validation/remoteBackup.test.ts`.

**Interfaz:** exportar `prepareRemoteBackupSchema`, un objeto estricto con `id` UUID, `contractVersion` entero positivo seguro, `localRevision` entero no negativo seguro, `baseBackupId` UUID o null, `manifestSha256` hexadecimal minúsculo de 64 caracteres, `sizeBytes` entero positivo seguro, e `includesHealth` y `healthConsent` booleanos. Si incluye salud, exige consentimiento verdadero.

- [ ] Escribir pruebas que acepten metadatos válidos y rechacen campos desconocidos, IDs inválidos, enteros inseguros, tamaños cero, hashes inválidos y salud sin consentimiento.
- [ ] Ejecutar `node node_modules/vitest/vitest.mjs run src/shared/validation/remoteBackup.test.ts` y comprobar el fallo por contrato ausente.
- [ ] Implementar `prepareRemoteBackupSchema` con Zod y validación estricta.
- [ ] Repetir la prueba específica, ejecutar la suite completa y verificar tipos.

Este contrato es una pieza interna, no implementa cuentas, transporte, confirmación, autenticación ni respaldo remoto. Las fases restantes de SPEC 02 requieren planes e integración adicionales antes de considerarse completas.
