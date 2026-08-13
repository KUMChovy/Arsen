# Workout Rest Visible Design

## Objetivo

Mostrar el descanso recomendado (`restSeconds`) del ejercicio actual dentro de la card principal de `/entreno`, sin abrir sheets ni menus.

## Decisiones

- El dato se lee de `currentExercise.restSeconds`, el mismo `RoutineExercise` que ya alimenta peso, series, reps y RIR.
- No se agrega estado nuevo ni cache local para descanso.
- La fuente reactiva se conserva: `/entreno` usa `useWorkoutDayById`, que lee con `useLiveQuery`, por lo que volver desde `/rutina` refleja cambios guardados en Dexie.
- Se crea un formatter compartido para evitar calculos inline en componentes.
- El detalle de rutina usara el mismo formatter para mantener una sola convencion visible.

## Formato

Nuevo util compartido:

```ts
formatRestSeconds(seconds: number | null | undefined): string
```

Reglas:

- `undefined`, `null`, `0`, negativos o valores no finitos devuelven `—`.
- Menos de 60 segundos devuelve `N seg`, por ejemplo `45 seg`.
- 60 segundos o mas devuelve `M:SS min`, por ejemplo `1:00 min`, `1:30 min`, `2:05 min`.
- Se redondea hacia abajo a segundos enteros porque `restSeconds` representa segundos configurados, no un temporizador activo.

## UI

La card de `Ejercicio actual` mantiene cuatro metricas principales y agrega el descanso en una fila centrada debajo:

```txt
Descanso
1:30 min
```

El grid de metricas conserva cuatro columnas para peso anterior, series, reps y RIR. Debajo aparece una fila de descanso con borde superior, etiqueta pequena y valor destacado. Esta estructura evita apretar cinco columnas en pantallas de 360 a 390 px.

No se agrega cronometro, cuenta regresiva, notificaciones ni acciones nuevas.

## Testing

- Agregar test unitario de `formatRestSeconds` con casos `<60`, `=60`, `>60`, `0` e `undefined`.
- Actualizar el test de `WorkoutPage` que hoy verifica que no exista `Descanso`; ahora debe confirmar que la card principal lo muestra.
- La suite existente debe seguir pasando.

## Fuera De Alcance

- Timer de descanso.
- Notificacion al terminar descanso.
- Cambios al schema Dexie.
- Cambios al snapshot historico.
