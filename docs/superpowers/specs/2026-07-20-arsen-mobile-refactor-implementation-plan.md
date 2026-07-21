# Arsen Mobile Refactor Implementation Plan

Spec base: `docs/superpowers/specs/2026-07-20-arsen-mobile-refactor-design.md`

Regla de trabajo: no hacer commits automaticamente.

## Objetivo

Implementar el refactor movil de Arsen en 3 entregas:

1. Entreno limpio.
2. Rutina y catalogo con separacion base/receta.
3. Progreso, historial, alertas y exportacion.

Cada entrega debe cerrar con tests relevantes y `pnpm test`. Al final correr `pnpm build`.

## Preparacion

1. Revisar estado git y no tocar cambios no relacionados.
2. Instalar `sweetalert2` si no existe.
3. Elegir libreria drag and drop compatible con React 19. Preferencia: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.
4. Generar 6 imagenes musculares con `imagegen` y copiarlas a `src/assets/`.
5. Crear utilidades compartidas:
   - `src/domains/routine/utils/muscles.ts`
   - `src/domains/routine/utils/dominantMuscle.ts`
   - `src/shared/utils/alerts.ts`
   - `src/shared/components/Sheet.tsx`
   - `src/shared/calculations/progression.ts`

## Entrega 1: Entreno Limpio

### Archivos Principales

- `src/domains/workout/pages/WorkoutPage.tsx`
- `src/domains/workout/components/RegisterSetSheet.tsx`
- `src/domains/workout/hooks.ts`
- `src/shared/calculations/progression.ts`

### Pasos

1. Quitar estado y UI de fecha editable en `/`.
2. Quitar estado y UI de notas de sesion en `/`.
3. Quitar estado, efectos y UI de descanso.
4. Quitar pseudo-tabs `Plan`, `Descanso`, `Notas`, `Historial`.
5. Ajustar `RegisterSetSheet` para no devolver ni iniciar descanso.
6. Crear calculo puro de recomendaciones de subida de peso por `routineExerciseId`.
7. Mostrar bloque compacto `Listo para subir peso` arriba del progreso del dia.
8. Mantener resumen diario, ejercicio actual, calentamientos y lista de ejercicios.

### Tests

- Actualizar `WorkoutPage.test.tsx`.
- Actualizar `RegisterSetSheet.test.tsx`.
- Agregar tests de `shared/calculations/progression.test.ts`.
- Verificar que `/` no renderiza fecha, notas ni descanso.

## Entrega 2: Rutina Y Catalogo

### Archivos Principales

- `src/domains/routine/types.ts`
- `src/db/schema.ts`
- `src/db/seedDemoRoutine.ts`
- `src/domains/routine/services.ts`
- `src/domains/routine/repository.ts`
- `src/domains/routine/pages/RoutinePage.tsx`
- `src/domains/routine/components/CatalogExerciseEditorSheet.tsx`
- `src/domains/routine/components/RoutineExerciseRecipeSheet.tsx`
- `src/shared/components/ExerciseArt.tsx`
- `src/shared/validation/arsenImportSchemas.ts`

### Pasos De Datos

1. Definir union `MuscleGroup` con 6 valores aprobados.
2. Normalizar catalogo a musculos aprobados.
3. Ajustar `ExerciseCatalogItem` para no depender de series/reps/RIR como campos editables.
4. Mantener `RoutineExercise` como receta por dia con series/reps/RIR.
5. Crear schema Dexie version `2` si se agregan campos o indices.
6. Mantener compatibilidad con respaldos/version 1.
7. Actualizar zod schemas para import/export.

### Pasos De UI

1. Rehacer `ExerciseArt` para recibir `muscle` o `assetKind` muscular.
2. Agregar imagen dominante en cards de dia con `dominantMuscle`.
3. En `Ver`, permitir seleccionar un dia y mostrar detalle solo lectura.
4. En `Editar`, reemplazar flechas por drag and drop para dias.
5. En `Editar`, reemplazar flechas por drag and drop para ejercicios.
6. Cambiar `+ Ejercicio` para abrir selector de catalogo.
7. Desde selector: buscar, agregar existente o crear catalogo nuevo.
8. Al agregar ejercicio a dia, abrir sheet de receta.
9. En `Catalogo`, agregar crear/editar/eliminar ejercicio base.
10. Quitar botones repetidos `Crear rutina` y `Subir JSON` del fondo.
11. Mover crear/importar/exportar rutina a menu contextual junto a selector.

### Tests

- Catalogo no edita series/reps/RIR.
- Agregar ejercicio de catalogo a dia pide receta.
- Mismo ejercicio puede existir en dos dias con distinta receta.
- Musculo dominante escoge imagen correcta.
- Drag and drop persiste orden.
- Import/export conserva recetas e historial.

## Entrega 3: Progreso, Historial, Alertas Y Export

### Archivos Principales

- `src/domains/progress/pages/ProgressPage.tsx`
- `src/domains/progress/repository.ts`
- `src/domains/progress/components/SessionDetailSheet.tsx`
- `src/domains/progress/components/EditSetSheet.tsx`
- `src/domains/settings/services.ts`
- `src/domains/workout/services.ts`
- `src/shared/utils/alerts.ts`

### Pasos Historial

1. Compactar lista de sesiones recientes.
2. Crear sheet de detalle de sesion agrupado por ejercicio.
3. Mostrar series principales y drop sets relacionados.
4. Crear sheet de edicion de serie/sesion.
5. Permitir editar fecha de sesion.
6. Permitir cambiar dia/rutina de la sesion.
7. Permitir cambiar ejercicio asociado de la serie.
8. Si cambia ejercicio, mover serie a `ExerciseLog` correcto o crear uno.
9. Recalcular estados de ejercicios al editar o mover series.

### Pasos SweetAlert2

1. Crear `shared/utils/alerts.ts` con helpers:
   - `confirmDanger`
   - `showSuccess`
   - `showError`
   - `confirmImportReplace`
2. Reemplazar `window.confirm`.
3. Reemplazar `window.prompt`.
4. Usar sheets propios para edicion compleja.
5. Mockear helpers en tests.

### Pasos Export

1. Revisar `buildProgressExport`.
2. Garantizar orden cronologico global por fecha, rutina, dia, ejercicio y serie.
3. Incluir IDs necesarios para reconstruir relaciones.
4. Mantener graph points globales por `canonicalName`.
5. Incluir main sets y drop sets.
6. Confirmar que varias rutinas quedan conectadas.

### Tests

- Historial compacto abre detalle correcto.
- Editar serie actualiza peso/reps/RIR.
- Cambiar fecha mantiene relacion.
- Cambiar ejercicio mueve set a log correcto.
- Export JSON/CSV cronologico global.
- SweetAlert2 reemplaza confirmaciones destructivas.

## Verificacion Final

1. `pnpm test`
2. `pnpm build`
3. Revisar UI en ancho movil pequeno.
4. Confirmar offline no rompe IndexedDB ni service worker.
5. Revisar que no haya `window.confirm` ni `window.prompt`.
6. Revisar que no haya botones duplicados de crear rutina/importar JSON.
7. Revisar que `/` no tenga fecha, notas ni descanso.

## Riesgos

- Drag and drop puede requerir ajustes tactiles en movil.
- Migracion DB debe conservar datos existentes.
- SweetAlert2 aumenta bundle; cargar helpers de forma diferida si pesa demasiado.
- Generar imagenes raster exige copiar assets finales al workspace.
- Editar dia/rutina de una sesion historica puede crear relaciones inconsistentes si no se recalculan logs y estados.

## Orden De Implementacion Recomendado

1. Instalar dependencias necesarias.
2. Crear utilidades base y tests puros.
3. Entrega 1 completa.
4. Generar imagenes musculares.
5. Entrega 2 completa.
6. Entrega 3 completa.
7. Verificacion final.

