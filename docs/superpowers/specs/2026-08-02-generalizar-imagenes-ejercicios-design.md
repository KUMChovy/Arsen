# Generalizar Imagenes De Ejercicios

## Objetivo

Arsen debe mostrar la imagen definida para cada ejercicio desde el catalogo, tanto al gestionar rutina como al entrenar. Cuando no exista una imagen especifica, la app debe usar un fallback estable por musculo o por tipo seguro, sin mostrar una imagen incorrecta solo porque el `mainMuscle` coincida.

## Alcance

- Agregar una biblioteca visual al editor de catalogo.
- Permitir elegir una imagen incluida del sprite actual.
- Permitir subir una imagen personalizada por ejercicio de catalogo.
- Propagar la referencia visual del catalogo a recetas de rutina y snapshots de entrenamiento.
- Conservar la referencia visual al crear, editar, duplicar, importar y exportar.
- Mejorar el acomodo visual de las imagenes en cards moviles de `/rutina` y `/entreno`.

No se incluye cropper manual, editor de imagen ni descarga de assets remotos.

## Modelo De Datos

Se agregara una tabla `exerciseAssets` en IndexedDB para imagenes personalizadas:

- `id`
- `name`
- `mimeType`
- `dataUrl`
- `createdAt`
- `updatedAt`

`dataUrl` permite que respaldos JSON y exportaciones de rutina conserven la imagen sin archivos externos.

`ExerciseCatalogItem` conserva `assetKind` para las imagenes incluidas. Tambien tendra `customAssetId: string | null` para una imagen personalizada offline.

`RoutineExercise` tendra `assetKind: string | null` y `customAssetId: string | null`. Ambos se copiaran desde el catalogo cuando se agrega a un dia. Esta copia evita que la imagen se pierda cuando las vistas ya no consultan el catalogo.

`ExerciseSnapshot` guardara `assetKind` y `customAssetId` al crear logs de entrenamiento. Esto mantiene el significado historico de la sesion aunque luego se edite o elimine el ejercicio original.

La prioridad de resolucion sera:

1. Imagen personalizada valida.
2. `assetKind` incluido valido.
3. Fallback por `mainMuscle` normalizado.
4. Fallback seguro `press`.

## Biblioteca Visual

El editor de catalogo tendra al final un boton de imagen con preview y estado actual. Ese boton abre un sheet de biblioteca visual con previews reales:

- `Auto`: no fuerza imagen incluida y permite fallback por musculo.
- `Press`
- `Pec deck`
- `Remo`
- `Hack`
- `Jalon`
- `Hombro`
- `Imagen propia`

Al elegir imagen propia, el usuario podra subir un archivo local. La app mostrara preview y una recomendacion de encuadre: `512 x 512 px`, formato cuadrado, sujeto centrado y margen visual aproximado de `48-64 px`.

La imagen subida se guardara localmente en IndexedDB como `dataUrl`. Se aceptaran imagenes mayores, pero la UI las mostrara en un marco cuadrado con `object-fit: cover` para preservar estabilidad mobile. Para evitar respaldos excesivos, el editor rechazara imagenes claramente pesadas con un mensaje breve.

## Rutina Y Entreno

Las cards de `/rutina`, `/rutina/dia/:dayId` y `/entreno` usaran una sola forma de resolver arte:

- ejercicios de rutina: su referencia visual copiada;
- catalogo: su referencia visual original;
- entrenamiento actual/listas: la referencia visual de `RoutineExercise`;
- snapshots futuros: la referencia visual guardada al crear el log.

Las vistas no deben inferir imagen por `canonicalName` o por `mainMuscle` si existe una referencia visual explicita.

## Importacion, Exportacion Y Duplicado

Duplicar rutina, dia o ejercicio conservara los campos visuales existentes.

El respaldo completo incluira `exerciseAssets`.

La exportacion de una rutina incluira `exerciseAssets` usados por sus ejercicios, para que importar esa rutina restaure las cards con el mismo arte.

Los imports legacy sin campos visuales seguiran siendo validos y caeran al fallback.

## UI Y Layout

`ExerciseArt` sera el punto unico de render:

- marco cuadrado estable;
- borde violeta y fondo oscuro como en el sistema actual;
- imagen incluida por sprite con posicion controlada;
- imagen personalizada con `object-fit: cover`;
- tamanos fijos en rows para evitar saltos de layout.

Las cards mantendran columnas fijas (`52px` en rows y `72px` en ejercicio actual) y texto truncado. El cambio visual debe mejorar el encuadre sin convertir las cards en bloques mas altos o inestables.

Las entradas con imagen junto a texto deben separar ambos grupos con un gap claro y consistente. El arte debe quedar centrado opticamente dentro de su marco cuadrado, especialmente en el ejercicio actual de `/entreno`, donde hay un marco exterior.

En el modo editar de `/rutina`, la lista "Ejercicios del dia" debe seguir compacta. Para evitar que se sienta amontonada, el row reduce el peso visual de grip, arte y acciones, conserva los tres botones como iconos y muestra la recomendacion como linea ligera en vez de badge dominante.

## Validacion Y Errores

La subida aceptara archivos de imagen (`image/*`). Si el archivo no puede leerse, el editor mostrara un mensaje breve y no guardara cambios parciales.

Las referencias visuales desconocidas se trataran como ausentes. No deben romper imports ni pantallas.

## Pruebas

- Servicio de rutina: crear/editar catalogo conserva `assetKind` y referencia personalizada.
- Agregar desde catalogo a dia copia la referencia visual.
- Crear log de entrenamiento guarda la referencia visual en snapshot.
- Import schemas aceptan campos visuales nuevos y legacy.
- Exportar e importar una rutina conserva los assets personalizados usados por esa rutina.
- UI: `ExerciseArt` prioriza imagen personalizada, luego `assetKind`, luego musculo, luego fallback.
- Build y test suite completa antes de cerrar.
