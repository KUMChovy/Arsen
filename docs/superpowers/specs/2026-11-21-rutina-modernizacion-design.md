# Modernización de Rutina

## Propósito y límites

Mejorar la planificación desde el teléfono y conectarla con Entreno e Historial, conservando el funcionamiento offline, los datos, las convenciones visuales y los límites de dominio de Arsen. No se añade un sistema de estadísticas, sincronización externa, catálogo de plantillas ni dependencias nuevas. La interfaz permanece en español y utiliza el shell y los tokens existentes.

## Diagnóstico

- Ya existen una única rutina activa, creación, duplicación y eliminación de rutinas, días y ejercicios, edición explícita, catálogo, arrastre con teclado y puntero, y consultas reactivas de IndexedDB. Las copias necesitan mantener identificadores independientes y orden coherente.
- El selector de rutinas solo muestra nombres; los controles de edición ocupan espacio permanente y el arrastre está conectado a toda la fila. No hay traslado de ejercicios entre días ni alternativa contextual de orden.
- Hay instantáneas de ejercicios en los registros y un plan opcional de sesión. Sin embargo, el plan no se captura al crear cada sesión, los nombres de rutina y día se leen del estado actual y el registro de una serie actualiza directamente el peso planificado.
- Progreso e Historial ya tienen filtros y detalles de sesiones. Su navegación y repositorios deben reutilizarse; los respaldos validan explícitamente la forma de las sesiones.

## Diseño propuesto

### Refinamiento de densidad solicitado

Las acciones de cada ejercicio se abren desde su icono en una hoja inferior accesible, con título, cierre, foco contenido y acciones táctiles. Los ajustes secundarios del día y de la receta se agrupan en secciones desplegables; la lista de ejercicios y los objetivos frecuentes permanecen visibles. La interacción debe conservar borradores y no ocultar la única forma de ejecutar una acción necesaria.

La hoja montada fuera del shell debe declarar su propio color de texto. Sus acciones usan superficies contrastadas e iconos del sistema, con edición destacada y la acción destructiva claramente diferenciada.

### Planificación y edición

- Mantener una sola rutina activa. Presentar tarjetas compactas con estado, conteos y resumen expandible, sin repetir la vista detallada; usar la duplicación de rutinas como mecanismo ligero de plantilla.
- Conservar días de longitud arbitraria y el día semanal opcional. Presentar un selector compacto, y acciones contextuales accesibles para editar, duplicar, eliminar y reordenar. No introducir un estado archivado o de descanso que el modelo no soporta.
- Mantener el arrastre existente con un asa específica, alternativas accesibles de subir y bajar, y persistencia transaccional validada. El traslado entre días valida pertenencia a la misma rutina, actualiza el destino y preserva el resto de la receta.
- Consolidar acciones secundarias en menús táctiles con foco y cierre por teclado; usar los patrones visuales existentes. Introducir steppers accesibles para series y conservar la edición numérica directa y validada para repeticiones y cargas. Las opciones poco frecuentes se revelan progresivamente.
- Mantener guardado explícito donde ya existe. Proteger los borradores al cambiar de día, cerrar paneles o navegar; serializar operaciones conflictivas, mostrar progreso y errores reales, y restaurar la vista persistida si falla el guardado. Las eliminaciones mantienen confirmación.

### Entreno e historial

- Al crear una sesión, guardar una copia ordenada de los ejercicios y los nombres de rutina y día disponibles. La sesión utiliza su propio plan aunque después cambie la rutina. Antes de renombrar o eliminar, preservar para sesiones antiguas la información todavía recuperable dentro de la misma transacción. No se pueden reconstruir nombres o planes ya eliminados previamente; se conservan los datos y las alternativas actuales cuando falten.
- Registrar series no modifica automáticamente la planificación. Después de finalizar, ofrecer una revisión opcional de propuestas derivadas de series principales, identificadas por ejercicio de rutina, con valores anteriores y propuestos. Solo se aplican selecciones confirmadas, en una transacción que valida que los registros y valores de origen sigan vigentes; ejercicios temporales o borrados no se vinculan por nombre.
- Desde Rutina navegar a Historial con el identificador de la rutina y reutilizar sus filtros y detalles. Las consultas históricas y exportaciones deben preferir los nombres guardados, con alternativa compatible para sesiones antiguas.
- Los nuevos campos opcionales deben sobrevivir exportación e importación y no exigir migración de índices. Si se detecta necesidad real de cambiar índices, añadir migración segura y pruebas de datos anteriores.

## Verificación

Probar con IndexedDB simulado duplicación independiente, orden y traslado atómicos, identificadores inválidos, fallos de persistencia, instantáneas antes y después de cambios o eliminación, sesiones antiguas, respaldo/restauración, series sin actualización automática y aplicación selectiva e idempotente de propuestas. Cubrir estados vacíos, controles, formularios, teclado, foco y errores con pruebas de componentes. Ejecutar la suite completa y el build de producción; inspeccionar la interfaz en anchuras de 320–390 px y escritorio. No afirmar que una fase está terminada si falta comportamiento o verificación.
