# Arsen Mobile Refactor Design

## Objetivo

Refinar Arsen como app movil-first de entrenamiento, manteniendo su base offline con React, Dexie e IndexedDB. El cambio se implementara en 3 entregas para reducir riesgo:

1. Entreno limpio.
2. Rutina y catalogo separados por responsabilidades.
3. Progreso, historial, alertas y exportacion.

No se debe hacer commit automaticamente. El usuario revisara esta spec antes de pasar a plan e implementacion.

## Decisiones Aprobadas

- La ruta `/` debe ser directa para entrenar, sin selector de fecha, notas ni descanso.
- El descanso se elimina por completo de la UI de entreno.
- La fecha e historial se gestionan desde `/progreso`.
- El catalogo sera editable y no llevara series, reps ni RIR.
- Series, reps, RIR, descanso, calentamiento, peso actual y progresion pertenecen a la receta del ejercicio dentro de un dia de rutina.
- Un mismo ejercicio puede existir en dos o mas dias con recetas distintas.
- La grafica global une el mismo ejercicio por `canonicalName`.
- El aviso de subir peso se separa por receta de dia, usando `routineExerciseId`.
- Drop sets no cuentan para decidir si se debe subir peso.
- Confirmaciones, prompts y alertas principales usaran SweetAlert2.
- Se generaran imagenes por grupo muscular con `imagegen` durante implementacion, no durante brainstorming.

## Entrega 1: Entreno

### Cambios De UI

La pagina `/` queda enfocada solo en ejecutar el entrenamiento del dia:

- Header con rutina activa y dia detectado.
- Bloque compacto de recomendaciones para subir peso, si existen.
- Progreso del dia.
- Resumen diario: series principales, drop sets y volumen.
- Ejercicio actual.
- Calentamientos sugeridos como referencia.
- Lista de ejercicios del dia.
- Sheet para registrar serie, agregar drop set opcional o saltar ejercicio.

Se elimina:

- Selector de fecha visible.
- Notas personales de sesion.
- Temporizador y cualquier UI de descanso.
- Pseudo-tabs `Plan`, `Descanso`, `Notas`, `Historial`.

### Datos

`restSeconds` puede seguir existiendo en la receta del ejercicio para referencia o futuras funciones, pero no se renderiza ni dispara temporizador.

### Criterios

- Registrar serie sigue creando o continuando sesion para el dia actual.
- Guardar serie no inicia descanso.
- UI principal no muestra fecha editable ni notas.
- Aviso de subir peso aparece solo cuando hay datos suficientes.

## Entrega 2: Rutina Y Catalogo

### Modelo Conceptual

`ExerciseCatalogItem` representa el ejercicio base:

- `name`
- `canonicalName`
- `mainMuscle`
- `equipment`
- `aliases`
- `assetKind` con identificador de imagen muscular
- notas generales opcionales

`RoutineExercise` representa la receta de ese ejercicio en un dia:

- `sourceExerciseId`
- snapshot de nombre, musculo y equipo
- `targetSets`
- `repRange`
- `recommendedRir`
- `restSeconds`
- `warmupSets`
- `warmupProtocol`
- `progression`
- `technicalNotes`
- `currentWeightKg`
- `order`

El catalogo no debe mostrar ni editar series, reps ni RIR. Esos campos se editan al agregar o editar el ejercicio dentro del dia de rutina.

### Musculos Permitidos

El campo de musculo sera selector fijo:

- Pecho
- Espalda
- Hombros
- Brazos
- Abdomen
- Piernas

Este selector se usara en catalogo, editor de ejercicio y calculo de imagen dominante.

### Modo Ver

La pestaña `Ver` conserva la vision general, pero mejora interaccion:

- Selector de rutina activa arriba.
- Cards de dias.
- Imagen principal de cada dia segun musculo dominante.
- Al seleccionar un dia, se muestra detalle solo lectura:
  - nombre y descripcion
  - musculo dominante
  - lista completa de ejercicios
  - musculo, equipo, series, reps, RIR, peso actual
  - notas tecnicas o progresion si existen

### Imagen Dominante Del Dia

Se calcula contando ejercicios por `mainMuscle` dentro del dia:

1. Musculo con mayor cantidad gana.
2. Si hay empate, gana el primer musculo dominante segun orden de ejercicios.
3. Si el dia no tiene ejercicios, usar imagen generica o primera imagen disponible.

### Modo Editar

Se reemplazan flechas por drag and drop:

- Dias reordenables por arrastre.
- Ejercicios del dia reordenables por arrastre.
- Botones de flecha se eliminan.
- Acciones de borrar/duplicar dia se mantienen como botones claros o menu de accion.

`+ Ejercicio` abre selector de catalogo:

- buscar por nombre, musculo o equipo
- agregar ejercicio existente al dia
- si no existe, crear ejercicio nuevo en catalogo
- al agregar, abrir receta de dia para series, reps, RIR, descanso, calentamiento, peso y notas

### Modo Catalogo

El catalogo se vuelve fuente editable:

- Crear ejercicio.
- Editar ejercicio base.
- Eliminar ejercicio base.
- Buscar y filtrar.
- Botones editar/eliminar viven directamente en cada item del catalogo.
- No hay campos de series/reps/RIR.

Eliminar del catalogo no debe borrar ejercicios ya agregados a rutinas. Las rutinas conservan snapshot de nombre, musculo y equipo para no romper historial ni estructura.

### Acciones De Rutina

Se quitan botones repetidos de `Crear rutina` y `Subir JSON` del fondo de la pagina.

Crear, importar y exportar rutina quedan en un menu contextual junto al selector de rutina.

No deben duplicarse en varias secciones.

### Imagenes Musculares

Se generaran 6 assets raster con `imagegen`:

- `muscle-chest`
- `muscle-back`
- `muscle-shoulders`
- `muscle-arms`
- `muscle-core`
- `muscle-legs`

Estilo:

- oscuro
- atletico
- premium
- sin texto
- usable en cards pequenas
- coherente con paleta actual

Los archivos finales se guardaran dentro de `src/assets/` y el componente de arte los consumira por musculo.

## Entrega 3: Progreso, Historial Y Alertas

### Historial Menos Pesado

La pagina `/progreso` mantiene tabs actuales, pero el historial se simplifica:

- Lista compacta de sesiones recientes.
- Cada sesion muestra fecha, rutina, dia, volumen, mejor serie y cantidad de ejercicios.
- Al tocar una sesion se abre detalle.
- Detalle agrupa por ejercicio.
- Cada ejercicio muestra sus series principales y drop sets relacionados.

### Modal De Edicion

Se reemplaza `window.prompt` por sheet/modal propio para editar datos reales:

- fecha de sesion
- dia/rutina asociado
- ejercicio asociado de la serie
- peso
- reps
- RIR
- borrar serie

Si el usuario cambia dia o ejercicio:

- se actualiza o crea el `ExerciseLog` necesario
- se mueve la serie al log correcto
- se conserva historial por IDs y snapshot

### Exportar Progreso

La exportacion debe ser cronologica y conectar rutinas distintas:

- Orden global por fecha, rutina, dia, ejercicio y serie.
- Incluye todas las rutinas, no solo la activa.
- Graph points globales unen por `canonicalName`.
- Mantiene IDs para reconstruir relacion:
  - `routineId`
  - `dayId`
  - `sessionId`
  - `exerciseLogId`
  - `setLogId`
  - `sourceExerciseId`

CSV y JSON deben incluir main sets y drop sets. Drop sets suman volumen, pero no afectan aviso de subir peso.

### Aviso Para Subir Peso

El sistema recomienda subir peso por `routineExerciseId`, no por catalogo global.

Regla inicial:

- Revisar ultimas 2 sesiones de esa receta.
- Contar solo series principales.
- Debe completar al menos `targetSets`.
- Las reps deben estar en la parte alta o por encima del rango.
- RIR debe indicar margen suficiente segun `recommendedRir`.
- Drop sets se ignoran.

Interpretacion de rango:

- `repRange` como `8-10`: limite alto = `10`.
- RIR recomendado como `1-2`: suficiente si las series clave quedan en `2` o mas.
- Si el formato no se puede leer, no mostrar recomendacion.

Sugerencia inicial de incremento:

- Barra o maquina: +2.5 kg.
- Mancuerna o polea: +1 a +2 kg.
- Peso corporal u otro: sugerir aumentar reps, control o carga externa.

La recomendacion debe explicar motivo:

- ejercicio
- dia
- peso actual
- evidencia de ultimas 2 sesiones
- incremento sugerido

### SweetAlert2

SweetAlert2 reemplaza:

- `window.confirm`
- `window.prompt`
- errores y exitos importantes
- borrado de rutina, dia, ejercicio, catalogo, sesion y serie
- importacion con reemplazo
- limpieza de logs

Para formularios complejos se usaran sheets/modales propios, no SweetAlert2 con muchos inputs.

## Arquitectura Propuesta

Nuevas o modificadas unidades:

- `shared/utils/alerts.ts` para SweetAlert2.
- `shared/components/Sheet` para modales moviles reutilizables.
- `domains/routine/components/CatalogExerciseEditorSheet.tsx`.
- `domains/routine/components/RoutineExerciseRecipeSheet.tsx`.
- `domains/routine/utils/muscles.ts`.
- `domains/routine/utils/dominantMuscle.ts`.
- `shared/calculations/progression.ts`.
- `domains/progress/components/SessionDetailSheet.tsx`.
- `domains/progress/components/EditSetSheet.tsx`.

Reglas React:

- Mantener rutas lazy.
- Cargar SweetAlert2 de forma diferida cuando sea posible.
- Evitar componentes inline nuevos en listas grandes.
- Usar `Map` para agrupar logs y sets.
- Mantener calculos de progresion como funciones puras testeables.

## Migracion De Datos

La DB actual usa schema version `1`. La implementacion creara schema version `2`.

Reglas:

- agregar campos persistentes nuevos como opcionales cuando sea posible;
- crear indices nuevos solo si las consultas de progreso o catalogo lo requieren;
- mantener compatibilidad con datos existentes;
- normalizar musculos del seed y catalogo a los 6 valores permitidos;
- no borrar historial.

## Testing

Pruebas nuevas o actualizadas:

- Catalogo no guarda series/reps/RIR.
- Crear ejercicio de catalogo y agregarlo a un dia crea receta con series/reps/RIR.
- Mismo ejercicio puede existir en dos dias con recetas distintas.
- Musculo dominante escoge imagen correcta.
- Drag and drop persiste orden de dias y ejercicios.
- Progresion recomienda subir peso solo por `routineExerciseId`.
- Drop sets no afectan progresion.
- Export progreso mantiene orden cronologico global y relacion entre rutinas.
- SweetAlert2 helpers se mockean en tests de acciones destructivas.
- `/` no muestra selector de fecha, notas ni descanso.

## Fuera De Alcance

- Capacitor.
- Sincronizacion cloud.
- Autenticacion.
- Configuracion avanzada de incrementos por usuario.
- Planificador semanal nuevo.
