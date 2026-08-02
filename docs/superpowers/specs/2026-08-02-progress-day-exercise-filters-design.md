# Progress Day And Exercise Filters Design

## Objetivo

Simplificar `/progreso` para que deje de tener modos `General` y `Global`. La pantalla debe trabajar con una sola lectura: filtros combinados de dia y ejercicio aplicados a resumen, grafica, mejores marcas, metricas e historial.

## Alcance Aprobado

- Quitar los tabs visibles `General`, `Dia`, `Ejercicio` y `Global`.
- Mantener solo dos filtros visibles y combinables:
  - `Dia`: dia entrenado.
  - `Ejercicio`: `Todos los ejercicios` o un ejercicio historico.
- Cuando existan registros, `Dia` siempre tiene una seleccion activa; `Ejercicio` puede quedar en `Todos los ejercicios` o limitar a uno.
- El historial conserva calendario, pero las fechas disponibles y la pagina por fecha deben respetar los filtros activos.
- La edicion de sesiones y series sigue disponible desde el historial filtrado.
- Import/export y backup no cambian porque exportan tablas completas y timeline historico, no la vista filtrada.

## UX

`/progreso` queda como una superficie compacta de operacion:

- Header: `Rendimiento`, con contexto del filtro actual.
- Card de filtros: dos selects apilados para caber bien en 360px.
- Acciones: `Score`, `Mejores`, `Historial`, `Exportar`.
- `Score` muestra grafica y puntaje del filtro actual.
- `Mejores` muestra marcas del filtro actual.
- Metricas clave se recalculan con el mismo filtro.
- Si no hay datos para la combinacion, se muestra una card vacia clara con texto movil, sin numeros falsos como resultado principal.

No se agregan nuevas vistas ni un sistema de filtros avanzado.

## Datos

`getProgressOverview` ya acepta `dayId` y `canonicalName`; se reutiliza ese contrato y se elimina la distincion de modo.

Cambios de repositorio:

- `getProgressOverview({ dayId, canonicalName })` sigue siendo la fuente de resumen.
- `getTrainingDates(filters)` devuelve solo fechas con sesiones o ejercicios que coinciden con el filtro.
- `getSessionsForDate(date, filters)` devuelve sesiones de la fecha y limita los ejercicios/series al filtro.
- `getSessionDetail(sessionId, filters)` filtra ejercicios por `canonicalName` cuando aplica, para que el detalle inline coincida con lo que el usuario eligio.

El snapshot historico se conserva: el filtro por ejercicio usa `ExerciseLog.snapshot.canonicalName`, no nombres vivos de rutina.

## Historial Y Edicion

Al tocar una fecha del calendario se navega a:

```txt
/progreso/historial/:date?dayId=<id>&exercise=<canonicalName>
```

La pagina de historial:

- Lee los query params.
- Lista solo sesiones que cumplen `dayId` y/o tienen el ejercicio filtrado.
- Al expandir una sesion, muestra solo los ejercicios que cumplen el filtro de ejercicio.
- Mantiene borrar sesion, borrar serie y editar serie.

Si una edicion mueve una serie fuera del filtro actual, esa serie deja de aparecer despues de guardar; esto es esperado porque la vista refleja el filtro.

## Fuera De Alcance

- Cambios de schema Dexie.
- Cambios a import/export/backup.
- Nuevas graficas por tipo de metrica.
- Filtros por rutina, rango de fecha, musculo o equipo.
- Redisenar la pantalla completa fuera de la simplificacion pedida.

## Verificacion

- Test de repositorio para `getSessionsForDate` con `dayId` y `canonicalName`.
- Test de detalle para confirmar que `getSessionDetail` filtra ejercicios por canonical cuando aplica.
- Test existente de import/export debe seguir pasando.
- `pnpm test`.
- `pnpm build`.
- Detector Impeccable sobre archivos UI modificados.
