# Imagenes V2 Y Selector Movil Por Musculo

## Objetivo

Reemplazar el sistema visual basado en sprites por imagenes locales incluidas en el build, referenciadas con IDs estables, y convertir el selector de imagen del catalogo personal en un bottom sheet compacto, buscable y filtrable por grupo muscular.

La app sigue siendo PWA mobile-first, 100% offline y sin backend. Las imagenes personalizadas existentes en `exerciseAssets` se conservan tal como estan: `dataUrl` en IndexedDB y referencia por `customAssetId`.

## Alcance

Incluido:

- Eliminar imports, renderizado y archivos de `arsen-exercise-sprite.png` y `arsen-muscle-groups-sprite.png` cuando no queden referencias.
- Registrar imagenes incluidas desde `src/assets/ejercicios/` y fallbacks musculares desde `src/assets/musculos/`.
- Agregar `bundledAssetId` opcional y retrocompatible a catalogo, recetas de rutina y snapshots historicos.
- Resolver arte con la prioridad: imagen personalizada, imagen incluida, imagen de musculo, placeholder neutral.
- Redisenar `ExerciseImageSelector` como selector movil definitivo con busqueda y filtros por musculo.
- Mantener backups legacy que solo tengan `assetKind` y `customAssetId`.
- Cubrir registro de assets, fallback, filtros, propagacion e importacion con tests.

Fuera de alcance:

- Bloqueo de ejercicios originados en Sinful Shell. Prompt 11 agregara el campo de origen/bloqueo y la UI que deshabilita nombre, musculo, imagen e indicaciones tecnicas.
- Migrar imagenes personalizadas a Blob.
- Cropper, editor de imagen, descargas remotas o dependencias nuevas.

## Modelo De Assets Incluidos

Se creara un registro tipado, por ejemplo `src/shared/assets/exerciseImages.ts`, usando `import.meta.glob` o imports estaticos de Vite.

Cada archivo de ejercicio vive en `src/assets/ejercicios/` y debe seguir la convencion:

```text
<slug-ejercicio>--<slug-musculo>.png
```

Ejemplo:

```text
press-inclinado--pecho.png
```

El delimitador `--` es obligatorio para evitar deducir el musculo desde el ultimo guion. Los musculos validos son:

- `pecho`
- `espalda`
- `hombros`
- `brazos`
- `abdomen`
- `piernas`

El `bundledAssetId` estable sera el slug completo sin extension, por ejemplo `press-inclinado--pecho`. El registro expondra:

```ts
type BundledExerciseAsset = {
  id: string
  url: string
  name: string
  muscle: MuscleGroup
  aliases: string[]
}
```

El nombre visible se derivara del slug de ejercicio con capitalizacion simple en espanol. Una pequena tabla opcional de metadata podra agregar aliases de busqueda sin duplicar el manifiesto completo.

Los fallbacks musculares se resolveran desde:

- `src/assets/musculos/pecho.png`
- `src/assets/musculos/espalda.png`
- `src/assets/musculos/hombros.png`
- `src/assets/musculos/brazos.png`
- `src/assets/musculos/abdomen.png`
- `src/assets/musculos/piernas.png`

## Validacion Del Registro

Habra una prueba o script que falle si:

- un archivo no cumple `<slug-ejercicio>--<slug-musculo>.png`;
- el musculo del filename no esta en la lista valida;
- dos archivos producen el mismo `bundledAssetId`;
- falta cualquiera de los seis fallbacks musculares;
- la metadata de aliases apunta a un ID que no existe.

Si se usa metadata explicita para nombres o aliases, no se exigira una entrada por archivo; el filename seguira siendo la fuente minima de verdad.

## Datos Y Compatibilidad

Se agregara:

```ts
bundledAssetId: string | null
```

en:

- `ExerciseCatalogItem`
- `RoutineExercise`
- `ExerciseSnapshot`

El campo es opcional en schemas de importacion/exportacion y tiene default `null`. No se aumenta `CURRENT_SCHEMA_VERSION` de Dexie solo por esta propiedad no indexada y opcional. Si durante la implementacion se cambia un indice o tabla, entonces se hara migracion segura y se documentara el motivo.

`assetKind` permanece para aceptar backups antiguos, pero deja de participar en renderizado de sprites. Un backup antiguo con `assetKind` desconocido no rompe: cae a `customAssetId` si existe, o al fallback muscular.

Al crear o editar un ejercicio de catalogo se guarda `bundledAssetId`. Al agregarlo a un dia, se copia a `RoutineExercise`. Al crear logs, se copia al snapshot historico para preservar el arte usado en esa sesion.

## Resolucion De Imagen

`ExerciseArt` seguira siendo el punto unico de render y aceptara `customImageSrc`, ademas del nuevo `bundledAssetId`.

La prioridad sera:

1. `customImageSrc` si existe.
2. `bundledAssetId` valido.
3. imagen de `mainMuscle` normalizado.
4. placeholder neutral local.

La app nunca hara `fetch` ni llamadas de red para imagenes. Todas las imagenes incluidas entran al bundle de Vite y quedan cacheadas por el service worker generado en produccion.

## Selector Movil

`ExerciseImageSelector` se refactorizara como selector compacto reutilizable dentro del editor de catalogo.

El editor mostrara una fila/preview compacta de la imagen actual con una accion para abrir el selector. La accion `Subir imagen propia` se mantiene separada y visible.

El selector abrira un bottom sheet con:

- altura maxima aproximada de `80-85vh`;
- encabezado sticky con titulo, boton cerrar y buscador;
- chips horizontales: `Todos`, `Pecho`, `Espalda`, `Hombros`, `Brazos`, `Abdomen`, `Piernas`;
- chip inicial igual al musculo actual del ejercicio;
- busqueda por nombre visible, ID y aliases;
- busqueda combinable con filtro muscular;
- grid compacta de 3 columnas, sin overflow horizontal a `360px`;
- miniatura cuadrada, nombre de maximo 2 lineas y estado seleccionado;
- barra inferior fija/compacta con preview de seleccion y accion `Usar imagen`.

Si no hay resultados, el sheet mostrara un estado vacio breve y conservara visible la accion de subir imagen propia.

## Accesibilidad Y Mobile

El selector debe poder usarse con teclado y lector de pantalla:

- botones con `aria-pressed` o estado seleccionado claro;
- input con etiqueta accesible;
- bottom sheet con titulo asociado y boton cerrar etiquetado;
- foco visible usando el estilo global de la app;
- targets tactiles razonables;
- nombres truncados visualmente, pero el boton conserva un nombre accesible completo.

La grid usara tracks estables y `minmax(0, 1fr)` para que nombres largos no empujen columnas ni generen overflow en 360-430 px.

## Pruebas

Tests requeridos:

- registro de assets incluidos valida filenames, musculos, duplicados, fallbacks y metadata;
- `ExerciseArt` prioriza custom > bundled > musculo > placeholder;
- `ExerciseImageSelector` filtra por musculo, busca por nombre/alias y expone seleccion accesible;
- crear/editar catalogo conserva `bundledAssetId`;
- agregar desde catalogo a dia copia `bundledAssetId`;
- crear snapshot de entrenamiento guarda `bundledAssetId`;
- schemas aceptan backups nuevos y legacy con solo `assetKind`/`customAssetId`;
- no queda ningun import ni renderizado de los sprites antiguos.

Verificacion final:

- `pnpm test`
- `pnpm build`

