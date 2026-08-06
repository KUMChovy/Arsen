# Workout Routine And Day Switch Design

## Objetivo

Mejorar el cambio de rutina y dia en `/entreno` para que sea persistente durante el dia, seguro cuando ya hay una sesion en progreso, util para rutinas por rotacion y proactivo cuando el usuario falto al gimnasio.

El flujo sigue siendo mobile-first, offline y compacto. No se agrega selector de fecha, timer de descanso, bloque de ultima sesion ni planificador semanal.

## Decisiones

- La seleccion manual de dia se persiste solo para el dia calendario actual y por rutina activa.
- Cambiar rutina desde `/entreno` sigue cambiando la rutina activa global de toda la app.
- Si la sesion visible de hoy ya tiene al menos un set registrado y sigue abierta, el sheet bloquea el cambio de rutina activa y de dia, y muestra el motivo ahi mismo. Si la sesion ya fue finalizada, puede cambiarse la rutina/dia.
- Si no hay series principales en la sesion visible de hoy, el cambio de rutina se aplica directo.
- Al cambiar dia o rutina, se muestra una accion inmediata para deshacer y volver a la seleccion anterior sin que el usuario tenga que recordarla.
- El siguiente dia logico se calcula por rotacion segun el ultimo dia con una sesion que tenga al menos una serie principal.
- El aviso de dias faltantes usa el mismo calculo de siguiente dia logico que el boton del sheet.
- Cuando todos los ejercicios del dia quedan `done`, la sesion de hoy se marca `completed` automaticamente aunque el usuario no toque `Finalizar sesion`.
- El aviso de dias faltantes es independiente del aviso de deload.

## Persistencia De Dia Manual

Se usara `localStorage`, no IndexedDB, porque es estado efimero de UI para el dia actual y no debe entrar en backups/imports.

Clave propuesta:

```txt
arsen.workoutDaySelection.v1
```

Forma:

```ts
type StoredWorkoutDaySelection = {
  date: string
  selectionsByRoutineId: Record<string, string>
}
```

Reglas:

- `date` usa `localDateKey(today)`.
- Al cargar `/entreno`, si `date` coincide y existe `selectionsByRoutineId[activeRoutineId]`, se usa ese `dayId`.
- Si el `dayId` guardado ya no existe en la rutina activa, se ignora.
- Si no hay seleccion valida, se usa el default actual: dia cuyo `weekday` coincide con hoy, o primer dia de la rutina.
- Al seleccionar manualmente un dia, se guarda solo para la rutina activa y la fecha actual.
- Al dia siguiente, si no hay seleccion para la nueva fecha, se recalcula el default normalmente.

## Cambio Seguro De Rutina

`/entreno` debe saber si la sesion visible de hoy tiene al menos un set registrado. Esto se deriva de `dailyProgress.setLogs.length > 0`.

Al elegir otra rutina:

1. Si es la misma rutina, no hace nada.
2. Si hay sets registrados en la sesion visible de hoy y la sesion no esta finalizada, los selectores de rutina y dia quedan deshabilitados.
3. El sheet muestra un aviso inline explicando que la sesion de hoy ya tiene series registradas y que debe finalizar o eliminar esas series antes de cambiar la rutina global.
4. Si no hay sets registrados, o la sesion ya esta `completed`, puede cambiar rutina o dia directo.

Despues de aplicar el cambio, la UI muestra una barra compacta de deshacer:

- Texto con la seleccion anterior: `Antes: <rutina> - <dia>`.
- Boton `Deshacer`.
- Duracion visible: unos segundos, sin bloquear.
- Si el usuario toca `Deshacer`, vuelve a activar la rutina anterior y restaura el dia anterior.

## Indicador Fuera De Calendario

Cuando el dia seleccionado tiene `weekday` distinto al weekday real de hoy, se muestra un indicador sutil y no bloqueante:

```txt
Fuera de calendario
```

Reglas:

- Solo se muestra cuando `day.weekday !== null` y `day.weekday !== today.getDay()`.
- No se muestra para dias de rotacion pura con `weekday: null`.
- Puede aparecer en la cabecera o en el sheet; debe ser visible sin abrir otro flujo.

## Siguiente Dia Logico

Se agregara un calculo puro en el dominio workout, con pruebas unitarias.

Entrada conceptual:

```ts
type NextWorkoutDayInput = {
  activeRoutineId: string
  days: RoutineDay[]
  lastCompletedDayId: string | null
  fallbackDayId: string | null
}
```

Salida:

```ts
RoutineDay | null
```

Reglas:

- `days` se ordena por `order`.
- Si `lastCompletedDayId` pertenece a la rutina activa, devuelve el siguiente dia por orden, con wrap al primero.
- Si `lastCompletedDayId` no pertenece a la rutina activa, devuelve `fallbackDayId` si es valido.
- Si no hay fallback valido, devuelve el primer dia ordenado.
- Una sesion cuenta como fuente para `lastCompletedDayId` solo si tiene al menos una serie principal.

El sheet de cambio de entreno incluye un boton:

```txt
Continuar con el siguiente dia
```

Al tocarlo, selecciona el dia calculado y persiste esa seleccion manual para hoy.

## Deteccion De Dias Faltantes

Se define una constante unica:

```ts
MISSED_TRAINING_DAY_THRESHOLD = 2
```

`diasSinEntrenar` se calcula como dias calendario transcurridos entre hoy y la fecha mas reciente de cualquier sesion con al menos una serie principal.

Se detecta falta si:

- `diasSinEntrenar >= MISSED_TRAINING_DAY_THRESHOLD`, o
- la rutina activa tiene dias anclados a `weekday`, hoy hay dia programado, y uno o mas weekdays programados anteriores desde la ultima sesion con series no tienen sesion registrada.

El aviso en `/entreno`:

- Es visible pero no bloqueante.
- Dice algo como `Llevas 3 dias sin entrenar`.
- Tiene accion principal para retomar el siguiente dia logico.
- Tiene accion para descartar.
- El descarte se guarda por dia calendario en `localStorage`, con una clave separada de la seleccion de dia.
- Si se descarta hoy, no reaparece hoy.
- Si manana la falta sigue vigente, puede reaparecer.
- Es componente y estado separados de cualquier aviso de deload.

Clave propuesta para descarte:

```txt
arsen.missedTrainingNoticeDismissedDate.v1
```

## Autocompletar Sesion

La sesion de hoy debe marcarse `completed` automaticamente cuando todos los ejercicios del dia quedan `done`.

Reglas:

- Se evalua despues de registrar, editar o borrar series principales, porque esas acciones pueden cambiar el estado de los ejercicios.
- Solo cuenta el dia visible de `/entreno` para la fecha actual.
- Si todos los ejercicios del dia tienen estado `done` y existe sesion, se actualiza `WorkoutSession.status` a `completed`.
- Si luego una edicion o borrado deja un ejercicio por debajo de su objetivo y su estado vuelve a `in_progress` o `pending`, la sesion puede volver a `draft`.
- El boton manual `Finalizar sesion` permanece como accion explicita para usuarios que quieran cerrar antes.

## Arquitectura

Unidades nuevas o modificadas:

- `src/domains/workout/calculations/trainingRotation.ts`: calculos puros de siguiente dia, ultima sesion con sets y deteccion de faltas.
- `src/domains/workout/repository.ts`: consultas Dexie para historial necesario de `/entreno`.
- `src/domains/workout/hooks.ts`: hooks `useWorkoutRotationStatus` o equivalente para la pagina.
- `src/domains/workout/services.ts`: helper para sincronizar estado `completed` cuando cambian series.
- `src/domains/workout/pages/WorkoutPage.tsx`: estado local, persistencia localStorage, confirmacion, sheet, aviso y deshacer.
- `src/domains/workout/pages/WorkoutPage.test.tsx`: pruebas UI del flujo.
- `src/domains/workout/calculations/trainingRotation.test.ts`: pruebas puras del calculo.

No se cambia schema Dexie.

## UI

Modo de superficie: operar. La pantalla debe seguir siendo una consola densa de entrenamiento, no una pantalla de explicacion.

Cambios visibles:

- Badge `Fuera de calendario` junto al dia activo o cerca del header.
- Aviso compacto de dias faltantes debajo del header o antes de `Ejercicio actual`.
- Sheet `Cambiar entreno` con:
  - rutina activa,
  - dia de entrenamiento,
  - boton `Continuar con el siguiente dia`,
  - referencia `Antes: <rutina> - <dia>` cuando aplique.
- Barra compacta de deshacer despues de aplicar cambio de rutina o dia.

Los controles deben conservar tap targets de al menos 44px, foco visible y copy en espanol.

## Testing

Pruebas requeridas:

- Persistencia de dia manual durante el mismo dia.
- Reset al default al cambiar de dia calendario.
- Bloqueo visible en el sheet al cambiar rutina o dia si hoy hay una sesion visible abierta con al menos un set registrado; desbloqueo cuando se finaliza la sesion o se eliminan los sets.
- Cambio directo de rutina si hoy no hay sets registrados.
- Indicador `Fuera de calendario`.
- `Continuar con el siguiente dia` usa rotacion por ultima sesion con sets, no weekday.
- Deshacer restaura rutina y dia anteriores.
- Deteccion de falta por umbral de dias calendario.
- Deteccion de falta por weekday anclado saltado aunque no se cumpla el umbral.
- Descartar aviso evita que reaparezca el mismo dia.
- Autocompletar marca sesion `completed` al completar todos los ejercicios.
- Autocompletar vuelve a `draft` si una edicion o borrado deja incompleto el dia.

## Fuera De Alcance

- Timer de descanso.
- Bloque de referencia de ultima sesion.
- Selector de fecha en `/entreno`.
- Nueva tabla de planificacion.
- Cambios de schema Dexie.
- Sincronizacion cloud.
