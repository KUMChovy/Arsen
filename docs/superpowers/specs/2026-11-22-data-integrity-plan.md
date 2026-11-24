# Plan de implementación: integridad de datos

> Ejecución: `executing-plans`, enteramente inline; TDD en cada cambio de comportamiento. No crear ramas, worktrees ni commits sin autorización independiente.

**Objetivo:** implementar la SPEC 01 preservando los datos locales y los flujos offline.

**Arquitectura:** mantener las tablas y límites de dominio existentes; añadir un contrato estricto y diagnóstico separado del importador actual, transacciones en los puntos de escritura, y un serializador consistente con recursos separados. No se conserva un puente para versiones de desarrollo antiguas.

**Tecnología:** TypeScript, Dexie 4, Zod 3, Vitest, fake-indexeddb.

**Diseño:** `docs/superpowers/specs/2026-11-22-data-integrity-design.md`. La SPEC 01 original es autoridad para el alcance y las 13 categorías de pruebas.

**Decisión posterior del propietario:** no hay instalaciones anteriores y no se requiere compatibilidad con esquemas antiguos. Retirar las migraciones anteriores y el puente sin consumidores, conservar los flujos de importación y exportación que aún utiliza la aplicación, y verificar una base nueva y su reapertura. No borrar automáticamente datos de desarrollo. El esquema actual es 8.

**Estado de ejecución (22-11-2026):** inicialización, validadores internos, diagnóstico, respaldo con recursos separados y correcciones transaccionales implementados y cubiertos por pruebas. Se retiraron las migraciones anteriores y el puente sin consumidores de acuerdo con la decisión del propietario. El esquema 8 agrega la revisión transaccional y conserva la huella para identificar contenido idéntico; sus límites están en `2026-11-22-persistence-audit.md`. La adopción exhaustiva del contrato en todas las escrituras y la auditoría completa de cálculos siguen pendientes. Las casillas siguientes conservan el plan original y no deben interpretarse por sí solas como resultados de verificación.

**Avance posterior:** reemplazo y fusión de respaldos validan el conjunto resultante en transacción; la importación y exportación de rutinas comprueban imágenes y relaciones. Se cubrieron concurrencia al mover o duplicar, rollback en edición histórica, intervalos de Health Connect, fechas de descarga, series sin carga y discos que se redondean a cero. La revisión visual del editor quedó sin verificar por indisponibilidad del navegador; la revisión independiente no se ejecutó porque el modo acordado es completamente inline.

**Revisión adicional de escrituras y cálculos (23-11-2026):** se inventariaron los puntos de mutación y los cálculos de entrenamiento, progreso y salud; se reforzaron notas, valores y órdenes, y la escritura revierte si falta la revisión local. Las pruebas automatizadas cubren las regresiones identificadas. La validación de transacciones en un navegador o WebView real sigue pendiente por indisponibilidad del entorno.

**Corrección posterior de traslado y exportación:** el editor mantiene su presentación; al guardar, mueve solo la serie y sus drops a una sesión de destino existente o nueva, sin reubicar la sesión de origen. La validación, creación del destino, traslado, edición y actualización de estados se efectúan en una transacción. Un fallo conserva todos los datos y deja abierto el editor. La exportación de progreso lee sus siete tablas en una transacción de lectura; las pruebas cubren destino, rollback y escritura concurrente.

**Cierre de revisión local:** añadir una tabla interna a Dexie con una revisión monotónica, incrementada en la transacción que escribe datos del contrato y excluida de los respaldos portables. Capturar su valor con cada instantánea. Probar escrituras independientes y agrupadas, rollback, lecturas, marcado de copia, concurrencia y reapertura; conservar la huella para detectar contenido idéntico.

## Restricciones globales

- No incorporar servicios remotos ni eliminar automáticamente datos; conservar los flujos de respaldo que utiliza la aplicación hasta SPEC 02.
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

**Archivos:** `src/shared/validation/dataContract.ts`, `src/shared/validation/entities.ts`, `src/shared/validation/dataset.ts`, `src/db/integrity.ts`, pruebas correspondientes y tipos de dominios.

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
- [x] Introducir revisión local de cambios confirmados, actualizada atómicamente en los puntos de escritura que alimentan el backup; probar rollback y ausencia de cambios por lecturas.
- [ ] Verificar round trip, integridad de componentes ausentes o alterados y preservación de datos existentes al rechazar importación.

## 6. Transición, catálogo y documentación

**Archivos:** `src/db/schema.ts`, tipos y servicios de catálogo, `src/db/indexeddb.test.ts`, documento de modelo.

- [x] Retirar las migraciones antiguas y el puente de conversión sin consumidores; mantener el esquema 7 completo y verificar inicialización, reapertura y respaldo.
- [ ] Preparar metadatos estables de catálogo sin sobrescribir personalizaciones y documentar sus límites.
- [ ] Documentar estructura final, campos, índices, reglas, responsabilidades, hallazgos, sincronización futura frente a datos exclusivamente locales y cualquier inconsistencia no resuelta.

## 7. Revisión y verificación final

- [ ] Revisar el diff completo y los flujos afectados con `requesting-code-review`, personalmente por la restricción inline; comprobar compatibilidad, validación, seguridad, accesibilidad y ausencia de archivos ajenos.
- [ ] Ejecutar `pnpm test --run` y `pnpm build`; inspeccionar los resultados, incluidos fallos previos y generación del service worker.
- [ ] Informar pruebas y riesgos; documentar que las bases anteriores de desarrollo podrían requerir restablecimiento manual.
