# Arsen — Rediseño integral del Historial

## Intención

Convertir Historial en un diario offline de entrenamientos: el usuario debe poder encontrar una sesión concreta, entender qué ocurrió y corregir o completar sus registros sin perder contexto ni romper los datos que alimentan Progreso.

La implementación se apoya en el rediseño vigente de Progreso. No crea un segundo sistema de métricas, un segundo modelo de sesiones ni una segunda ruta de persistencia.

## Resultado esperado

- Historial alterna entre lista cronológica y calendario dentro de la propia vista.
- La selección de una tarjeta o de un día abre una sesión identificada por `sessionId`, incluso cuando hay varias sesiones el mismo día.
- Búsqueda, filtros y resumen del periodo trabajan sobre todo el historial por defecto y conservan su contexto al volver.
- El detalle muestra snapshots históricos, series principales, drop sets asociados, notas, estado, salud disponible, métricas y enlaces a Progreso.
- Las ediciones compuestas son atómicas y las operaciones destructivas limpian todos los registros relacionados.
- Duplicar genera un borrador editable; nunca contabiliza una sesión no confirmada.
- Progreso, Entreno, Rutinas, Configuración, respaldos y Health Connect siguen usando sus contratos actuales.

## Alcance

### Incluido

1. Consultas de historial y agregaciones reutilizables en `domains/progress`.
2. Navegación `/progreso/historial/:sessionId` con compatibilidad para `/progreso/historial/:date`.
3. Lista, calendario, búsqueda normalizada, filtros combinables y estado de navegación persistente en URL/session state.
4. Detalle completo y edición móvil de sesión, ejercicios, notas, series y drop sets.
5. Duplicación segura, comparación compacta, récords verificados y exportación individual JSON/CSV.
6. Integración de los resúmenes de Health Connect ya almacenados, sin cambiar permisos ni la integración nativa.
7. Pruebas unitarias, de repositorio, servicios, navegación, componentes y regresión.

### No incluido

- Backend, sincronización en nube, autenticación o IA externa.
- Un motor estadístico paralelo a `progress/calculations.ts` y `progress/analysis.ts`.
- Migración destructiva o reconstrucción inventada de nombres históricos que nunca se guardaron.
- Rediseño de Entreno, Rutinas o permisos nativos de Health Connect fuera de los contratos necesarios.
- Eliminación masiva.

## Decisiones de diseño y producto

### Jerarquía de navegación

- **Historial general:** control Lista/Calendario, búsqueda, filtros, resumen compacto y resultados.
- **Detalle por ID:** encabezado de sesión, resumen, ejercicios expandibles, edición y acciones.
- **Edición:** sheets para tareas pequeñas; pantalla/sección completa para edición de sesión, agregar ejercicio y comparación. No se anidan sheets.

La vista general usa `Todo el historial` como periodo inicial, independiente de los periodos predeterminados de Resumen y Ejercicios. El contexto consultado se refleja en la URL cuando sea parte del filtro y en `sessionStorage` para modo, mes y scroll aproximado.

### Datos históricos

`WorkoutSession` conserva la fecha, estado, notas y salud; `ExerciseLog.snapshot` conserva el nombre, nombre canónico, músculo, equipo y receta capturada; `SetLog` y `DropSetLog` conservan los valores en kg y el orden. Las etiquetas actuales de rutina/día son enriquecimiento opcional: si faltan se muestra `Rutina eliminada` o `Día eliminado`, sin reescribir el snapshot.

Las sesiones draft, sesiones sin series y ejercicios omitidos se muestran como registros incompletos. Sólo las sesiones completadas y con datos válidos participan en métricas de rendimiento; el historial puede mostrar también los registros parciales.

### Integridad de mutaciones

Las operaciones que cambian más de una entidad viven en servicios de `domains/workout`, dentro de transacciones Dexie cuando corresponde:

- actualizar datos generales de sesión;
- reasignar fecha/rutina/día validando conflictos;
- agregar ejercicio con snapshot y sus series;
- editar/mover serie y conservar sus drop sets;
- eliminar ejercicio o sesión y sus hijos;
- crear un borrador a partir de una sesión.

La edición de una sesión no mueve una serie por separado después de guardar el encabezado. Las entradas inválidas o asociaciones inseguras fallan antes de modificar datos.

### Métricas y comparación

Se reutilizan volumen, 1RM estimada/directa, récords y `analyzeProgress`. Los drop sets contribuyen al volumen, pero no al conteo de series principales ni a recomendaciones de aumento. Las comparaciones muestran diferencias absolutas y porcentuales sólo cuando las sesiones son comparables; si cambia el número de ejercicios o series, se explica la limitación.

### Interfaz

Se conserva el tema oscuro y los tokens `arsen-*`. Purple indica navegación/selección; acid green indica guardado, mejoras y récords; estados incompletos y destructivos también llevan texto/icono. Las tarjetas son compactas, los controles tienen al menos 44px de área táctil, hay focus-visible, labels accesibles y el diseño funciona de 360px a 430px.

## Arquitectura propuesta

- `progress/repository.ts`: dataset histórico, filtros, resumen, detalle y consultas de comparación/exportación; sin Dexie desde componentes.
- `progress/calculations.ts` y `progress/analysis.ts`: únicas fuentes de cálculos existentes.
- `workout/services.ts`: mutaciones transaccionales y validación de relaciones.
- `progress/components/HistoryView.tsx`: exploración lista/calendario/filtros/resumen.
- `progress/pages/ProgressHistorySessionPage.tsx`: detalle por ID y acciones.
- `progress/components/*Sheet.tsx`: formularios pequeños reutilizando `CreateSessionSheet` y controles de series cuando sea seguro.
- `router.tsx`: rutas lazy para sesión por ID y compatibilidad de fecha.
- `settings/services.ts`: exportación de una sesión sin alterar el backup completo.

No se añade una versión de Dexie salvo que una prueba demuestre que algún índice es imprescindible. Los filtros se calculan sobre un dataset cargado una vez por consulta para no ejecutar una lectura completa por tarjeta.

## Estados que deben existir

- carga y error recuperable;
- historial vacío;
- búsqueda/filtros sin resultados;
- sesión inexistente o eliminada;
- sesión draft o sin series;
- guardado en curso y confirmación exitosa;
- conflicto de fecha/día;
- Health Connect desactivado, sin datos o con datos parciales;
- exportación y error de exportación;
- sesión comparable ausente o datos insuficientes.

## Verificación

Cada nueva regla de consulta o mutación se implementa con TDD y pruebas de regresión. Antes de reportar finalización se ejecutan `pnpm test`, `pnpm build`, revisión del diff, detector mecánico de Impeccable y una inspección visual en 360px y 430px.

## Decisiones del implementador

- Se prioriza una primera entrega integrada sobre el repositorio actual: reutilizar los servicios y componentes existentes tiene precedencia sobre dividir archivos por anticipado.
- La compatibilidad con la ruta anterior por fecha se mantiene como redirección/selector, mientras que los nuevos enlaces siempre usan el ID.
- Cuando una capacidad del spec requiere datos que el modelo actual no guarda (por ejemplo, un nombre histórico de rutina), se muestra el fallback explícito y no se inventa una migración.
