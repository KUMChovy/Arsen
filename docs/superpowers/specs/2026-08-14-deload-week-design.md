# Semana De Deload Accionable

## Objetivo

Convertir el deload global de Arsen de un aviso pasivo en una funcionalidad accionable, programable y visible durante el entrenamiento. El usuario puede iniciar, programar, saltar o finalizar una semana de deload. Mientras esta activo, la app cambia de identidad visual y muestra objetivos reducidos de series y peso sugerido en `/entreno`.

La decision de producto se mantiene: el deload es global para toda la cuenta. No se segmenta por rutina, dia, ejercicio ni grupo muscular.

## Alcance

- Persistir ciclos de deload en una nueva tabla Dexie `deloadCycles`.
- Mantener la configuracion global de reducciones en `AppSettings`.
- Cambiar el ancla automatica del conteo al ultimo deload completado, con fallback al primer registro historico.
- Permitir programar una fecha futura, iniciar ahora, saltar sugerencias y finalizar manualmente.
- Completar automaticamente un deload activo al pasar 7 dias calendario desde su inicio.
- Mostrar estado y acciones en Configuracion y en `/entreno`.
- Aplicar un modo visual global mientras el deload esta activo.
- Reducir objetivos visibles de series y peso sugerido en `/entreno` sin mutar rutinas ni logs historicos.
- Cubrir calculos, transiciones, migracion/importacion y UI con tests enfocados.

Fuera de alcance:

- Deload por rutina, dia, ejercicio o musculo.
- Historial visual completo de ciclos pasados.
- Cambios obligatorios a notificaciones push del navegador.
- Mutar recetas de rutina, `currentWeightKg` o registros historicos para simular el deload.

## Modelo De Datos

Agregar `DeloadCycle` en el dominio de settings:

```ts
export type DeloadCycleStatus = 'suggested' | 'scheduled' | 'active' | 'completed' | 'skipped'

export type DeloadCycle = {
  id: string
  status: DeloadCycleStatus
  suggestedAt: string | null
  scheduledStartDate: string | null
  startedAt: string | null
  completedAt: string | null
  skippedAt: string | null
  createdAt: string
  updatedAt: string
}
```

`deloadCycles` es global. No contiene `routineId`, `dayId`, `exerciseId` ni `muscle`.

Agregar campos a `AppSettings`:

```ts
deloadSeriesReductionPercent?: number
deloadWeightReductionPercent?: number
```

Defaults:

- Series: `50`, rango permitido `40-60`.
- Peso: `80`, rango permitido `70-90`.

Los campos opcionales se normalizan al leer settings, al importar backups y al crear seed/demo data. Si los valores guardados estan fuera de rango, se acotan al rango permitido.

## Dexie Y Migracion

Subir `CURRENT_SCHEMA_VERSION` y agregar la tabla:

```ts
deloadCycles: 'id, status, startedAt, completedAt, scheduledStartDate, skippedAt, updatedAt'
```

La migracion debe:

- Crear la tabla sin romper bases existentes.
- Agregar defaults de reduccion a `settings.app` si faltan.
- Conservar `deloadNotifications`, `lastDeloadNotificationDate` y `notificationPermission`.
- No crear ciclos falsos a partir del aviso antiguo; si no existe ciclo completado, el fallback sigue siendo el primer `workoutSession`.

Export/import:

- `exportFullBackup` incluye `deloadCycles`.
- `importFullBackup` reemplaza o fusiona `deloadCycles` junto con las demas tablas.
- `backupSchema` acepta la tabla de forma opcional para backups antiguos.
- El schema de `AppSettings` aplica defaults y rangos de reduccion.

## Estado Derivado

Crear un servicio de overview, por ejemplo `getDeloadOverview(currentDate = localDateKey(new Date()))`, que devuelve una vista derivada lista para UI:

```ts
type DeloadPhase = 'idle' | 'suggested' | 'scheduled' | 'active' | 'completed'

type DeloadOverview = {
  phase: DeloadPhase
  currentCycle: DeloadCycle | null
  anchorDate: string | null
  firstLogDate: string | null
  lastCompletedDate: string | null
  weeksSinceAnchor: number
  seriesReductionPercent: number
  weightReductionPercent: number
  cooldownUntil: string | null
  daysRemaining: number | null
  shouldNotify: boolean
}
```

Rules:

- Anchor = ultimo ciclo `completed.completedAt` cuando exista.
- Si no hay completado, anchor = primera `workoutSession.date`.
- Si no hay anchor, phase = `idle`.
- Un ciclo `scheduled` pasa a `active` cuando `scheduledStartDate <= today`.
- Un ciclo `active` pasa a `completed` cuando `today >= startedAt + 7 dias`.
- Mientras un ciclo esta `active`, `daysRemaining` cuenta dias calendario restantes, minimo `0`.
- Si el ultimo ciclo relevante fue `skipped`, no se crea ni muestra nueva sugerencia hasta pasar `DELOAD_SKIP_COOLDOWN_DAYS`.
- Si no hay ciclo abierto, no hay cooldown activo, y el conteo cae entre semana 5 y 7, se muestra o crea una sugerencia `suggested`.
- `completed` es una fase informativa inmediata despues de cerrar un ciclo; para siguientes lecturas sin ciclo abierto, la vista vuelve a `idle` hasta la proxima ventana de sugerencia.
- `currentCycle` apunta al ciclo abierto o recien completado que explica la fase actual. Es `null` en `idle`.

Constantes:

```ts
DELOAD_SUGGESTION_MIN_WEEKS = 5
DELOAD_SUGGESTION_MAX_WEEKS = 7
DELOAD_LENGTH_DAYS = 7
DELOAD_SKIP_COOLDOWN_DAYS = 14
DELOAD_SERIES_PERCENT_MIN = 40
DELOAD_SERIES_PERCENT_MAX = 60
DELOAD_WEIGHT_PERCENT_MIN = 70
DELOAD_WEIGHT_PERCENT_MAX = 90
DEFAULT_DELOAD_SERIES_PERCENT = 50
DEFAULT_DELOAD_WEIGHT_PERCENT = 80
```

El servicio puede aplicar transiciones pendientes antes de devolver el overview, porque Dexie es local y la UI debe reflejar automaticamente programaciones y cierres por fecha. Las transiciones deben ser idempotentes.

## Acciones

Agregar servicios en settings:

- `scheduleDeload(startDate: string)`: valida fecha futura. Crea o actualiza un ciclo abierto como `scheduled`. Si el usuario quiere empezar hoy, debe usarse `startDeloadNow`.
- `startDeloadNow(currentDate?: string)`: cierra sugerencia/programacion abierta y crea/activa un ciclo `active` con `startedAt = today`.
- `skipDeloadSuggestion(currentDate?: string)`: marca la sugerencia abierta como `skipped` con `skippedAt = today`.
- `completeActiveDeload(currentDate?: string)`: marca el ciclo activo como `completed` con `completedAt = today`.
- `updateDeloadReductionSettings(input)`: guarda porcentajes acotados.

Solo debe existir un ciclo abierto a la vez (`suggested`, `scheduled` o `active`). Antes de crear uno nuevo, el servicio normaliza o cierra cualquier ciclo abierto incompatible.

## Calculo De Objetivos

Crear calculos puros, por ejemplo en `src/shared/calculations/deload.ts`:

```ts
getDeloadTargetSets(targetSets, seriesPercent)
getDeloadSuggestedWeightKg(currentWeightKg, weightPercent)
getDeloadExerciseTarget(exercise, settings)
```

Rules:

- Series = `Math.max(1, Math.round(targetSets * seriesPercent / 100))`.
- Peso sugerido = `currentWeightKg * weightPercent / 100`.
- Si `currentWeightKg <= 0`, mostrar `0` o guion segun el patron de UI existente; no inventar carga.
- Validar/acotar porcentajes en un solo lugar.
- No contar drop sets ni cambiar recomendaciones de subida de peso.
- No mutar `RoutineExercise.targetSets`, `currentWeightKg`, snapshots ni logs.

En `/entreno`, cuando phase = `active`, el objetivo primario muestra series y peso deload. El objetivo normal puede mostrarse como contexto secundario.

## UI En Configuracion

Reemplazar la fila pasiva de "Deload" dentro de Notificaciones por una seccion propia "Deload".

Contenido:

- Estado actual: sin sugerencia, sugerido, programado, activo o ultimo completado.
- Semanas desde el ancla y fecha de ancla cuando exista.
- Boton "Iniciar deload ahora".
- `input type="date"` para programar inicio futuro.
- Boton "Ahora no" solo si hay sugerencia.
- Boton "Finalizar deload" solo si esta activo.
- Controles numericos o sliders para:
  - "Series deload" entre 40 y 60.
  - "Peso deload" entre 70 y 90.
- Accion secundaria para notificaciones del navegador, conservando el mecanismo existente.

La seccion debe seguir el patron de `Card`, `ActionRow`, campos nativos y botones compactos existentes. La configuracion no debe volverse una pantalla de analitica.

## UI En Entreno

Agregar una tarjeta compacta de deload cerca del inicio de `/entreno`, despues del header y avisos de calendario.

Estados:

- `suggested`: explica que toca descarga y ofrece iniciar ahora, programar o ahora no.
- `scheduled`: muestra fecha programada y ofrece iniciar ahora o reprogramar.
- `active`: muestra modo activo, dias restantes, reducciones configuradas y boton para finalizar.
- `idle`: no mostrar tarjeta, o mostrar solo un chip discreto si el conteo esta cerca pero sin sugerencia. La version inicial puede no mostrar nada en idle.

Durante `active`:

- La card del ejercicio actual cambia etiquetas:
  - "Peso deload" en vez de "Peso anterior" como objetivo primario.
  - "Series deload" en vez de "Series".
- Mantener reps, RIR, descanso, calentamientos y registro de serie con el flujo existente.
- En listas compactas, mostrar `Deload {series}x...` solo si cabe sin perder escaneo.

Las acciones deben ser tactiles, etiquetadas y sin texto instructivo largo. Copia breve en espanol.

## Identidad Visual Activa

Mientras phase = `active`, `AppShell` aplica un atributo global, por ejemplo `data-deload-active="true"`, al contenedor de la app.

El modo deload redefine variables de acento, no toda la interfaz:

- Mantiene base oscura, superficies, ink y muted.
- Cambia acentos de orientacion/accion a un set frio de recuperacion, por ejemplo cyan/teal.
- Mantiene contraste AA para texto y foco.
- Evita fondos decorativos grandes, gradientes dominantes o paletas wellness claras.
- La diferencia debe ser perceptible en nav activa, botones principales, bordes destacados y tarjetas de estado.

Este modo es una identidad de "descarga activa" dentro de Pocket Iron Console: menos agresiva que progreso acid, pero igual de precisa y entrenable.

## Notificaciones

`notifyDeloadIfNeeded` debe usar el nuevo overview:

- Respeta `deloadNotifications`.
- No notifica si no hay `shouldNotify`.
- No depende de que el usuario haya dado permiso para que el deload sea accionable dentro de la app.
- El copy debe anclar a la fecha correcta: ultimo deload completado o primer registro.

El boton de permiso queda como soporte, no como control principal de deload.

## Testing

Agregar tests puros para:

- `weeksSince`/sugerencia anclada al ultimo completado.
- Fallback al primer registro si no hay ciclos completados.
- Cooldown de skip.
- Programado -> activo.
- Activo -> completado al pasar 7 dias.
- Series reducidas con min 1 y rango 40-60.
- Peso sugerido con rango 70-90.
- Normalizacion/acotado de porcentajes.

Agregar tests Dexie/servicios para:

- Migracion crea tabla y defaults sin romper settings existentes.
- Solo un ciclo abierto a la vez.
- Export/import conserva `deloadCycles`.
- Backups antiguos sin `deloadCycles` siguen importando.

Agregar tests UI enfocados para:

- Configuracion muestra estado y acciones esperadas.
- Configuracion impide valores fuera de rango.
- `/entreno` muestra tarjeta accionable cuando hay sugerencia/programacion/activo.
- `/entreno` muestra objetivos reducidos durante activo.
- AppShell aplica atributo/clase de deload activo.

Verificacion final:

- `pnpm test`
- `pnpm build`
- Detector Impeccable sobre targets UI cambiados:
  `node C:\Users\Chovy\.agents\skills\impeccable\scripts\detect.mjs --json <targets>`

## Riesgos Y Decisiones

- `deloadCycles` agrega mas migracion que settings-only, pero deja historial real y separa eventos de preferencias.
- Auto-transiciones en `getDeloadOverview` deben ser idempotentes para no crear ciclos duplicados con `useLiveQuery`.
- El deload activo cambia objetivos visibles, no los logs. Si el usuario registra otro peso, ese registro sigue siendo verdad historica.
- El modo visual global debe ser claro, pero no debe convertir la app en una nueva paleta monocromatica.
- El estado sigue siendo global aunque se vea en `/entreno`.
