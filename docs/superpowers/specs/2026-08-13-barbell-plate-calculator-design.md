# Calculadora De Discos Para Barra

## Objetivo

Agregar a Arsen una calculadora compacta de discos para ejercicios con `equipment === 'Barra'`, usando el inventario de discos configurado por el usuario y manteniendo el flujo rapido de `/entreno`.

El usuario ya ve el peso a levantar y una nota de carga por equipo. Esta entrega traduce la carga de barra a una combinacion real de discos por lado, sin cambiar el significado historico de los pesos guardados.

## Decisiones Aprobadas

- Para `Barra`, el peso registrado en series y recetas sigue significando carga total en discos sin incluir la barra.
- Para `Barra`, el desglose por lado se calcula con `weightKg / 2`.
- `barWeightKg` se usa para mostrar el total con barra, no para reinterpretar `weightKg`.
- Solo se muestra calculadora de discos para `equipment === 'Barra'`.
- Para `Mancuerna`, `Maquina`, `Maquina de polea`, `Peso corporal` y `Otro`, no se muestra calculadora de discos.
- Para `loadMode === 'single'`, no se inventan ajustes de pila porque el modelo actual no guarda incrementos ni pesos disponibles de maquina.
- El inventario de discos vive como configuracion global simple en `AppSettings`.
- El inventario se guarda normalizado en kg, aunque la UI lo muestre y edite en la unidad preferida.

## Modelo De Datos

Se agrega un campo opcional a settings:

```ts
type AppSettings = {
  availablePlateWeightsKg?: number[]
}
```

Constante default:

```ts
const DEFAULT_AVAILABLE_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]
```

Reglas:

- Settings existentes sin `availablePlateWeightsKg` usan el default.
- Primer arranque guarda el default en settings.
- Backups antiguos sin el campo importan correctamente y usan el default.
- Backups nuevos preservan el campo porque settings ya se exporta completo.
- No se requiere bump de schema Dexie porque no cambian indices ni tablas.

## Calculo

Se extiende `shared/calculations/equipmentLoad.ts` con un helper puro para plate math.

Entrada del desglose:

- `targetWeightKg`: peso objetivo por lado en kg.
- `availablePlateWeightsKg`: inventario configurable.

Salida:

- `platesKg`: discos elegidos, repetidos por cantidad, de mayor a menor.
- `matchedWeightKg`: suma alcanzada.
- `remainingWeightKg`: diferencia positiva hasta el objetivo.
- `isExact`: `remainingWeightKg <= 0.0001`.

Algoritmo:

1. Normalizar inventario: solo numeros finitos mayores a 0, ordenados descendente y sin duplicados.
2. Recorrer discos de mayor a menor.
3. Mientras el disco quepa sin pasar el objetivo, agregarlo y restarlo del remanente.
4. Redondear resultados a una precision apta para pesos de gimnasio.

Ejemplos con default:

- Objetivo por lado `30 kg` -> `25 + 5 kg por lado`, exacto.
- Objetivo por lado `28.75 kg` -> `25 + 2.5 + 1.25 kg por lado`, exacto.
- Objetivo por lado `28.2 kg` -> `25 + 2.5 kg por lado`, faltan `0.7 kg por lado`.
- Objetivo por lado menor al disco minimo -> sin discos, faltan todo el objetivo.

## Nota De Carga En UI

El helper existente `buildEquipmentLoadNote` pasa a aceptar `availablePlateWeightsKg`.

Para `Barra`, la nota usa esta forma:

- Exacto: `Discos: 25 + 5 kg por lado - Total con barra: 80 kg`
- No exacto: `Discos: 25 + 2.5 kg por lado - Faltan 0.7 kg por lado - Total con barra: 76.4 kg`

Si no hay discos aplicables:

- `Discos: sin discos - Faltan 0.75 kg por lado - Total con barra: 21.5 kg`

La nota se mantiene donde ya existe:

- Card `Ejercicio actual` de `/entreno`, debajo de los stats.
- `RegisterSetSheet`, debajo de los inputs de peso/reps/RIR, recalculada con el valor que el usuario escribe.

## Configuracion

En `/settings`, dentro de la zona de datos o equipo, se agrega un control compacto:

- Label: `Discos disponibles`
- Meta: lista actual en la unidad preferida, por ejemplo `25, 20, 15, 10, 5, 2.5, 1.25 kg`
- Input editable con valores separados por coma.
- Boton `Guardar discos`.

Comportamiento:

- El input se muestra en la unidad preferida.
- Al guardar, cada valor se convierte a kg con `unitToKg`.
- Se rechazan valores no numericos, cero o negativos mostrando un mensaje de error.
- Si la lista queda vacia, se restaura el default.
- El resultado guardado se ordena de mayor a menor y elimina duplicados.

## Arquitectura

Unidades modificadas:

- `shared/calculations/equipmentLoad.ts`: default de discos, normalizacion de inventario, algoritmo greedy, nota de carga con desglose.
- `shared/calculations/equipmentLoad.test.ts`: pruebas unitarias del algoritmo y notas exactas/no exactas.
- `domains/settings/types.ts`: campo opcional `availablePlateWeightsKg`.
- `domains/settings/services.ts`: `resolveAvailablePlateWeightsKg` y `updateAvailablePlateWeights`.
- `domains/settings/pages/SettingsPage.tsx`: control compacto de configuracion.
- `domains/settings/pages/SettingsPage.test.tsx`: render y guardado del inventario.
- `db/seedDemoRoutine.ts`: primer arranque con default.
- `shared/validation/arsenImportSchemas.ts`: default de settings antiguos y validacion basica del arreglo.
- `domains/workout/pages/WorkoutPage.tsx`: pasar inventario al helper.
- `domains/workout/components/RegisterSetSheet.tsx`: recibir inventario por prop y pasarlo al helper.
- Tests de `/entreno` y `RegisterSetSheet`: asegurar que la UI usa el inventario configurado y oculta calculadora para no barra.

Se mantiene:

- Peso persistido siempre en kg.
- Conversiones via `shared/utils/weight.ts`.
- Componentes sin calculo de discos inline.
- Configuracion global simple, sin inventarios por ejercicio ni por rutina.
- Compatibilidad con backups e IndexedDB existentes.

## Impeccable Shape Brief

- Modo: `Operate`. El usuario esta entrenando desde el telefono y necesita saber rapido que cargar sin interrumpir el registro de series.
- El desglose debe sentirse como informacion operacional, no como una nueva superficie decorativa.
- En `/entreno`, la nota conserva el lugar existente para evitar competencia con las acciones principales.
- En `RegisterSetSheet`, la nota sigue debajo del input porque cambia con cada peso escrito.
- En `/settings`, el control es denso y escaneable, usando el estilo de cards/inputs existente; no se crea una pantalla nueva.
- Estados importantes: exacto, no exacto con remanente, inventario vacio/default, valores invalidos en settings, y ejercicios no barra sin nota.
- Accesibilidad: labels claros, touch targets existentes, texto corto en espanol y sin depender solo de color.

## Testing

Pruebas unitarias:

- Greedy exacto con varios discos.
- Greedy no exacto sin pasarse.
- Normalizacion elimina duplicados, ignora invalidos y ordena descendente.
- Nota de barra muestra discos por lado con default.
- Nota de barra muestra remanente cuando falta peso.
- Nota no aparece para mancuerna y equipos no barra.

Pruebas UI:

- `/entreno` muestra desglose con el inventario de settings.
- `RegisterSetSheet` recalcula el desglose al cambiar el peso.
- `RegisterSetSheet` no muestra desglose para `Mancuerna`.
- `/settings` permite guardar un inventario custom y llama al servicio con pesos en kg.

Verificacion final:

- `pnpm test`
- `pnpm build`
- Detector Impeccable sobre targets UI modificados:
  `node C:\Users\Chovy\.agents\skills\impeccable\scripts/detect.mjs --json src\domains\workout\pages\WorkoutPage.tsx src\domains\workout\components\RegisterSetSheet.tsx src\domains\settings\pages\SettingsPage.tsx`

## Fuera De Alcance

- Cambiar el significado de los pesos historicos de barra.
- Soportar kg y lb mezclados en el mismo inventario.
- Guardar inventarios por gimnasio, rutina, dia o ejercicio.
- Modelar barras reutilizables como entidades.
- Modelar stacks de maquina, incrementos de polea o placas selectorized.
- Resolver combinaciones optimas no greedy.

