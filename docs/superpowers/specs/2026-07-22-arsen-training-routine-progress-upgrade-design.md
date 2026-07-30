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
- El cambio de rutina/dia en `/entreno` vive en un boton compacto dentro del header, no como selects permanentes en pantalla.
- La navegacion del ejercicio actual usa botones laterales tipo `<` y `>` dentro de la card principal.
- `>` salta el ejercicio actual, guarda skip y avanza al siguiente ejercicio no hecho.
- `<` vuelve al ejercicio anterior no hecho sin modificar logs.
- La edicion de serie en `/entreno` sera un sheet propio, no SweetAlert con input de texto.
- La edicion de serie soportara drop sets: ver, editar, agregar y quitar drops sin romper la serie principal.
- En `/rutina`, tocar un dia en modo `Ver` navega a una pagina nueva.
- En editor/agregar ejercicio se elimina el campo visible `Peso kg`.
- En editor/agregar ejercicio se elimina el campo visible `Warmups`; el protocolo define cuantas series salen.
- El campo `Calentamiento` en receta del dia tendra un sheet informativo con descripcion del protocolo.
- Protocolos visibles: `Ninguno`, `Hipertrofia`, `Fuerza`, `Progresivo`, `Pesado bajo volumen`.
- Catalogo con API externa no se implementa en esta entrega.
- `/progreso` no mostrara `Sesiones recientes` en la pagina principal. El boton `Historial` abre un calendario en sheet.

## /entreno

### Selector Compacto De Rutina Y Dia

La cabecera de `/entreno` agrega un boton compacto en la esquina superior derecha del `PageHeader`.

Contenido visual:

- Icono compacto, por ejemplo `Repeat2`, `Dumbbell` o similar de `lucide-react`.
- Texto corto o abreviado con rutina activa cuando quepa.
- `aria-label` completo: `Cambiar rutina y dia de entrenamiento`.
- Estado activo/seleccionado cuando el sheet esta abierto.

Al tocar el boton se abre un sheet movil con:

- Rutina activa marcada.
- Lista o select de rutinas disponibles.
- Lista o select de dias de la rutina seleccionada.
- Boton cerrar.

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

### Navegacion Lateral De Ejercicio Actual

La card `Ejercicio actual` tendra botones laterales tipo `<` y `>`.

Reglas:

- La card nunca debe mostrar ejercicios `done` como ejercicio actual.
- El ejercicio actual se calcula desde ejercicios no hechos: `pending`, `in_progress` y `skipped`.
- `>` guarda skip del ejercicio actual con `skipRoutineExerciseForDay`, actualiza estado a `skipped` y avanza al siguiente ejercicio no hecho.
- Si el siguiente candidato esta `done`, se omite.
- `<` vuelve al ejercicio anterior no hecho segun orden del dia.
- `<` no deshace skip ni borra datos.
- Si no hay anterior/siguiente valido, el boton queda disabled con `aria-disabled`.
- Al cambiar ejercicio actual se recalculan dinamicamente: calentamiento, resumen visual, datos de la card y acciones.
- La lista `Ejercicios del dia` conserva filtros por estado para abrir manualmente cualquier ejercicio visible.

El flujo `Retomar` dentro del sheet de registro se elimina. Si el usuario quiere volver a un saltado, usa `<` o la lista filtrada por `Saltados`.

### Filtros De Ejercicios Del Dia

La seccion `Ejercicios del dia` agrega controles:

- `Todos`
- `Pendientes`
- `En progreso`
- `Saltados`
- `Hechos`

El filtro usa `dailyProgress.stateByExerciseId`. `Todos` queda por defecto. La lista no debe limitarse a `slice(0, 8)`; debe mostrar todos los ejercicios filtrados.

### Edicion De Serie Y Drop Sets En Sheet

Se reemplaza el SweetAlert de `editSet` por un sheet movil:

- Titulo: `Editar serie`.
- Contexto: nombre del ejercicio y numero de serie.
- Inputs separados: peso, reps, RIR.
- Lista de drop sets asociados a la serie principal.
- Acciones para drops: editar peso/reps/RIR, agregar drop set y quitar drop set.
- Acciones globales: `Guardar`, `Eliminar serie`, `Cerrar`.
- Validacion: valores numericos finitos; peso y reps mayores a 0; RIR mayor o igual a 0.
- Guardar actualiza la serie principal y todos los cambios de drop sets.
- Eliminar serie llama `deleteMainSet` con confirmacion; esto borra tambien drop sets como ya hace el servicio.
- Quitar drop set borra solo ese drop.
- Agregar drop set crea un nuevo registro ligado a la serie principal.

Servicios necesarios:

- `updateMainSet`, existente.
- `addDropSet`, existente.
- `updateDropSet`, nuevo.
- `deleteDropSet`, nuevo.
- `getDropSetsForMainSet` o extender el progreso diario para exponer drops por `setLogId`.

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

### Descripcion De Calentamiento En Sheet

Junto al select `Calentamiento` se agrega boton de informacion.

Al tocarlo abre un sheet compacto:

- Nombre del protocolo seleccionado.
- Descripcion breve del objetivo.
- Series que se generaran en `/entreno`.
- Ejemplo con 100 kg para que el usuario entienda porcentajes.

Contenido:

| Protocolo | Descripcion | Ejemplo con 100 kg |
|---|---|---|
| Ninguno | No genera aproximaciones. Util para ejercicios ligeros o cuando ya vienes caliente. | Sin series |
| Hipertrofia | Activa el patron sin fatigar antes de series de trabajo moderadas. | 50 kg x 10, 70 kg x 5 |
| Fuerza | Sube carga de forma gradual antes de pesos altos. | 50 kg x 8, 70 kg x 3, 85 kg x 1 |
| Progresivo | Dos saltos amplios para preparar trabajo tecnico sin demasiadas series. | 40 kg x 6, 80 kg x 6 |
| Pesado bajo volumen | Un acercamiento pesado y corto para usuarios que ya estan calientes. | 80 kg x 5 |

## /progreso

### Historial Como Calendario

La pagina principal de `/progreso` ya no renderiza la seccion `Sesiones recientes`.

El boton `Historial` abre primero un sheet con calendario.

Reglas del calendario:

- Muestra mes actual por defecto.
- Permite cambiar de mes.
- Solo los dias con entrenamiento son seleccionables.
- Dias entrenados se resaltan con color `arsen-acid` o borde activo.
- Dias sin entrenamiento se muestran atenuados y disabled.
- El sheet conserva estilo movil oscuro de la app.
- Debe tener `aria-label` por fecha y estado.

Al seleccionar una fecha:

1. Se cierra el calendario.
2. Se navega a una vista/pagina de historial por fecha.
3. Ruta recomendada: `/progreso/historial/:date`.
4. La pagina lista sesiones de esa fecha.
5. Cada sesion muestra rutina, dia, volumen, mejor serie, ejercicios y series.
6. Tocar sesion despliega ejercicios hechos y sus series/drop sets.
7. Desde la sesion desplegada se conserva edicion actual de serie/sesion.

La agrupacion interna sigue:

```txt
Fecha -> WorkoutSession -> ExerciseLog -> SetLog -> DropSetLog
```

Se conserva esa estructura y se verifica con pruebas.

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

El boton `Historial` ya no cambia un panel inline. Abre el sheet de calendario.

Comportamiento:

- Abre calendario.
- Permite elegir solo fechas entrenadas.
- Navega a `/progreso/historial/:date`.
- La pagina de historial por fecha permite abrir detalle de sesion y editar.

### Boton Score

`Score` queda como vista por defecto y conserva grafica actual.

## Arquitectura

Unidades nuevas o modificadas:

- `domains/routine/pages/RoutineDayDetailPage.tsx`
- `domains/routine/repository.ts`: helper para cargar dia por id con rutina y ejercicios.
- `domains/workout/components/EditSetSheet.tsx`
- `shared/calculations/warmups.ts`: calculo puro de protocolos.
- `domains/workout/services.ts`: actualizar, agregar y borrar drop sets desde edicion.
- `domains/progress/components/TrainingCalendarSheet.tsx`.
- `domains/progress/pages/ProgressHistoryDatePage.tsx`.
- `domains/progress/repository.ts`: fechas entrenadas, mejores marcas y sesiones por fecha.
- `domains/progress/pages/ProgressPage.tsx`: modo interno `score | bests`; historial abre calendario.

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
- Navegacion de ejercicio actual omite ejercicios `done`.

Pruebas de integracion Dexie:

- Cambiar rutina activa desde servicio.
- Boton `>` registra skip y avanza al siguiente no hecho.
- Boton `<` vuelve al anterior no hecho sin borrar logs.
- Editar serie con drop sets actualiza, agrega y elimina drops correctamente.
- Sesiones por fecha devuelven solo dias entrenados.
- Detalle de sesion agrupa ejercicios, series y drop sets.

Pruebas UI:

- `/entreno` muestra boton compacto de rutina/dia en header.
- `/entreno` muestra flechas laterales en ejercicio actual.
- `/entreno` edita serie y drop sets con sheet.
- `/rutina/dia/:dayId` renderiza resumen y despliega detalle de ejercicio.
- Editor de ejercicio muestra select de protocolo y no muestra `Peso kg` ni `Warmups`.
- Editor de ejercicio muestra descripcion de calentamiento en sheet.
- `/progreso` no muestra `Sesiones recientes` en principal.
- Boton `Historial` abre calendario.
- Calendario solo permite fechas entrenadas.
- `/progreso/historial/:date` muestra sesiones y permite desplegar detalle.

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
