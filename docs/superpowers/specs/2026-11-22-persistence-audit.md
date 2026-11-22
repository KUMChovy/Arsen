# Auditoría de persistencia: estado de trabajo

Este inventario describe el código revisado, no certifica el contenido de las instalaciones reales. El contrato y el serializador internos están implementados; la transición de instalaciones reales sigue pendiente de verificación.

## Versiones y almacenamiento

IndexedDB usa `arsen`, Dexie 7 y 13 tablas; sus definiciones de campos están en `src/domains/*/types.ts` y sus índices en `src/db/schema.ts`. `DATA_CONTRACT_VERSION` empieza en 1 y es independiente de `CURRENT_SCHEMA_VERSION` y `SINFUL_SHELL_SCHEMA_VERSION`. Las versiones Dexie 1–7 aún se conservan: no hay inventario ni respaldo verificado de todas las instalaciones existentes que permita eliminarlas con seguridad.

Todas las tablas usan `id` como clave primaria de texto. Las fechas `createdAt` y `updatedAt` son cadenas; los días de entrenamiento y de descarga son fechas locales, mientras que las marcas temporales de salud incluyen zona. Los valores de peso persistidos se expresan en kg. La columna «respaldo» identifica datos que deben conservarse; no constituye una decisión de privacidad o sincronización definitiva.

| Tabla y responsable | Relaciones, campos y finalidad | Índices secundarios Dexie | Respaldo futuro |
| --- | --- | --- | --- |
| `settings` / settings | Registro `app`: versión, rutina activa anulable, unidad, discos, descarga, permisos, persistencia y preferencias de salud; varios campos son opcionales por compatibilidad. | `activeRoutineId`, `preferredUnit` | Preferencias del usuario; revisar por separado permisos y estado específico del dispositivo. |
| `deloadCycles` / settings | Estado `suggested`, `scheduled`, `active`, `completed` o `skipped`; fechas de transición anulables. | `status`, `startedAt`, `completedAt`, `scheduledStartDate`, `skippedAt`, `updatedAt` | Sí. |
| `routines` / routine | Nombre, indicador activo y marcas temporales. | `isActive`, `name`, `updatedAt` | Sí. |
| `routineDays` / routine | Pertenece a `routineId`; nombre, descripción, orden y día semanal anulable. | `routineId`, `[routineId+order]`, `weekday` | Sí. |
| `routineExercises` / routine | Pertenece a `routineId` y `dayId`; fuente de catálogo anulable, recursos, nombre, músculo, equipo, receta, carga y orden. | `routineId`, `dayId`, `canonicalName`, `[dayId+order]`, `sourceExerciseId` | Sí, incluida la configuración personalizada. |
| `exerciseCatalog` / routine | Copias personales con alias, notas, valores predeterminados, recursos y origen opcional `user` o `sinful-shell`; `sinfulShellId` puede ser nulo u omitirse. | `canonicalName`, `mainMuscle`, `equipment` | Sí para copias y personalizaciones; el manifiesto global empaquetado es reconstruible. |
| `exerciseAssets` / routine | Nombre, MIME y contenido de imagen en `dataUrl`, con marcas temporales. Puede ser referenciado por catálogo, ejercicio o instantánea. | `updatedAt` | Sí cuando se use; separar metadatos y binario sin perder referencias. |
| `weeklyVolumeTargets` / routine | Objetivo de músculo, series y textos, asociado a `routineId`. | `routineId`, `muscle` | Sí. |
| `workoutSessions` / workout | Rutina, día, fecha, estado y unidad; nombres, ejercicios planificados, tiempos y resumen `health` son opcionales. Las referencias antiguas pueden apuntar a entidades eliminadas. | `routineId`, `dayId`, `date`, `[date+routineId]`, `[date+dayId]` | Sí; tratar el resumen de salud como grupo independiente. |
| `exerciseLogs` / workout | Pertenece a sesión; referencia al ejercicio y snapshot con nombre, músculo, equipo y receta, estado y notas. | `sessionId`, `routineExerciseId`, `state` | Sí; el snapshot no depende del catálogo actual. |
| `setLogs` / workout | Pertenece a un registro; clase `main` o `warmup`, orden, kg, unidad mostrada, repeticiones y RIR. | `exerciseLogId`, `kind`, `[exerciseLogId+order]` | Sí. |
| `dropSetLogs` / workout | Pertenece a una serie principal; orden, kg, unidad mostrada, repeticiones y RIR. | `setLogId`, `[setLogId+order]` | Sí. |
| `skipLogs` / workout | Omisión de ejercicio en una sesión, motivo y fecha. | `sessionId`, `routineExerciseId` | Sí. |

El catálogo global Sinful Shell es código empaquetado, no una tabla global remota. La aplicación también conserva selección de día y avisos en `localStorage`, y borradores de edición en `sessionStorage`; son estado de interfaz, no registros de entrenamiento. No se identificaron tokens de autenticación en el modelo descrito.

## Escrituras y lecturas

Los servicios de routine crean, editan, duplican, ordenan y eliminan rutinas, días, ejercicios, catálogo y recursos. Los de workout gestionan sesiones, snapshots, series, drop sets y omisiones. Settings gestiona ajustes, descarga y respaldos; Health Connect guarda resúmenes en `workoutSessions.health`. Progreso lee sesiones y registros, agrupa por `canonicalName` y calcula métricas desde las series; no debe requerir que exista la rutina actual.

Las acciones de múltiples tablas emplean transacciones en varios flujos, pero todavía no se ha demostrado la cobertura completa. La inicialización y la creación de días, ejercicios y sesiones incorporan comprobaciones transaccionales. Al duplicar una rutina, una referencia a día ausente detiene la operación. El respaldo histórico de importación usa una transacción; el modo merge conserva ahora las filas locales con IDs existentes. Su exportación lee una instantánea transaccional, pero transporta las imágenes como Data URL y no es el serializador determinista futuro.

## Hallazgos y límites pendientes

- El validador histórico de respaldos admite campos omitidos y normaliza valores. Se conserva para evitar romper restauraciones antiguas antes de disponer de una transición comprobada.
- El reemplazo rechaza archivos sin tablas reconocidas y respaldos sin registros, pero aún acepta respaldos parciales históricos con algún registro; esto no equivale a una validación completa de integridad antes de reemplazar.
- El diagnóstico `diagnoseIntegrity` es interno, de lectura y parcial. Identifica algunas relaciones huérfanas, duplicados, fechas y valores de series, recursos de ejercicios, versiones, estados de descarga y resúmenes de salud; todavía no cubre todos los campos ni todas las relaciones de las 13 tablas.
- `inspectExerciseAssets` enumera recursos y referencias desde catálogo, recetas, planes de sesión e instantáneas; estima el tamaño binario de imágenes Data URL en base64. Otros formatos devuelven tamaño desconocido. El inventario no elimina recursos ni sustituye la separación física de binarios.
- `entities.ts` y `dataset.ts` definen validación estricta de entidades y relaciones para el contrato 1. La adopción de esos esquemas en todas las escrituras existentes aún no está terminada; un conjunto antiguo que no cumpla el contrato se rechaza sin modificarlo.
- `contractBackup.ts` prepara un manifiesto determinista, separa salud y bytes de imágenes, verifica SHA-256 y reconstruye en una transacción. `getContractBackupStatus` compara una huella de la instantánea confirmada con la última copia marcada explícitamente como guardada; la marca es local y queda fuera del manifiesto. La comparación calcula hashes bajo demanda, por lo que su coste depende del tamaño de las imágenes. Los recursos que no sean Data URL base64 canónicas se rechazan sin modificar la base y necesitan una conversión específica antes de este formato.
- `prepareContractTransition` acepta un respaldo histórico completo de la versión Dexie actual y prepara una propuesta sin escribir en IndexedDB. Conserva los valores presentes, informa las rutas modificadas y rechaza valores incompatibles; solo completa campos ausentes y retira las propiedades obsoletas explícitas. El archivo histórico original debe guardarse por separado antes de restaurar la propuesta. No se han verificado instalaciones reales ni se han retirado las migraciones 1–7.
- Health Connect compara una instantánea transaccional de sesión, registros y series antes de guardar. La comprobación rechaza modificaciones durante la lectura nativa, aunque conserven la misma marca temporal.
- Al cambiar la fecha de una sesión histórica se conserva la fecha de origen del resumen de salud; al resincronizar otro día se archiva el resumen anterior. El historial agrupa por fecha de origen y la tarjeta muestra esa fecha cuando existe. La inspección visual en un navegador real no estuvo disponible en este entorno.
- No se han auditado por completo cálculos, recursos sin referencia, inicializaciones con ajustes parcialmente dañados ni todas las versiones de datos instalados. No debe afirmarse que la SPEC 01 está terminada hasta cerrar esas brechas.

## Destino de los datos y transición

El contrato de respaldo incluye las 13 tablas, con las imágenes como componentes binarios separados y los resúmenes de salud en una sección separada. Es una preparación para respaldos futuros, no una política de sincronización remota ya implantada: la inclusión futura de salud y de preferencias o permisos específicos del dispositivo requiere decisiones independientes. El catálogo global empaquetado se reconstruye desde la aplicación; las copias personalizadas sí se incluyen. La marca local del último respaldo, las cachés, `localStorage`, `sessionStorage` y el estado temporal de interfaz no forman parte del contrato nuevo.

Para retirar puentes antiguos hay que inventariar las versiones de las instalaciones reales, guardar y comprobar un respaldo recuperable por instalación, convertirlo con un puente que soporte su versión, revisar el resultado y verificar la restauración antes de retirar el código de compatibilidad que corresponda. La propuesta actual solo admite respaldos completos del esquema Dexie 7 y no modifica la base por sí sola. Una huella SHA-256 detecta alteraciones accidentales, pero no autentica el origen del respaldo.

La detección de cambios del contrato compara bajo demanda el contenido confirmado con la huella marcada al guardar un respaldo; no introduce un contador de revisión atómico en cada escritura como describía el plan inicial. Esta alternativa observa las escrituras confirmadas y evita marcar cambios revertidos, a costa de volver a leer y calcular hashes, especialmente de imágenes.
