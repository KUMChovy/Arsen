# SPEC 01: consolidación segura de datos

## Propósito y límites

Consolidar la persistencia offline, sus invariantes y el contrato de respaldo sin perder datos ni alterar innecesariamente los flujos existentes. No se incorporan servicios online, autenticación ni muestras originales de Health Connect. La SPEC 01 proporcionada por el usuario define los entregables y pruebas de aceptación; este documento concreta el enfoque para el código existente.

## Estado observado

- Dexie declara 13 tablas y versiones 1 a 7. La inicialización comprueba solamente `settings/app` y crea ajustes con `schemaVersion: 5`, aunque la versión actual es 7.
- Los respaldos actuales incluyen todas las tablas, imágenes Data URL y resúmenes de salud; el esquema de importación admite valores omitidos y realiza conversiones. La importación escribe dentro de una transacción.
- Los registros históricos contienen instantáneas de ejercicio; al renombrar o eliminar rutinas y días se intentan conservar sus nombres en sesiones. Progreso usa las instantáneas y admite nombres de entidades eliminadas.
- El catálogo global está empaquetado, tiene identificadores y versión propios. Las copias editables viven en `exerciseCatalog`; los recursos personalizados contienen Data URL.
- Además de IndexedDB hay selección y avisos en `localStorage`, y borradores de formularios en `sessionStorage`. Son estado local de interfaz, no datos de entrenamiento.
- Crear días y ejercicios no comprueba actualmente todas sus relaciones dentro de la misma transacción; duplicar una rutina puede conservar un `dayId` sin correspondencia. Estos hallazgos necesitan pruebas de reproducción antes de modificarse.

La base instalada de un usuario no está disponible en este repositorio: sus versiones, contenido y capacidad de conversión no pueden darse por comprobados mediante fixtures.

## Contrato e integridad

Definir `DATA_CONTRACT_VERSION = 1` independientemente de la versión Dexie y `SINFUL_SHELL_SCHEMA_VERSION`. Centralizar esquemas estrictos para entidades y conjunto completo, con identificadores estables, fechas reales, números finitos, límites coherentes con las reglas existentes, estados explícitos y relaciones comprobadas. Mantener las unidades canónicas en kg y usar `canonicalName` solo para búsqueda y agrupación.

Comprobar relaciones activas en la misma transacción que escribe. Sesiones, logs y snapshots históricos pueden referirse a rutinas, días o ejercicios eliminados: el diagnóstico debe distinguir esos casos de hijos huérfanos, sin borrar registros. Las sesiones nuevas guardarán nombres y configuraciones necesarias en instantáneas; el historial existente se preservará sin inventar información que ya no esté disponible. La definición de duplicado de sesión se basará en las reglas y pruebas existentes, sin impedir entrenamientos distintos que el producto admita.

Validar resúmenes de salud, ventanas temporales y relaciones con logs; conservarlos al editar sesiones. En el contrato separar lógicamente salud de los registros de entrenamiento para futuras políticas de privacidad, sin perder la capacidad de reconstruir el estado.

El diagnóstico será de solo lectura y devolverá gravedad, entidad, identificador, explicación y propuesta de resolución. Detectará duplicados, rangos, fechas, referencias, recursos y versiones, distinguiendo datos históricos desvinculados. Cualquier reparación será una operación separada, explícita y probada.

## Transición y compatibilidad

No eliminar las migraciones 1–7 ni restringir unilateralmente la importación histórica hasta disponer de evidencia de versiones instaladas, copia de seguridad recuperable y conversión verificada. Una migración de esquema necesaria tendrá una ruta transaccional, reversible mediante respaldo previo, que rechace estados no convertibles sin borrar ni reemplazar datos. Los fixtures de versiones anteriores prueban el mecanismo, pero no sustituyen la verificación de instalaciones reales. Documentar el puente conservado y las condiciones concretas para retirarlo. Ninguna operación destructiva se ejecuta automáticamente.

La inicialización debe decidir atómicamente si la base está realmente vacía; una base parcialmente poblada no se rellena con demo ni se modifica silenciosamente. Separar la comprobación de instalación y la creación de demo permite interponer una futura restauración. Corregir la versión registrada sin confundirla con la del contrato.

## Respaldos, recursos y cambios

El nuevo serializador leerá una instantánea transaccional, ordenará registros y propiedades de forma determinista y validará antes de reconstruir. Incluirá versión de contrato y metadatos verificables de integridad. Incluir datos propios, configuraciones pertinentes, copias personalizadas y resúmenes de salud diferenciados; excluir catálogo global empaquetado, credenciales, cachés y estado temporal de interfaz. Los recursos personalizados conservan identificadores y metadatos; su contenido binario se transporta como componentes separados identificados y verificados, no incrustado en el JSON del contrato. La reconstrucción completa exige todos los componentes referenciados y ocurre en una transacción. Conservar el respaldo histórico existente durante SPEC 01.

El seguimiento local de cambios confirmados debe actualizarse de forma atómica con las escrituras que afectan al respaldo, incluidas importaciones y cambios de salud; no marcar un cambio si la transacción revierte. Las lecturas y cambios de UI temporal no lo incrementan.

## Verificación y entrega

Auditar campos, índices, operaciones y dependencias de cada tabla y documentar el mapa final, la clasificación de datos para sincronización y las limitaciones de transición. Revisar cálculos compartidos y sus consumidores; mantener el historial y la semántica de series principales, calentamiento y drop sets.

Usar Vitest y fake-indexeddb para las 13 categorías de pruebas de la SPEC, incluyendo concurrencia, rollback, actualización de progreso, Health Connect, respaldo completo con recursos, migraciones y reapertura. Verificar rechazo sin modificación, preservación histórica y equivalencia de reconstrucción. Ejecutar la suite y el build completos. Informar cualquier conversión o instalación real que no pueda verificarse, sin declarar completada la transición por el mero éxito de pruebas simuladas.
