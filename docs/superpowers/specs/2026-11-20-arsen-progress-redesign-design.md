# Arsen — Rediseño integral de Progreso

## Intento y resultado esperado

Progreso debe convertir el historial local de entrenamientos en una lectura rápida y confiable del rendimiento. Al abrirlo, una persona que entrena desde el teléfono debe poder entender su actividad reciente, encontrar cualquier ejercicio histórico, comparar sesiones y consultar sus registros sin aprender qué significa un `score` propietario.

El resultado será una sola experiencia de Progreso con tres vistas: `Resumen`, `Ejercicios` e `Historial`. Las tres reutilizarán los snapshots históricos, los servicios existentes de edición y la integración persistida de Health Connect.

## Objetivos

- Sustituir la presentación de Score /100 por 1RM estimada y métricas con significado explícito.
- Ofrecer periodos de 4, 8, 12 semanas y todo el historial, con comparación contra un periodo anterior de igual duración cuando exista.
- Permitir explorar ejercicios globalmente por nombre canónico, músculo, rutina y día sin depender de que la rutina siga viva.
- Mostrar evolución por ejercicio con peso, repeticiones, volumen y 1RM estimada; una marca por sesión y una agregación documentada.
- Generar observaciones locales, verificables y prudentes sobre mejora, estabilidad, disminución o datos insuficientes.
- Mantener calendario, listado cronológico, detalle y edición/eliminación de sesiones, series y drop sets.
- Presentar Health Connect como complemento sin duplicar totales diarios.
- Mantener funcionamiento offline, almacenamiento en kg, backups completos y la compatibilidad histórica basada en snapshots.

## No objetivos y antiobjetivos

- No backend, cuentas, sincronización en la nube ni IA generativa.
- No migración de Dexie: las métricas serán derivadas de las tablas actuales.
- No fusionar ejercicios por similitud textual; solo se usará el `canonicalName` ya persistido.
- No diagnosticar fatiga, lesiones o sobreentrenamiento ni convertir ausencia de entrenamientos en pérdida de fuerza.
- No cambiar el editor de rutinas ni el flujo principal de registro de entrenamientos.
- No borrar ni reescribir registros históricos para adaptarlos a las nuevas vistas.

## Decisiones de producto y navegación

### Vistas

`/progreso` seguirá siendo la entrada y abrirá `Resumen`. Un control de pestañas compacto cambia entre `Resumen`, `Ejercicios` e `Historial`; la vista seleccionada se refleja en `?vista=` para que volver desde un detalle conserve el contexto. El estado de filtros de cada vista se mantendrá en la página mientras el usuario navega dentro de ella.

El detalle de ejercicio tendrá la ruta lazy `/progreso/ejercicio/:canonicalName`. El valor se codifica en la URL y se resuelve por el identificador canónico, no por el nombre mutable de una rutina. El detalle de sesión seguirá usando `/progreso/historial/:date`, con el contexto de filtros en la query cuando corresponda.

### Resumen

El resumen inicia sin día obligatorio. Incluye un selector de periodo (`4`, `8`, `12` semanas o `all`) y, opcionalmente, rutina/día como filtros secundarios. La jerarquía será:

1. tarjetas compactas de sesiones, series de trabajo, volumen total y frecuencia;
2. comparación contra el periodo anterior de igual duración;
3. tendencia semanal de volumen;
4. observaciones automáticas globales;
5. mejores marcas recientes y Health Connect, colapsables cuando haya mucho contenido.

El volumen total es la suma de series principales y drop sets. Las series de trabajo cuentan únicamente `SetLog.kind === 'main'`; los drop sets no se cuentan como series principales y sí se reflejan en volumen. También se mostrará volumen promedio por sesión para evitar interpretar más sesiones como mayor rendimiento.

### Ejercicios

La lista se construye de `ExerciseLog.snapshot` y muestra solo ejercicios con registros de series. Es global, ordenable por nombre o última fecha, buscable por texto y filtrable por músculo, rutina y día. Un ejercicio de una rutina eliminada conserva la etiqueta histórica `Rutina eliminada`/`Día eliminado` en el contexto de sesión, pero sigue apareciendo en la lista.

El detalle muestra identidad del ejercicio, última fecha, sesiones, peso máximo, mejor serie y mejor 1RM. La métrica de la gráfica se elige entre `Peso`, `Repeticiones`, `Volumen` y `1RM estimada`; cada punto representa una sesión y conserva su fecha e id para abrir el detalle original.

Agregaciones por sesión:

- peso: mayor carga de una serie principal válida;
- repeticiones: máximo de repeticiones de una serie principal válida, con su carga;
- volumen: suma de series principales y drop sets;
- 1RM: mejor valor válido de la sesión.

Los datos faltantes se omiten, nunca se convierten en cero ni en puntos interpolados. El eje Y se calcula a partir de los valores visibles con margen suficiente y el tooltip muestra unidad, fecha y sesión.

### Historial

La pestaña combina calendario mensual y lista cronológica. Los filtros son opcionales y se pueden limpiar: periodo, rutina, día y ejercicio. Los días entrenados se distinguen de días sin entrenamiento y fechas futuras; seleccionar un día abre el flujo existente de detalle/creación. La creación de sesiones pasadas, edición, eliminación y confirmaciones destructivas se conserva.

La exportación se ofrece mediante una acción compacta con elección explícita de CSV o JSON. El alcance respeta filtros y periodo cuando se haya seleccionado uno. El backup completo y su esquema no cambian. La exportación de progreso añade nombres correctos para 1RM, pero conserva los campos estructurales y las filas históricas necesarias para no romper consumidores existentes; nunca vuelve a presentar `score` como puntos sobre 100.

## Modelo estadístico

Las funciones puras vivirán en el dominio de progreso o en cálculos compartidos, separadas de Dexie y de React. Los valores se validan antes de agregarse: peso y repeticiones deben ser finitos y mayores que cero; las series principales son las únicas elegibles para peso, repeticiones y 1RM.

La 1RM estimada usa Epley solo para 2–12 repeticiones:

`peso × (1 + repeticiones / 30)`

Una serie de 1 repetición se registra como carga máxima observada y se etiqueta como directa, no como estimación. Las series de más de 12 repeticiones no generan 1RM. Las mejores marcas se separan en mayor peso observado, mejor 1RM estimada y mejores series por repeticiones cuando exista al menos un registro válido; cada marca incluye id de serie/sesión, fecha, ejercicio, carga, repeticiones y contexto navegable.

Los periodos se calculan con fechas reales de entrenamiento: el periodo actual termina en la fecha más reciente del historial visible y retrocede `N` semanas; el periodo anterior ocupa las `N` semanas inmediatamente anteriores. `Todo el historial` no muestra comparación artificial. La frecuencia es sesiones por semanas cubiertas y el promedio de volumen se calcula por sesión visible.

El motor de interpretación tendrá constantes documentadas y pruebas. Como punto de partida: cambio relevante de 5% para carga/1RM, 10% para volumen, mínimo de 2 sesiones para comparar y mínimo de 3 sesiones para declarar una tendencia. Dos sesiones se describen como comparación, no como tendencia. Dentro de tolerancia se reporta estabilidad; con menos datos se reporta insuficiencia. Cada observación conservará las fechas y métricas que la sustentan para poder mostrarlas o enlazarlas.

## Arquitectura y archivos

- `src/domains/progress/repository.ts`: conservar la lectura de registros y añadir un dataset normalizado reutilizable, consultas globales de ejercicios, sesiones filtradas, resumen por periodo, detalle por ejercicio y agregaciones de historial.
- `src/domains/progress/calculations.ts`: funciones puras de 1RM, marcas, periodos, agrupación semanal y agregaciones por sesión.
- `src/domains/progress/analysis.ts`: motor de observaciones y constantes de umbrales, sin acceso a Dexie.
- `src/domains/progress/hooks.ts`: hooks reactivos para dataset, resumen, ejercicio, historial y Health Connect.
- `src/domains/progress/pages/ProgressPage.tsx`: shell de pestañas y composición de Resumen, Ejercicios e Historial sin lógica estadística inline.
- `src/domains/progress/pages/ProgressExercisePage.tsx`: detalle de ejercicio, selector de métrica/periodo, comparación y observaciones.
- `src/domains/progress/components/ProgressChart.tsx`: gráfica configurable con unidades, dominio dinámico, tooltip accesible y estado vacío.
- `src/domains/progress/components/ProgressSummary.tsx`, `ExerciseExplorer.tsx`, `HistoryView.tsx` y componentes pequeños solo si la extracción mantiene una responsabilidad clara.
- `src/domains/progress/pages/ProgressHistoryDatePage.tsx`: conservar la edición existente y adaptar formato de unidad, contexto y datos del nuevo repositorio.
- `src/domains/health/repository.ts` y componentes: agrupar resúmenes diarios por fecha para no duplicar calorías/pasos cuando hay varias sesiones; filtrar puntos de ejercicio por canonical name.
- `src/domains/settings/services.ts`: actualizar únicamente el export de progreso, sin tocar el formato de backup completo.
- `src/app/router.tsx`: registrar la ruta lazy de detalle de ejercicio.

No se agregará tabla ni dependencia. Se reutilizarán `recharts`, `ExerciseArt`, `Card`, `ActionButton`, `formatWeight`, `kgToUnit`, los servicios de workout y los componentes de Health Connect existentes.

## Accesibilidad, rendimiento y estados

- Pestañas, filtros, selector de métrica y calendario tendrán nombres accesibles, foco visible y objetivos táctiles de al menos 44–48 px.
- Las gráficas tendrán resumen textual equivalente, unidades visibles y no dependerán solo del color.
- Se contemplan carga, sin registros, datos insuficientes, datos parciales de salud, error de consulta y listas largas.
- La lectura de IndexedDB se hará en una consulta reactiva reutilizable; las agregaciones se calculan una vez por dataset/periodo y no dentro de cada tarjeta.
- La UI seguirá funcionando en 360 px y dentro del `max-w-[430px]` existente.

## Pruebas y validación

Se añadirán pruebas unitarias para 1RM válida/directa/inválida, volumen con drop sets, marcas, periodos, semanas, comparaciones, umbrales, estabilidad y datos insuficientes. Las pruebas Dexie cubrirán ejercicios globales, rutinas eliminadas, filtros combinados, historial, actualización tras editar/eliminar y no duplicación de Health Connect. Las pruebas de UI cubrirán pestañas, resumen sin día obligatorio, explorador, detalle, gráfica/estados vacíos, exportación elegible y navegación de historial.

La validación final será `pnpm test` y `pnpm build`, además de una revisión visual de Progreso en 360 px y 430 px. Después de terminar la UI se ejecutará el detector mecánico de Impeccable sobre los targets modificados y se hará la pasada separada de `critique` + `polish` y `audit` + `harden`.

## Decisiones del implementador

- La navegación de las tres vistas usa la URL solo para la pestaña, no crea rutas paralelas para cada filtro.
- No se persistirá una caché de métricas: el dataset actual es suficientemente pequeño para derivar resultados reactivos y evita otra fuente de verdad.
- La comparación de rendimiento prioriza 1RM comparable y repeticiones/carga; el volumen se muestra como contexto y nunca es la única prueba de mejora.
- Si el detalle de Health Connect no contiene medición para una métrica, se mostrará `Sin datos`/`—`, no cero.
