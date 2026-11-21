# Diseño — Calendario como entrada principal del Historial

## Intención

Hacer que la primera vista del Historial sea el calendario, porque permite ubicar rápidamente los días entrenados sin obligar a recorrer una lista larga.

## Decisiones

- `/historial` inicia en `Calendario` cuando no existe el parámetro `modo`.
- `?modo=list` conserva una entrada explícita a la vista cronológica.
- La lista cronológica se compacta en una fila de tres zonas: fecha, rutina/metadatos y mejor marca.
- Se conservan paginación, filtros, navegación por sesión y los datos clave de series, volumen y ejercicios.
- No cambia el modelo Dexie ni la consulta de historial.

## No objetivos

- No eliminar el calendario ni convertirlo en un selector de fecha separado.
- No cambiar la semántica de filtros, exportaciones o detalle de sesión.
- No guardar una nueva preferencia persistente; el parámetro de URL sigue siendo suficiente.

