# Rediseño de Entreno

## Propósito y alcance

Facilitar el registro offline durante un entrenamiento desde un teléfono, preservando la identidad visual de Arsen y los datos existentes. Se implementan las prioridades P0, P1 y P2 de la especificación proporcionada: preparación, ejercicio activo, revisión y finalización; registro y edición rápidos; continuidad; adaptaciones temporales; notas; calentamientos; y resumen. El descanso recomendado es información estática: no se crean temporizadores.

## Experiencia

- Preparación: mostrar rutina y día, lista compacta y selección libre del ejercicio. Si hay sesión pendiente, hacer visible la opción de continuar. Respetar las restricciones actuales de cambio de rutina y día mientras haya trabajo sin finalizar.
- Sesión: el ejercicio seleccionado concentra imagen, músculo, objetivos, carga, descanso, serie actual, referencias y recomendaciones; la información secundaria se despliega bajo demanda. Un indicador compacto resume el progreso. Anterior, siguiente, seleccionar, omitir y restaurar son acciones diferenciadas, disponibles también para ejercicios ya trabajados.
- Registro: reutilizar los modos de carga y conversiones existentes. Precargar última serie principal de la sesión, luego referencia histórica y luego objetivo de rutina; nunca guardar automáticamente. Steppers y entrada manual para peso y repeticiones, entrada exacta accesible para RIR, drop sets contextuales y duplicación explícita. Bloquear dobles envíos y conservar errores visibles.
- Revisión: mostrar ejercicios realizados y omitidos, series principales, drop sets, volumen calculado con las mismas reglas que Progreso, notas y datos de salud disponibles. Permitir corregir antes de confirmar el cierre y consultar el resultado después.
- Las hojas inferiores comparten gestión de foco, nombre accesible, desplazamiento, controles de cierre, adaptación al teclado y protección de cambios sin guardar; respetan movimiento reducido, áreas seguras y anchos de 320–430 px o mayores. Acciones táctiles de 48 px cuando sea viable, sin depender de hover o color.

## Datos y compatibilidad

- Reutilizar `WorkoutSession.notes`, `ExerciseLog.notes`, snapshots, `SetLog.kind = warmup` y almacenamiento kg. La nota del ejercicio es distinta de las indicaciones de la rutina. Los calentamientos se muestran y editan en Historial, pero se excluyen del volumen principal, del progreso de series y de las recomendaciones.
- Representar los cambios de una sesión mediante datos propios de la sesión, no mutando las filas de rutina: lista y orden persistentes, ejercicio añadido o sustituto con snapshot y referencia estable. Los ejercicios originales sustituidos se conservan identificables y no se borran registros previos. La sustitución de un ejercicio con datos ofrece conservarlos y nunca los reasigna silenciosamente.
- Diseñar los nuevos campos como opcionales y compatibles con backups anteriores. Actualizar tipos, validación de importación, exportación y consultas; agregar migración de Dexie solo si se requieren índices o una transformación efectiva. Comprobar copia/restauración, sesiones antiguas y snapshots después de editar o eliminar rutinas.
- Mantener los significados existentes de `draft`, `completed` y los estados de ejercicio. Conciliar la finalización manual y automática sin reabrir silenciosamente una sesión finalizada manualmente ni interpretar ejercicios omitidos como series completadas; cubrir la compatibilidad histórica con pruebas.
- El registro de serie principal y sus drop sets debe ser atómico, con validación en la frontera de servicio y protección ante dobles pulsaciones. Los cambios temporales nunca actualizan el peso de la rutina original; conservar el comportamiento existente de peso de referencia para ejercicios de rutina cuando corresponda.
- Mantener la integración Health Connect y sus intervalos basados en series principales; no fabricar métricas ausentes. Mantener deload, progreso por nombre canónico, datos históricos y funcionamiento sin conexión.

## Implementación y verificación

Trabajar por etapas verificables: integridad y modelo de sesión; registro y calentamientos; navegación y notas; interfaz y hojas; resumen, historial y compatibilidad; revisión y pruebas integrales. Reutilizar componentes y servicios existentes cuando cubran las necesidades; extraer piezas compartidas solo cuando eliminen duplicación real.

Agregar pruebas de servicios y persistencia, restauración de backups, métricas y progresión, interacciones y accesibilidad. Verificar anchos de 320, 360, 390 y 430 px, teclado y foco, estados de error y recarga; ejecutar `pnpm test` y `pnpm build`. Indicar cualquier comprobación en dispositivo o lector de pantalla que no se pueda ejecutar.

## Ajuste posterior: acciones de series y última sesión

Las acciones de cada serie se despliegan dentro del flujo de su propia tarjeta para que la contención visual de la lista no recorte los controles; editar, duplicar y eliminar deben permanecer accesibles por teclado y con objetivos táctiles cómodos. La última sesión se presenta como un panel desplegable nativo, cerrado inicialmente, que mantiene la fecha o el estado sin historial en el encabezado y revela las series y drops al abrirlo. No cambia la información histórica ni su precarga.

## Ajuste posterior: opciones y lista de ejercicios

El ejercicio actual presenta un icono de opciones junto al de indicaciones. El icono abre y cierra el panel existente sin quitar funciones; su nombre y estado son accesibles. En la lista diaria, pulsar un ejercicio expandido vuelve a contraer sus series sin cambiar el ejercicio actual ni sus datos; pulsar otro lo selecciona y expande. La elección de contraer debe mantenerse hasta que la persona vuelva a abrirlo o navegue explícitamente a otro ejercicio.

## Ajuste posterior: hoja de opciones del ejercicio

Las opciones se muestran en una hoja inferior independiente, identificada con el nombre del ejercicio, usando la identidad oscura, violeta y verde de Arsen. La omisión o restauración, el orden y las adaptaciones conservan sus funciones y aparecen agrupadas en controles táctiles con iconos y explicaciones breves. La hoja se adapta a pantallas pequeñas, desplaza su contenido si es necesario y gestiona foco, Escape y cierre explícito sin descartar selecciones pendientes.
