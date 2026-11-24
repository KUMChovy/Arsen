# Auditoría de persistencia: estado de trabajo

Este inventario describe el código revisado. El propietario confirmó que no hay instalaciones previas y que la aplicación sigue en desarrollo; por ello no se requiere convertir bases ya distribuidas.

## Versiones y almacenamiento

IndexedDB usa `arsen`, Dexie 8, 13 tablas de datos y una tabla interna `localMetadata` para la revisión. Las definiciones de campos están en `src/domains/*/types.ts` y sus índices en `src/db/schema.ts`. `DATA_CONTRACT_VERSION` empieza en 1 y es independiente de `CURRENT_SCHEMA_VERSION` y `SINFUL_SHELL_SCHEMA_VERSION`. Se retiraron las migraciones 1–6; la actualización 7→8 agrega la tabla interna y actualiza la versión registrada sin borrar datos.

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

- Se reforzaron los límites de escritura de la unidad preferida, el día de la semana y las instantáneas y planes de ejercicios de sesión. Las acciones de entrenamiento comprueban que el ejercicio pertenece al día y la rutina indicados. Los planes nuevos rechazan imágenes personalizadas ausentes. Las importaciones de rutinas rechazan imágenes ausentes, referencias y órdenes inválidos, y validan el estado resultante transaccionalmente; la exportación obtiene una instantánea de lectura y rechaza imágenes ausentes.
- Las series de calentamiento y los traslados de series principales ahora asignan el orden después del máximo existente; la edición histórica rechaza órdenes duplicados. El traslado crea el registro de destino y actualiza los estados dentro de la misma transacción. La creación de sesiones con notas o finalización también revierte completa ante fallos. Estas correcciones no sustituyen la auditoría completa de todas las escrituras.
- El agregado de progreso incluye series válidas con 0 kg, como ejercicios sin carga, aunque no calcula una 1RM con peso cero. Los períodos rechazan fechas de calendario imposibles y sus límites usan la fecha local.
- Los desplazamientos simultáneos de días y ejercicios calculan su orden dentro de la transacción; duplicar un día y eliminar su rutina no deja días huérfanos. Editar una serie histórica y sus drop sets usa una única transacción; un fallo mantiene abierto el editor.
- Los cálculos de descarga usan fechas de calendario independientes del huso horario y los cambios de horario. Los discos que se redondean a cero no se admiten en ajustes ni se incluyen al calcular cargas.
- Las notas de sesión y ejercicio y los motivos de omisión se comprueban antes de persistirse. El cálculo de descarga y el redondeo de calentamientos evitan desbordamientos intermedios para pesos finitos extremos.
- El desglose de discos rechaza entradas no finitas o que requieran más de 10 000 discos; la nota de carga se omite en esos casos para evitar bloquear la interfaz.

- El reemplazo JSON exige las 13 tablas; la fusión permite omitir tablas, pero valida las entidades recibidas sin normalizarlas y comprueba las relaciones y la versión del conjunto resultante dentro de la transacción. Se retiró el validador de formatos antiguos. El generador demo emite directamente el contrato actual y su salida se prueba mediante ambos modos y la creación de un respaldo del contrato.
- El diagnóstico `diagnoseIntegrity` es interno, de lectura y parcial. Identifica algunas relaciones huérfanas, duplicados, fechas y valores de series, recursos de ejercicios, versiones, estados de descarga y resúmenes de salud; todavía no cubre todos los campos ni todas las relaciones de las 13 tablas.
- `inspectExerciseAssets` enumera recursos y referencias desde catálogo, recetas, planes de sesión e instantáneas; estima el tamaño binario de imágenes Data URL en base64. Otros formatos devuelven tamaño desconocido. El inventario no elimina recursos ni sustituye la separación física de binarios.
- `entities.ts` y `dataset.ts` definen validación estricta de entidades y relaciones para el contrato 1, incluidas imágenes con tipo coherente y base64 canónica. Las acciones de escritura revisadas validan sus entradas, pero no se ha demostrado que todas las rutas existentes apliquen el contrato completo.
- `contractBackup.ts` prepara un manifiesto determinista, captura la revisión local junto con la instantánea, separa salud y bytes de imágenes, verifica SHA-256 y reconstruye en una transacción. `getContractBackupStatus` compara una huella con la última copia marcada explícitamente como guardada; la marca es local y queda fuera del manifiesto. La comparación calcula hashes bajo demanda, por lo que su coste depende del tamaño de las imágenes. Las imágenes no canónicas se rechazan sin modificar la base.
- Se retiró el puente de transición `prepareContractTransition`, que no tenía consumidores de producto. La aplicación conserva de momento sus importaciones actuales de respaldo y rutina.
- Health Connect compara una instantánea transaccional de sesión, registros y series antes de guardar. La comprobación rechaza modificaciones durante la lectura nativa, aunque conserven la misma marca temporal. Los intervalos de sesión y ejercicio se validan dentro del día y se descartan marcas de tiempo ajenas al día consultado.
- Al cambiar la fecha de una sesión histórica se conserva la fecha de origen del resumen de salud; al resincronizar otro día se archiva el resumen anterior. El historial agrupa por fecha de origen y la tarjeta muestra esa fecha cuando existe. La inspección visual en un navegador real no estuvo disponible en este entorno.
- La inicialización rechaza ajustes inválidos o de versión distinta sin modificar los datos. El inventario informa recursos sin referencias, sin eliminarlos. No se ha demostrado mediante pruebas que toda escritura, cálculo o combinación de datos cumpla el contrato; la comprobación visual del editor no pudo ejecutarse porque el navegador de inspección no estaba disponible.

## Destino de los datos y transición

El contrato de respaldo incluye las 13 tablas, con las imágenes como componentes binarios separados y los resúmenes de salud en una sección separada. Es una preparación para respaldos futuros, no una política de sincronización remota ya implantada: la inclusión futura de salud y de preferencias o permisos específicos del dispositivo requiere decisiones independientes. El catálogo global empaquetado se reconstruye desde la aplicación; las copias personalizadas sí se incluyen. La marca local del último respaldo, las cachés, `localStorage`, `sessionStorage` y el estado temporal de interfaz no forman parte del contrato nuevo.

No hay instalaciones previas que convertir. Una base antigua usada durante el desarrollo puede necesitar un restablecimiento manual; no se restablece automáticamente. Una huella SHA-256 detecta alteraciones accidentales, pero no autentica el origen del respaldo.

`localMetadata/revision` se incrementa una vez por transacción de escritura confirmada, de forma atómica con los cambios; lecturas y marcado de huella no la incrementan. El respaldo captura esta revisión con la instantánea, pero la excluye del manifiesto portable. Una escritura sin cambio efectivo puede incrementar el contador de forma conservadora; la comparación de la huella evita tratar contenido idéntico como distinto. El cálculo de huellas sigue dependiendo del tamaño de las imágenes.

La revisión se inicializa al crear la base o actualizar desde el esquema 7. Si falta posteriormente, las escrituras revierten y el diagnóstico lo informa; no se reinicia silenciosamente. Las pruebas de transacciones usan fake-indexeddb; falta verificar su comportamiento en un navegador o WebView real.

El contrato limita los valores de recetas y series al máximo entero seguro de JavaScript; las importaciones y las escrituras de recetas y series aplican sus validadores. Los órdenes calculados para agregar, duplicar o mover se rechazan si superan el entero seguro. El volumen máximo por serie es aproximadamente 8,2 × 10³¹ kg-repeticiones: aun con el máximo de elementos de un arreglo JavaScript, la suma permanece por debajo del máximo finito representable. Los cálculos de salud dependen además de los valores recibidos del proveedor, que se validan antes de persistirse.
