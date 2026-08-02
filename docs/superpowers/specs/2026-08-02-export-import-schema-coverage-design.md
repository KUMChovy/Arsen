# Cobertura De Exportaciones E Imports

## Objetivo

Actualizar las fronteras de exportacion e importacion para que los cambios recientes de rutina, notas y configuracion de carga viajen en JSON, y para que archivos antiguos sigan importando sin romper datos offline.

## Alcance

Formatos cubiertos:

- Rutina JSON: una rutina con sus dias, ejercicios de dia y objetivos de volumen semanales.
- Backup completo JSON: todas las tablas persistidas en IndexedDB.
- Progreso JSON: resumen, puntos de grafica y timeline cronologico desde sesiones y series.
- Progreso CSV: el mismo timeline de progreso en filas escapadas como CSV.

## Decisiones

- Usar `src/shared/validation/arsenImportSchemas.ts` como frontera compartida de compatibilidad.
- Migrar rutinas antiguas sin rango de reps a `repsMin: 8` y `repsMax: 10`.
- Migrar notas ausentes a cadena vacia.
- Migrar peso actual ausente a `0`.
- Mantener la normalizacion existente de equipo y carga con `loadSettingsForEquipment`.
- No crear una version nueva del formato si los schemas pueden aceptar y transformar datos legacy.

## Cambios

### Rutina JSON

`exportRoutineJson` debe exportar ejercicios con:

- `repsMin`
- `repsMax`
- `technicalNotes`
- `equipment`
- `loadMode`
- `barWeightKg`
- `currentWeightKg`

`importRoutineJson` debe aceptar archivos antiguos sin esos campos y guardar valores normalizados.

### Backup Completo JSON

`exportFullBackup` debe incluir los campos nuevos en `routineExercises` y `exerciseCatalog`, limpiando solo campos legacy ya conocidos.

`backupSchema` debe aceptar backups antiguos y nuevos:

- `routineExercises` recibe defaults de reps, notas, peso y carga.
- `exerciseCatalog` recibe defaults de reps, notas y carga.
- snapshots historicos de `exerciseLogs` toleran datos antiguos sin romper importacion.

### Progreso JSON/CSV

`buildProgressExport` no depende de los campos nuevos de rutina para calcular progreso. Debe seguir generando:

- JSON parseable con `schemaVersion`, `summary`, `graphPoints` y `timeline`.
- CSV con encabezado estable y celdas escapadas.

## Testing

Actualizar `arsenImportSchemas.test.ts` para cubrir:

- rutina nueva con rango, notas y carga;
- rutina antigua sin rango/notas/carga/peso, migrada a defaults;
- backup nuevo con catalogo y ejercicios completos;
- backup antiguo sin campos nuevos, migrado a defaults;
- snapshots antiguos de progreso/logs aceptados.

Agregar o actualizar tests de servicios para progreso cuando sea viable con el setup existente:

- `buildProgressExport` produce JSON serializable;
- CSV mantiene encabezado y escaping.

## Fuera De Alcance

- Cambiar UI de Ajustes o Rutina.
- Cambiar nombres de archivos exportados.
- Reescribir logs historicos existentes fuera del import.
- Agregar dependencias.
