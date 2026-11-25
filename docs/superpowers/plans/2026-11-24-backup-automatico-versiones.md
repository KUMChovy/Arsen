# Plan: respaldos automáticos y versiones

> Ejecución inline mediante `executing-plans`; no crear commits ni ramas.

**Objetivo:** preparar cambios personales de forma consolidada y permitir envíos periódicos y restauración segura de versiones confirmadas.

**Diseño:** `docs/superpowers/specs/2026-11-24-backup-automatico-versiones-design.md` y SPEC 02 con su anexo.

**Restricciones:** conservar consentimiento, aislamiento de cuentas, integridad y datos existentes; nunca exponer tokens al WebView; ninguna prueba puede tocar respaldos reales.

## Riesgos que deben cubrir las pruebas

- Confirmación de una copia anterior durante una preparación nueva o un cierre inesperado.
- Cambio de sesión, fallo de red o conflicto remoto durante cualquier fase.
- Reinicio con copia preparada y revisión Dexie posterior aún no preparada.
- Restauración histórica con versión eliminada, datos locales cambiados o descarga corrupta.
- Desactivación de salud y ausencia de envíos después de cada modificación.

## Tareas

1. **Estado nativo durable.** En `android/app/src/main/kotlin/com/kumchovy/arsen/codex/backup/` extender el almacenamiento cifrado para distinguir instantánea en curso, preparada y confirmación por cuenta. Probar escrituras atómicas, confirmaciones idempotentes, concurrencia, recuperación tras interrupción y aislamiento; conservar el formato existente mediante migración segura. Aplicar TDD y ejecutar las pruebas JVM correspondientes.
2. **Programación y transporte.** En `BackupWorker.kt`, `BackupWorkerEngine.kt`, `PendingBackupSubmission.kt` y sus pruebas, mantener el sobre en curso estable, reconocer solo la revisión confirmada y detener divergencias. Programar comprobación única cada 72 horas con conectividad y retroceso; el envío manual puede solicitarse inmediatamente. Probar reintentos, conflicto, ausencia de red, cambio de cuenta y ninguna copia pendiente.
3. **Preparación local.** En `src/domains/account/`, `src/app/providers.tsx` y el puente nativo, guardar autorización y base por cuenta; observar la revisión Dexie y consolidar la preparación sin enviar por cada cambio. Preparar cuando vuelva a estar disponible el WebView; no marcar confirmada una revisión no reconocida por servidor. Probar cambios concurrentes, cierre anterior a preparación, salud excluida y cuenta distinta.
4. **Versiones y restauración.** Extender el cliente HTTPS y `ArsenBackupPlugin.kt` para listar y consultar metadatos confirmados con sesión nativa; ampliar `native.ts` y `restoreService.ts` para seleccionar una versión, comprobar cuenta y disponibilidad antes de aplicar, y conservar la validación transaccional existente. Probar selección histórica, versión retirada, cuenta cambiada, revisión local cambiada y corrupción.
5. **Interfaz.** En `AccountPage.tsx` mostrar cuenta, estado local/preparado/confirmado, fecha, pendientes, errores, frecuencia y estimación no garantizada. Añadir activación explícita, lista de versiones y confirmación de restauración. Probar estados vacíos, fallo, conflicto y confirmación sin datos simulados. Ejecutar shape, critique, polish, audit y harden de Impeccable y revisar la interfaz móvil.
6. **Cierre.** Revisar el diff completo y ejecutar `pnpm test`, `pnpm build` y las pruebas JVM y compilación Android disponibles sin servicios reales. Documentar limitaciones y pruebas que requieren dispositivo físico. No crear commits ni desplegar.
