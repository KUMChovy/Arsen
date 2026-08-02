# Calculo De Peso Por Equipo

## Objetivo

Hacer que Arsen explique la carga registrada segun el equipo del ejercicio, sin cambiar la velocidad del flujo de entreno ni romper datos offline existentes.

El usuario registra peso durante `/entreno`, pero hoy la app no distingue entre discos, barra, peso total o peso por lado. Esta entrega agrega una explicacion compacta cuando aporta claridad:

- Barra: peso ingresado como discos, peso total estimado con barra y peso por lado.
- Equipo dividido: peso por lado.
- Equipo de punto unico: sin division.

## Decisiones Aprobadas

- La configuracion vive por ejercicio, no por tipo global de equipo.
- `Polea` se renombra a `Maquina de polea`.
- La compatibilidad con `Polea` legacy se mantiene en imports, datos existentes y snapshots historicos.
- Para barra, el peso ingresado significa carga en discos sin barra.
- Para barra, el peso de la barra es editable por ejercicio, con 20 kg por defecto.
- Para equipos divididos no barra, el peso ingresado significa peso total a dividir.
- Mancuerna queda como punto unico por defecto, no dividida.
- Catalogo y receta del dia permiten configurar la carga; la receta puede corregir lo heredado del catalogo.
- La nota aparece en `/entreno` cuando aplica.
- La unidad preferida kg/lb se respeta en etiquetas y calculos.

## Modelo De Datos

`Equipment` queda como:

```ts
type Equipment = 'Barra' | 'Mancuerna' | 'Maquina' | 'Maquina de polea' | 'Peso corporal' | 'Otro'
```

Se agrega una configuracion simple por ejercicio:

```ts
type LoadMode = 'single' | 'split'
```

Campos nuevos:

- `RoutineExercise.loadMode`
- `RoutineExercise.barWeightKg`
- `ExerciseCatalogItem.loadMode`
- `ExerciseCatalogItem.barWeightKg`

`barWeightKg` siempre se guarda en kg. Para equipos que no son barra se conserva como `0`; no participa en calculos.

Defaults:

| Equipo | `loadMode` | `barWeightKg` |
|---|---:|---:|
| Barra | `split` | 20 |
| Mancuerna | `single` | 0 |
| Maquina | `single` | 0 |
| Maquina de polea | `single` | 0 |
| Peso corporal | `single` | 0 |
| Otro | `single` | 0 |

## Compatibilidad Y Migracion

Se agrega una normalizacion de equipo:

- `Polea` se normaliza a `Maquina de polea`.
- Valores desconocidos se tratan como `Otro`.

La normalizacion se usa al crear, editar, importar y leer datos legacy cuando entren a la UI o a calculos. La migracion Dexie agrega los campos nuevos a `routineExercises` y `exerciseCatalog`, y normaliza `Polea` en esas tablas.

Los snapshots historicos de `ExerciseLog` siguen aceptando strings antiguos. Si un snapshot trae `Polea`, se muestra como `Maquina de polea` cuando sea visible. No se requiere reescribir todos los logs historicos para preservar el patron de snapshot.

## Calculo

Se crea un helper puro en `shared/calculations/equipmentLoad.ts`.

Entrada:

- equipo normalizado o legacy;
- modo de carga;
- peso ingresado en kg;
- peso de barra en kg;
- unidad preferida.

Salida:

- lista corta de etiquetas formateadas para UI, o `null` si no aplica.

Reglas:

- Si `equipment === 'Barra'`:
  - `entered = weightKg`
  - `total = weightKg + barWeightKg`
  - `perSide = weightKg / 2`
  - nota: `Discos por lado: {perSide} · Total con barra: {total}`
- Si `loadMode === 'split'` y no es barra:
  - `perSide = weightKg / 2`
  - nota: `Carga por lado: {perSide}`
- Si `loadMode === 'single'`:
  - no hay nota.
- Si el peso no es finito o es menor o igual a 0:
  - no hay nota.

Todos los valores se formatean con `formatWeight` y por tanto respetan kg/lb.

## UI

### Catalogo

El editor de ejercicio del catalogo agrega:

- selector de equipo con `Maquina de polea` en lugar de `Polea`;
- control segmentado compacto `Carga` con opciones `Punto unico` y `Por lado`;
- input `Barra` cuando el equipo sea `Barra`, etiquetado con la unidad preferida.

Al cambiar equipo, los defaults se actualizan solo si el usuario no ha editado manualmente la carga en esa apertura del sheet.

### Receta Del Dia

El sheet de receta agrega los mismos controles de carga. Al agregar desde catalogo hereda `loadMode` y `barWeightKg`; al editar receta, conserva sus propios valores.

### Entreno

En `/entreno`, la card `Ejercicio actual` muestra una nota compacta debajo del bloque de stats cuando el helper devuelva contenido. Esa nota usa `currentWeightKg`, es decir el peso anterior o ultimo peso principal guardado para ese ejercicio.

El sheet `Registrar` muestra la misma nota debajo del input de peso, recalculada con el valor que el usuario esta escribiendo. Esa es la fuente que cumple la lectura literal de "peso ingresado" al capturar una nueva serie.

Ejemplos:

- `Discos por lado: 20 kg · Total con barra: 60 kg`
- `Carga por lado: 40 kg`

La nota usa texto pequeno, borde sutil y color `arsen-purple2`, dentro de la card existente para no agregar una nueva superficie. No aparece para punto unico.

## Arquitectura

Unidades nuevas o modificadas:

- `domains/routine/types.ts`: `Equipment`, `LoadMode`, campos nuevos.
- `shared/calculations/equipmentLoad.ts`: normalizacion, defaults y etiquetas.
- `db/schema.ts`: version nueva para campos y `Polea` legacy.
- `shared/validation/arsenImportSchemas.ts`: aceptar `Polea`, transformar a `Maquina de polea`, default de campos nuevos.
- `domains/routine/services.ts`: normalizar y aplicar defaults al crear/editar.
- `domains/routine/importExport.ts`: limpiar valores legacy al importar/exportar.
- `db/seedDemoRoutine.ts`: inferir `Maquina de polea` para poleas/jalones.
- `domains/routine/pages/RoutinePage.tsx`: controles de carga en catalogo y receta.
- `domains/workout/pages/WorkoutPage.tsx`: nota de carga en ejercicio actual.
- `domains/workout/components/RegisterSetSheet.tsx`: nota viva con el peso que el usuario esta escribiendo.
- `domains/workout/types.ts`: snapshot puede conservar campos de carga para nuevos logs.
- `domains/workout/services.ts`: copiar campos de carga al snapshot.

Se mantiene:

- almacenamiento de peso siempre en kg;
- conversiones via `shared/utils/weight.ts`;
- acceso Dexie dentro de servicios/repositorios;
- componentes sin calculos de carga inline;
- historiales legibles aunque el ejercicio de rutina cambie despues.

## Testing

Pruebas unitarias:

- normaliza `Polea` a `Maquina de polea`;
- aplica defaults por equipo;
- calcula barra con discos, total y por lado;
- calcula maquina dividida por lado;
- no muestra nota para punto unico;
- respeta lb usando `formatWeight`.

Pruebas de validacion/import:

- rutina o backup con `Polea` importa como `Maquina de polea`;
- datos sin `loadMode` ni `barWeightKg` reciben defaults.

Pruebas UI:

- `/entreno` muestra nota de barra con unidad preferida;
- `/entreno` muestra nota de equipo dividido;
- `/entreno` no muestra nota para mancuerna punto unico;
- `RegisterSetSheet` recalcula la nota cuando cambia el peso ingresado;
- editor de catalogo/receta muestra `Maquina de polea` y controles de carga.

## Fuera De Alcance

- Pantalla global de configuracion por equipo.
- Diferentes barras guardadas como entidades reutilizables.
- Inventario de discos disponibles.
- Calculo de combinaciones de discos.
- Cambiar el significado historico de series ya guardadas.
- Sincronizacion o backend.
