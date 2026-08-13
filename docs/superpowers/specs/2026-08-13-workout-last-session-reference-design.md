# Workout Last Session Reference Design

## Objetivo

Agregar en `/entreno` una referencia de solo lectura con las series de la ultima vez que se entreno el ejercicio actual, limitada a la misma rutina y el mismo dia activos.

La referencia ayuda al usuario a decidir peso, reps y RIR mientras registra la sesion de hoy, sin mezclar historial de otros dias o rutinas donde exista el mismo ejercicio por catalogo.

## Decisiones

- La referencia se muestra solo en la card de `Ejercicio actual`.
- La busqueda se limita a sesiones anteriores a la fecha visible de `/entreno` con el mismo `routineId` y `dayId`.
- Dentro de esas sesiones, cada ejercicio se cruza por `routineExerciseId`, no por `canonicalName`.
- Si el mismo ejercicio de catalogo existe en otra rutina o en otro dia, esas sesiones no cuentan.
- La consulta trae referencias para todos los ejercicios del dia activo en una sola pasada y la UI selecciona la del ejercicio actual.
- El bloque es completamente de solo lectura: sin botones, sin handlers de click, sin abrir sheets.
- No se cambia la logica de registrar, editar, eliminar, saltar o completar series de hoy.
- No se agrega accion de copiar series desde la referencia.

## Arquitectura

Se agregara una consulta en `src/domains/workout/repository.ts`:

```ts
getLastSessionReferencesForDay(input: {
  date: string
  routineId: string | undefined
  dayId: string | undefined
  exercises: RoutineExercise[]
})
```

La consulta:

1. Sale temprano si no hay `routineId`, `dayId` o ejercicios.
2. Carga sesiones con `routineId` igual al activo.
3. Filtra en memoria por `dayId` igual al activo y `date < input.date`.
4. Ordena esas sesiones de mas reciente a mas antigua.
5. Carga los `exerciseLogs` cuyos `routineExerciseId` estan en los ejercicios del dia.
6. Cruza logs contra las sesiones filtradas.
7. Carga `setLogs` main y `dropSetLogs` para los logs/set encontrados.
8. Para cada ejercicio del dia, conserva solo la primera sesion historica encontrada.

No se cambia el schema Dexie. Los indices actuales alcanzan para una consulta por rutina y un filtrado local pequeno por dia/fecha.

## Tipos

Se agregara un tipo exportado de dominio en `src/domains/workout/types.ts`:

```ts
type LastSessionReference = {
  date: string
  sets: Array<{
    set: SetLog
    dropSets: DropSetLog[]
  }>
}
```

El hook devuelve:

```ts
Map<string, LastSessionReference>
```

La llave del mapa es `routineExerciseId`.

## Hook

Se agregara `useLastSessionReferencesForDay` en `src/domains/workout/hooks.ts`.

Dependencias reactivas:

- fecha visible (`dateKey`);
- `routineId`;
- `dayId`;
- IDs de ejercicios del dia.

Cuando el usuario cambia ejercicio actual, la UI solo lee otra entrada del mismo mapa. Cuando cambia rutina o dia, el hook recalcula con la nueva combinacion.

## UI

Modo de superficie: operar. El bloque debe ser compacto, escaneable y claramente no editable.

Ubicacion:

- Dentro de la card `Ejercicio actual`.
- Despues de las estadisticas del ejercicio y la nota de carga, antes del boton `Registrar`.

Contenido con historial:

- Cabecera compacta: `Ultima sesion` y fecha corta, por ejemplo `12 jul`.
- Chip o etiqueta `Referencia`.
- Una fila por serie principal: peso, reps y RIR.
- Drop sets anidados debajo de su serie principal, con tono mas tenue.

Estado vacio:

```txt
Primera vez con este ejercicio en este dia
```

Estilo:

- Usar tokens Tailwind existentes.
- Borde o superficie sutil distinta a las series de hoy.
- Evitar acid green como color principal, porque no representa progreso de hoy.
- No renderizar iconos de editar, eliminar ni botones dentro del bloque.

## Formato Y Unidades

- La fecha usa `Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' })`.
- Los pesos usan `formatWeight(weightKg, preferredUnit)`.
- La unidad visible siempre respeta `settings.preferredUnit`, no el `displayUnit` historico del set.

## Testing

Pruebas requeridas:

- Repositorio: devuelve la ultima sesion anterior para la misma `routineId + dayId + routineExerciseId`.
- Repositorio: ignora sesiones de otra rutina o de otro dia aunque el ejercicio comparta `canonicalName`.
- Repositorio: devuelve ausencia de referencia para un ejercicio sin historial en esa rutina/dia.
- UI: muestra fecha, series, reps, RIR y drop sets en el bloque de `Ejercicio actual`.
- UI: muestra el estado vacio claro cuando no hay historial.
- UI: confirma que el bloque no renderiza controles de editar o eliminar.

Verificacion final:

- `pnpm test`
- `pnpm build`

## Fuera De Alcance

- Copiar series historicas al formulario de registro.
- Cambiar el flujo de registro de series de hoy.
- Mostrar la referencia en el listado expandido de `Ejercicios y series del dia`.
- Cambios de export CSV, descanso o service worker.
