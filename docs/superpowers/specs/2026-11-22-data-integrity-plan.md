# Plan de implementación: integridad de datos

> Ejecución: `executing-plans`, enteramente inline; TDD en cada cambio de comportamiento. No crear ramas, worktrees ni commits sin autorización independiente.

**Objetivo:** implementar la SPEC 01 preservando los datos locales y los flujos offline.

**Arquitectura:** mantener las tablas y límites de dominio existentes; añadir un contrato estricto y diagnóstico separado del importador histórico, transacciones en los puntos de escritura, y un serializador consistente con recursos separados. La transición conserva los puentes necesarios hasta poder demostrar su retirada segura.

**Tecnología:** TypeScript, Dexie 4, Zod 3, Vitest, fake-indexeddb.

**Diseño:** `docs/superpowers/specs/2026-11-22-data-integrity-design.md`. La SPEC 01 original es autoridad para el alcance y las 13 categorías de pruebas.

**Estado de ejecución (22-11-2026):** inicialización, validadores internos, diagnóstico, respaldo con recursos separados, preparación de transición desde un respaldo completo Dexie 7 y correcciones transaccionales implementados y cubiertos por pruebas. La detección de cambios usa comparación de huellas bajo demanda en vez del contador previsto; sus costes y límites están en `2026-11-22-persistence-audit.md`. La transición de instalaciones reales, el retiro seguro de compatibilidad antigua, la adopción exhaustiva del contrato en todas las escrituras y la auditoría completa de cálculos siguen pendientes. Las casillas siguientes conservan el plan original y no deben interpretarse por sí solas como resultados de verificación.

## Restricciones globales

- No incorporar servicios remotos ni eliminar automáticamente datos; conservar respaldos históricos y migraciones cuando no exista evidencia suficiente para retirarlos.
- Usar kg en persistencia, IDs estables, instantáneas históricas y versiones independientes de Dexie, contrato y catálogo.
- Una base parcial no recibe datos demo; una restauración incompatible no modifica datos.
- Cada tarea empieza con una prueba que falle por la conducta ausente y termina ejecutando la prueba específica; ejecutar la suite completa y build antes de cerrar.

## Riesgos prioritarios para revisión

1. Sesión histórica con rutina o ejercicio eliminado: sigue visible en progreso y no se clasifica como huérfana sin contexto.
2. Dos escrituras concurrentes o fallo a mitad de transacción: no hay duplicados prohibidos ni escritura parcial.
3. Backup sin recurso requerido, con hash incorrecto o fecha inválida: se rechaza sin reemplazar datos.
4. Base parcialmente poblada y sin ajustes: no se inserta demo ni se borran registros.
5. Resumen Health Connect con intervalos incorrectos o referencias obsoletas: diagnóstico útil y conservación no destructiva.

## 1. Inventario y línea base

**Archivos:** `src/db/schema.ts`, `src/domains/{routine,workout,settings,health}/types.ts`, repositorios, servicios, validadores y `docs/superpowers/specs/2026-11-22-data-model.md`.

- [ ] Ejecutar `pnpm test --run` y `pnpm build`; registrar fallos de línea base sin atribuirlos a cambios posteriores.
- [ ] Inventariar para cada tabla campos, índices, lecturas, escrituras, borrados, relaciones y datos de respaldo; registrar almacenamiento de interfaz y Health Connect.
- [ ] Revisar pruebas y reglas existentes antes de fijar límites y unicidad de sesiones; identificar diferencias entre datos históricos legítimos e inconsistencias.

## 2. Inicialización segura

**Archivos:** `src/db/seedDemoRoutine.ts`, `src/db/indexeddb.test.ts`, `src/db/schema.ts`.

- [ ] Añadir pruebas: una base vacía recibe demo con `CURRENT_SCHEMA_VERSION`; una base con datos y sin ajustes no recibe demo ni pierde sus filas; dos inicializaciones simultáneas no duplican datos.
- [ ] Ejecutar `pnpm test --run src/db/indexeddb.test.ts` y observar las fallas esperadas.
- [ ] Decidir y sembrar dentro de una única transacción sobre todas las tablas persistentes; usar la versión actual de Dexie y señalar la base parcial sin repararla silenciosamente.
- [ ] Repetir las pruebas y verificar que pasan.

## 3. Contrato y diagnóstico

**Archivos:** `src/shared/validation/arsenImportSchemas.ts`, nuevos `src/db/dataContract.ts`, `src/db/integrity.ts`, pruebas correspondientes y tipos de dominios.

- [ ] Escribir pruebas de cada entidad para fechas reales, números finitos y rangos de producto, enum, nulos, omisiones y relaciones; comprobar que registros históricos desvinculados con instantáneas no se rechazan como hijos huérfanos.
- [ ] Ejecutar pruebas y observar rechazo ausente en el contrato nuevo.
- [ ] Definir `DATA_CONTRACT_VERSION = 1`, esquemas estrictos independientes de las transformaciones de importación antigua y `diagnoseDataset` de solo lectura con gravedad, entidad, ID y solución propuesta. Cubrir referencias, duplicados, estados, recursos, Health Connect y versiones.
- [ ] Verificar datos válidos, diagnósticos y ausencia de mutaciones con Vitest.

## 4. Escrituras e historial

**Archivos:** `src/domains/routine/services.ts`, `src/domains/workout/services.ts`, `src/domains/health/services.ts`, `src/domains/settings/services.ts`, pruebas de servicios e integración.

- [ ] Reproducir con tests la creación de hijos con padres inválidos, duplicación con día ausente, creación concurrente de sesiones equivalentes, rollback y preservación de instantáneas al editar/eliminar.
- [ ] Observar cada fallo antes de implementar; mover las comprobaciones y lecturas relevantes dentro de las transacciones de escritura y rechazar entradas inválidas sin normalización silenciosa.
- [ ] Validar series, drop sets, estados, fechas y resúmenes de salud en los límites de escritura, conservando el comportamiento permitido y los IDs existentes.
- [ ] Ejecutar pruebas de dominio e integración; añadir pruebas de edición histórica y recálculo de progreso, así como concurrencia y rollback.

## 5. Respaldo determinista y recursos

**Archivos:** nuevos `src/db/backup.ts` y pruebas; `src/domains/settings/services.ts`, `src/domains/routine/services.ts`, `src/db/schema.ts`, validadores.

- [ ] Probar lectura consistente, orden determinista, verificación de integridad, rechazo transaccional de datos incompatibles, reconstrucción equivalente incluyendo recursos y reapertura de IndexedDB.
- [ ] Implementar serialización versionada de datos de usuario, salud separada lógicamente y contenido de recursos fuera del JSON; no excluir copias personalizadas del catálogo. No sustituir la exportación histórica.
- [ ] Introducir revisión local de cambios confirmados, actualizada atómicamente en todos los puntos de escritura que alimentan el backup; probar rollback y ausencia de cambios por lecturas.
- [ ] Verificar round trip, integridad de componentes ausentes o alterados y preservación de datos existentes al rechazar importación.

## 6. Transición, catálogo y documentación

**Archivos:** `src/db/schema.ts`, tipos y servicios de catálogo, `src/db/indexeddb.test.ts`, documento de modelo.

- [ ] Probar las rutas de bases representativas existentes con snapshots, recursos y salud; comprobar que el puente conserva datos y aborta al no poder convertirlos.
- [ ] Agregar solamente migraciones necesarias y preparar metadatos estables de catálogo sin sobrescribir personalizaciones. Mantener puentes históricos hasta haber registrado versiones reales, respaldo recuperable y conversión comprobada; documentar las condiciones de retiro.
- [ ] Documentar estructura final, campos, índices, reglas, responsabilidades, hallazgos, sincronización futura frente a datos exclusivamente locales y cualquier inconsistencia no resuelta.

## 7. Revisión y verificación final

- [ ] Revisar el diff completo y los flujos afectados con `requesting-code-review`, personalmente por la restricción inline; comprobar compatibilidad, validación, seguridad, accesibilidad y ausencia de archivos ajenos.
- [ ] Ejecutar `pnpm test --run` y `pnpm build`; inspeccionar los resultados, incluidos fallos previos y generación del service worker.
- [ ] Informar pruebas, riesgos y límites reales de la transición; no declarar migraciones reales verificadas sin acceso a esas instalaciones.
