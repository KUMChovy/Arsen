# Progress Manual Session Creation Design

## Objetivo

Permitir crear manualmente una sesion de entrenamiento desde `/progreso/historial/:date` para registrar entrenos pasados que no se capturaron en el momento. El flujo vive solo en `/progreso`, no cambia `/entreno`, y reutiliza el guardado existente de workout para que las sesiones creadas entren al historial, calendario, volumen y score igual que una sesion registrada desde el entreno del dia.

## Alcance Aprobado

- Agregar una accion clara `Crear sesion` en la vista de historial por fecha.
- Mostrar esa accion cuando la fecha no tiene sesiones y tambien cuando ya tiene sesiones.
- Permitir que el calendario de progreso seleccione cualquier fecha no futura; si la fecha no tiene sesion, debe abrir directamente el creador para esa fecha.
- Abrir un bottom sheet de creacion dentro del historial por fecha.
- Permitir elegir fecha, rutina, dia y ejercicio usando las opciones de `useProgressEditOptions` / `getProgressEditOptions`.
- Permitir agregar una o mas series, cada una con peso, reps, RIR y drop set opcional.
- Guardar con `registerMainSetForExercise`, que a su vez reutiliza `getOrCreateSessionForDay`, `ensureExerciseLog` y `saveMainSet`.
- Bloquear fechas futuras en el formulario.
- Detectar cuando ya existe una sesion para `date + dayId` y mostrar: `Ya existe una sesion ese dia, se agregara a ella`.
- Mantener intactos los flujos actuales de editar y borrar sesiones/series desde `/progreso`.

## UX

El calendario de progreso deja de ser solo un selector de fechas entrenadas. Las fechas con entreno siguen destacadas en morado y llevan al historial de esa fecha. Las fechas no futuras sin entreno tambien son tocables; al seleccionarlas, la app navega al historial de esa fecha con el creador abierto automaticamente. Las fechas futuras permanecen deshabilitadas.

La pagina de historial por fecha mantiene su estructura compacta:

- Header de fecha existente.
- Accion `Crear sesion` cerca del inicio de la vista, visible antes de la lista.
- Si no hay sesiones, el estado vacio conserva el mensaje y agrega la accion como salida principal.
- Si hay sesiones, la accion funciona como "agregar series olvidadas" sin ocultar edicion/borrado ni sustituir la sesion existente.

El sheet de creacion usa el patron visual existente de Arsen:

- Scrim oscuro y sheet inferior dentro del ancho maximo de 430px.
- Titulo `Crear sesion`.
- Campos apilados para fecha, rutina, dia y ejercicio.
- Aviso contextual cuando la seleccion apunta a una sesion existente.
- Controles numericos densos para peso, reps y RIR.
- Checkbox para activar drop set y campos numericos del drop set.
- Boton para agregar la serie al borrador y boton final `Guardar sesion`.

El usuario debe poder registrar al menos un ejercicio completo sin navegar a `/entreno`. Para mantener el flujo pequeÃ±o, el sheet permite agregar series de un ejercicio seleccionado y cambiar el ejercicio para agregar mas series antes de guardar.

## Datos Y Guardado

No se agrega un camino paralelo de persistencia.

El sheet toma `ProgressEditOptions` como fuente de seleccion:

- `routines` lista todas las rutinas guardadas.
- `days` se filtra por la rutina elegida.
- `exercises` se filtra por el dia elegido.

Para guardar, el flujo resuelve cada `routineExerciseId` a su `RoutineExercise` vivo y llama:

```ts
registerMainSetForExercise({
  date,
  dayId,
  displayUnit,
  dropSet,
  exercise,
  reps,
  rir,
  routineId,
  weightKg,
})
```

La idempotencia de sesion queda en `getOrCreateSessionForDay`, que ya usa el indice `[date+dayId]`. Si existe la sesion, las series nuevas se agregan a esa sesion. Si no existe, se crea una sesion nueva.

La unidad de peso usa la preferencia de settings cuando este disponible; los valores se guardan siempre en kg mediante `unitToKg`, siguiendo la convencion del proyecto.

## Validacion Y Estados

- La fecha inicial es la fecha de la ruta.
- El input de fecha usa como maximo `localDateKey(new Date())`.
- Al guardar, se valida nuevamente que la fecha no sea futura para cubrir cambios manuales o navegadores sin enforcement estricto de `max`.
- El guardado requiere rutina, dia, ejercicio y al menos una serie.
- Si no hay rutinas, dias o ejercicios disponibles, el sheet muestra campos vacios/deshabilitados y no permite guardar.
- Errores de servicio se muestran en el mismo patron de mensaje que ya usa la pagina de historial.
- Al guardar correctamente, el sheet se cierra y la pagina muestra un mensaje de exito.

## Interaccion Con Historial Existente

Los flujos actuales quedan sin redisenar:

- Expandir sesion.
- Editar serie con `EditSetSheet`.
- Mover serie de fecha/rutina/dia/ejercicio.
- Borrar serie.
- Borrar sesion.

El nuevo flujo solo agrega sesiones o series nuevas mediante servicios existentes. No modifica `updateWorkoutSession`, `moveMainSetToExercise`, `updateMainSet`, `deleteMainSet` ni `deleteWorkoutSession` salvo imports necesarios.

Si la vista tiene filtros por `dayId` o `exercise`, la sesion creada aparece solo si coincide con el filtro actual. Si no coincide, el mensaje de exito debe indicar que se guardo, aunque la lista filtrada pueda no mostrarla.

## Pruebas

- Prueba de integracion Dexie: una sesion creada en fecha pasada aparece en `getSessionsForDate`, `getTrainingDates` y `getProgressOverview` con volumen y score calculados.
- Prueba de integracion Dexie: registrar una serie para una combinacion `date + dayId` existente reutiliza el mismo `workoutSession` y no crea duplicado.
- Prueba UI del sheet: una fecha futura bloquea el guardado y muestra validacion.
- Pruebas existentes de edicion y borrado en progreso deben seguir pasando.
- Verificacion final: `pnpm test`, `pnpm build`, e Impeccable detector sobre los targets UI modificados.

## Fuera De Alcance

- No agregar creacion manual a `/entreno`.
- No cambiar como se crea la sesion de hoy desde `/entreno`.
- No cambiar schema Dexie.
- No redisenar la pagina completa de progreso.
- No agregar un calendario o date picker custom; el input nativo `type="date"` cubre el caso.
