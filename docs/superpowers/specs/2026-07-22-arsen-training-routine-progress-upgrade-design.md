# Arsen Training, Routine, And Progress Upgrade Design

## Objetivo

Mejorar tres flujos existentes de Arsen sin romper la arquitectura offline:

- `/entreno`: permitir retomar ejercicios saltados, filtrar ejercicios del dia, cambiar rutina activa global y elegir dia de rutina para entrenar hoy.
- `/rutina`: mover el detalle de dia a una ruta propia, ampliar detalle por ejercicio y simplificar configuracion de calentamientos.
- `/progreso`: filtrar sesiones recientes por fechas entrenadas y dar funcionalidad real a `Mejores` e `Historial`.

El catalogo externo queda fuera de alcance para esta entrega. Se retomara mas adelante.

## Decisiones Aprobadas

- Cambiar rutina desde `/entreno` cambia la rutina activa global en toda la app.
- Cambiar dia en `/entreno` afecta el entrenamiento mostrado para la fecha actual.
- El selector de fecha editable no vuelve a `/entreno`.
- La edicion de serie en `/entreno` sera un sheet propio, no SweetAlert con input de texto.
- En `/rutina`, tocar un dia en modo `Ver` navega a una pagina nueva.
- En editor/agregar ejercicio se elimina el campo visible `Peso kg`.
- En editor/agregar ejercicio se elimina el campo visible `Warmups`; el protocolo define cuantas series salen.
- Protocolos visibles: `Ninguno`, `Hipertrofia`, `Fuerza`, `Progresivo`, `Pesado bajo volumen`.
- Catalogo con API externa no se implementa en esta entrega.

## /entreno

### Selector De Rutina Y Dia

La cabecera de `/entreno` agrega dos selects compactos:

- Rutina.
- Dia de la rutina.

Al seleccionar rutina:

1. Se llama `setActiveRoutine(routineId)`.
2. Se actualiza `settings.activeRoutineId`.
3. La rutina activa cambia para toda la app.
4. El dia seleccionado se resetea al dia por weekday si existe, o al primer dia de la rutina.

Al seleccionar dia:

1. `/entreno` muestra ejercicios de ese `RoutineDay`.
2. La fecha sigue siendo hoy.
3. La sesion se busca por `[date+dayId]`.
4. Si ya existe sesion hoy para ese dia, se continua.
5. Si no existe, se crea al registrar serie, saltar ejercicio o finalizar.

Esto cubre el caso de faltar un dia y retomarlo al siguiente sin agregar selector de fecha visible.

### Saltar Y Retomar Ejercicio

El sistema ya guarda `skipLogs` y `ExerciseLog.state = skipped`. Se completara la UI:

- En la lista `Ejercicios del dia`, cada ejercicio saltado mostrara estado `Saltado`.
- Al abrir un ejercicio saltado, el sheet permitira `Retomar`.
- `Retomar` llamara `reactivateExercise(sessionId, routineExerciseId)`.
- Al retomar se elimina el skip del dia y se recalcula estado segun series principales.

Si no existe sesion, `Retomar` no aparece porque no hay skip persistido.

### Filtros De Ejercicios Del Dia

La seccion `Ejercicios del dia` agrega controles:

- `Todos`
- `Pendientes`
- `En progreso`
- `Saltados`
- `Hechos`

El filtro usa `dailyProgress.stateByExerciseId`. `Todos` queda por defecto. La lista no debe limitarse a `slice(0, 8)`; debe mostrar todos los ejercicios filtrados.

### Edicion De Serie En Sheet

Se reemplaza el SweetAlert de `editSet` por un sheet movil:

- Titulo: `Editar serie`.
- Contexto: nombre del ejercicio y numero de serie.
- Inputs separados: peso, reps, RIR.
- Acciones: `Guardar`, `Eliminar`, `Cerrar`.
- Validacion: valores numericos finitos; peso y reps mayores a 0; RIR mayor o igual a 0.
- Guardar llama `updateMainSet`.
- Eliminar llama `deleteMainSet` con confirmacion.

El sheet usara el mismo lenguaje visual que `RegisterSetSheet`.

### Calentamientos En /entreno

El calentamiento se calcula desde `RoutineExercise.warmupProtocol` y `currentWeightKg`.

Reglas:

| Protocolo | Series mostradas |
|---|---|
| `none` / `Ninguno` | sin calentamiento |
| `hypertrophy` / `Hipertrofia` | 50% x 10, 70% x 5 |
| `strength` / `Fuerza` | 50% x 8, 70% x 3, 85% x 1 |
| `progressive` / `Progresivo` | 40% x 6, 80% x 6 |
| `heavy_low_volume` / `Pesado bajo volumen` | 80% x 5 |

El peso se redondea a incrementos de 0.5 kg, como hace la UI actual. En lb se usa `formatWeight`.

Justificacion de `Hipertrofia`: debe activar sin fatigar. NASM recomienda 1-2 series de calentamiento para hipertrofia; usar 50% y 70% da aproximaciones submaximas claras para el usuario.

## /rutina

### Ruta De Detalle De Dia

Se agrega ruta:

```txt
/rutina/dia/:dayId
```

`RoutinePage` modo `Ver` deja de renderizar `DayReadOnlyDetail` debajo. Al tocar un dia navega a la nueva ruta.

La nueva pagina:

- Carga el dia por `dayId`.
- Carga rutina asociada y ejercicios del dia.
- Muestra header con volver a `/rutina`.
- Conserva formato resumido actual:
  - nombre de dia
  - descripcion
  - musculo dominante
  - total de ejercicios
  - lista de ejercicios

### Expansion De Ejercicio

Cada ejercicio en la pagina de dia funciona como acordeon:

Resumen visible:

- Imagen muscular.
- Nombre.
- Musculo.
- Equipo.
- Series x reps.
- RIR.

Detalle desplegable:

- Descanso.
- Protocolo de calentamiento.
- Progresion.
- Notas tecnicas.
- Ultimo peso entrenado en texto de solo lectura.

No se edita desde esta pagina; edicion queda en pestana `Editar`.

### Editor De Dia

Label visible cambia:

```txt
Dia -> Nombre del dia
```

La data y el nombre interno no cambian.

### Editor/Agregar Ejercicio

Cambios:

- Quitar input `Peso kg`.
- Quitar input `Warmups`.
- Mantener `currentWeightKg` internamente:
  - al crear o agregar ejercicio queda `0`;
  - al editar ejercicio se preserva valor existente;
  - al registrar serie en `/entreno`, se actualiza con el ultimo peso principal guardado.
- Cambiar `Protocolo calentamiento` de texto libre a select.

Opciones del select:

- `Ninguno`
- `Hipertrofia`
- `Fuerza`
- `Progresivo`
- `Pesado bajo volumen`

Valores guardados recomendados:

- `none`
- `hypertrophy`
- `strength`
- `progressive`
- `heavy_low_volume`

Para compatibilidad, si existen valores viejos en `warmupProtocol`, se mapearan por texto:

- vacio o desconocido: `none`
- contiene `hipertrofia`: `hypertrophy`
- contiene `fuerza`: `strength`
- contiene `progres`: `progressive`
- contiene `pesado`: `heavy_low_volume`

## /progreso

### Filtro De Sesiones Recientes Por Fecha Entrenada

Se agregara una lista de fechas disponibles basada en `workoutSessions.date`.

Reglas:

- Solo aparecen fechas con al menos una sesion.
- Default: fecha mas reciente.
- Al elegir fecha, `Sesiones recientes` muestra solo sesiones de esa fecha.
- Si hay varias sesiones el mismo dia, se agrupan en la lista como filas separadas por rutina/dia.
- Cada sesion conserva resumen: fecha, rutina, dia, volumen, mejor serie, ejercicios y series.

El detalle actual ya agrupa:

```txt
Sesion -> ExerciseLog -> SetLog -> DropSetLog
```

Se conserva esa estructura y se verifica con prueba.

### Boton Mejores

El boton `Mejores` cambia el panel principal a una vista de mejores marcas del filtro actual.

Datos visibles:

- Mejor serie global o del filtro.
- Peso maximo.
- Mejor score.
- Ejercicio asociado.
- Fecha.

Si no hay datos, muestra estado vacio compacto.

### Boton Historial

El boton `Historial` cambia el panel principal a la lista de sesiones filtradas.

Comportamiento:

- Usa el filtro de fecha entrenada.
- Permite abrir detalle de sesion.
- Permite editar/eliminar desde el flujo existente.

### Boton Score

`Score` queda como vista por defecto y conserva grafica actual.

## Arquitectura

Unidades nuevas o modificadas:

- `domains/routine/pages/RoutineDayDetailPage.tsx`
- `domains/routine/repository.ts`: helper para cargar dia por id con rutina y ejercicios.
- `domains/workout/components/EditSetSheet.tsx`
- `shared/calculations/warmups.ts`: calculo puro de protocolos.
- `domains/progress/repository.ts`: fechas entrenadas, mejores marcas y sesiones por fecha.
- `domains/progress/pages/ProgressPage.tsx`: modo interno `score | bests | history`.

Se mantiene:

- Rutas lazy en `src/app/router.tsx`.
- Acceso Dexie dentro de repositorios/servicios.
- Componentes UI sin acceso directo a DB.
- Calculos puros con tests.

## Testing

Pruebas unitarias:

- `buildWarmupSets` para todos los protocolos.
- Mapeo de protocolos legacy.
- Filtro de ejercicios por estado.

Pruebas de integracion Dexie:

- Cambiar rutina activa desde servicio.
- Retomar ejercicio elimina `skipLogs` y recalcula estado.
- Sesiones por fecha devuelven solo dias entrenados.
- Detalle de sesion agrupa ejercicios, series y drop sets.

Pruebas UI:

- `/entreno` muestra filtros y permite retomar saltado.
- `/entreno` edita serie con sheet.
- `/rutina/dia/:dayId` renderiza resumen y despliega detalle de ejercicio.
- Editor de ejercicio muestra select de protocolo y no muestra `Peso kg` ni `Warmups`.
- `/progreso` default usa ultima fecha entrenada.
- Botones `Mejores` e `Historial` cambian contenido.

## Fuentes De Protocolos

- NASM hypertrophy guidance: recomienda 1-2 warm-up sets antes de trabajo de hipertrofia.
- NASM dynamic warm-up reference: referencia general de calentamiento dinamico, no implementado en esta entrega.
- PubMed leg press 1RM warm-up: 50% x 8 y 70% x 3 como calentamiento especifico.
- PMC bench/squat warm-up: 40% x 6 y 80% x 6 como calentamiento progresivo.
- PubMed high-load low-volume warm-up: 80% de carga inicial como protocolo eficiente.

URLs:

- https://blog.nasm.org/sports-performance/defining-muscular-hypertrophy-and-training-growth-best-practices
- https://blog.nasm.org/fitness/warm-up-in-the-cold-months
- https://pubmed.ncbi.nlm.nih.gov/21544000/
- https://pmc.ncbi.nlm.nih.gov/articles/PMC7558980/
- https://pubmed.ncbi.nlm.nih.gov/39593476/

## Fuera De Alcance

- API externa para catalogo.
- Imagenes externas por ejercicio.
- Selector de fecha editable en `/entreno`.
- Nueva tabla de planificacion flexible.
- Cambios de schema Dexie.
- Sincronizacion cloud.
