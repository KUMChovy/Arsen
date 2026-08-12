# Filtros Por Musculo En Selector De Ejercicios De Rutina

## Objetivo

Agregar filtros compactos por musculo al `CatalogPickerSheet` que se abre desde `/rutina` en modo `Editar` al tocar `+ Ejercicio`, para encontrar ejercicios del catalogo personal sin mezclar el flujo de Sinful Shell ni el selector de imagenes.

## Alcance

- Solo cambia el selector de ejercicios usado para agregar un ejercicio del catalogo personal a un dia de rutina.
- No cambia Dexie, backups, tipos persistidos, servicios de guardado, assets ni el flujo de imagenes.
- Sinful Shell se mantiene como una accion separada dentro del sheet y no se mezcla con los resultados filtrados.

## Arquitectura

Se agregara una utilidad pura en el dominio de rutina:

- `src/domains/routine/utils/catalogFilters.ts`
- `CatalogMuscleFilter = MuscleGroup | 'Todos'`
- `catalogMuscleFilters = ['Todos', ...muscleGroups]`
- `filterCatalogByQueryAndMuscle(catalog, query, muscle)`

La utilidad reutilizara `muscleGroups` y `normalizeMuscleGroup` desde `utils/muscles.ts`. Para texto usara una normalizacion compartida basada en `canonicalName` de `src/shared/utils/normalize.ts`, de modo que mayusculas, acentos y espacios no generen falsos negativos. La funcion preservara el orden de entrada del catalogo.

## Comportamiento De Filtrado

El filtro muscular y el buscador se combinan:

- `Todos` + busqueda vacia: devuelve todo el catalogo personal.
- Musculo + busqueda vacia: devuelve ejercicios cuyo `mainMuscle` normalizado coincide con el musculo.
- `Todos` + busqueda: busca en todo el catalogo personal.
- Musculo + busqueda: primero exige coincidencia muscular y despues coincidencia textual.

La busqueda textual preserva el comportamiento existente y lo amplia:

- nombre
- aliases
- musculo principal normalizado
- equipo

No se buscaran ni listaran entradas estaticas de Sinful Shell dentro de estos resultados.

## UI

`CatalogPickerSheet` mantendra arriba las dos acciones separadas:

- `Agregar desde Sinful Shell`
- `Crear ejercicio propio`

Debajo se mostrara:

- buscador
- fila horizontal de chips sin wrap: `Todos`, `Pecho`, `Espalda`, `Hombros`, `Brazos`, `Abdomen`, `Piernas`
- contador discreto, por ejemplo `8 ejercicios`
- resultados existentes con `ExerciseArt`, `customImageSrc`, `bundledAssetId`, musculo, equipo y calentamiento

Los chips tendran altura tactil minima de 40 px, desplazamiento horizontal, estado seleccionado visible, `aria-pressed` y texto completo visible/accesible. El layout debe seguir funcionando de 360 a 430 px sin overflow de pagina.

## Estados

Cada apertura del sheet inicia con:

- busqueda vacia
- musculo `Todos`

`Limpiar filtros` restaura ambos valores y vuelve a mostrar el catalogo completo.

El estado vacio sera especifico:

- con musculo y busqueda: `No hay ejercicios de Pecho que coincidan con "press".`
- con musculo sin busqueda: `No hay ejercicios de Pecho.`
- con `Todos` y busqueda: `No hay ejercicios que coincidan con "press".`
- con `Todos` sin busqueda: `No hay ejercicios en tu catalogo.`

## Seleccion

Seleccionar un ejercicio conserva el comportamiento actual: cierra `CatalogPickerSheet` y abre el formulario de receta del dia con el item elegido. No se modifican `imageSrcByAssetId`, `customAssetId`, `bundledAssetId`, `exerciseAssets` ni la forma de resolver imagenes.

## Pruebas

Agregar pruebas unitarias para `filterCatalogByQueryAndMuscle`:

- `Todos` sin busqueda devuelve todo y conserva orden.
- filtra por musculo usando `normalizeMuscleGroup`.
- busca por nombre y aliases ignorando acentos y mayusculas.
- preserva coincidencias existentes por musculo y equipo.
- combina busqueda con musculo.

Agregar pruebas de componente en `RoutinePage.test.tsx`:

- al abrir `/rutina` -> `Editar` -> `+ Ejercicio`, `Todos` esta seleccionado.
- seleccionar un chip filtra los resultados.
- busqueda y chip funcionan juntos.
- estado vacio muestra mensaje util y `Limpiar filtros`.
- limpiar filtros restaura lista completa.
- seleccionar un resultado sigue abriendo la receta del dia.

## Verificacion

- `pnpm test src/domains/routine/utils/catalogFilters.test.ts`
- `pnpm test src/domains/routine/pages/RoutinePage.test.tsx`
- `pnpm test`
- `pnpm build`
