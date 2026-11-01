# Integración opcional de salud con Health Connect — Diseño revisado

**Estado:** aprobado para implementación inline  
**Fecha:** 2026-10-31  
**Producto:** Arsen Codex para Android con Capacitor

## Intención

Arsen ofrecerá una lectura manual y opcional del resumen diario que otras aplicaciones hayan publicado en Android Health Connect. Arsen no se conecta al reloj por Bluetooth ni sincroniza en segundo plano.

La cadena real es:

```mermaid
flowchart LR
  W[Reloj] --> F[App del fabricante]
  F --> HC[Health Connect]
  HC --> A[Arsen]
```

Health Connect es el almacén local común. No enlaza por sí mismo el reloj: la app del fabricante debe recibir primero los datos, tener habilitado su puente a Health Connect y escribir los registros con los permisos del usuario.

## Objetivos

- Detectar si Health Connect está disponible, requiere actualización o necesita instalación.
- Guiar al usuario con un asistente visible en Ajustes.
- Explicar que el origen depende de la app del fabricante: Mi Fitness/Xiaomi, Samsung Health/Galaxy Watch, Fitbit, Garmin Connect u otra app compatible.
- Solicitar a Arsen solo permisos de lectura para pulso, calorías activas, pasos y saturación de oxígeno.
- Leer y guardar únicamente un resumen del día local.
- Mostrar el último resumen diario sincronizado en Entreno, Progreso e Historial cuando la integración esté activa.
- Mantener la app base funcional sin Health Connect y conservar respaldos legacy.

## No objetivos

- Leer el reloj directamente por Bluetooth.
- Prometer tiempo real o sincronización en segundo plano.
- Escribir datos en Health Connect.
- Detectar de forma fiable qué app del fabricante está conectada o si ya terminó de sincronizar.
- Prorratear calorías o pasos diarios para inventar un resumen de entrenamiento.
- Mostrar por ahora un resumen separado de la sesión.
- Guardar muestras crudas en IndexedDB.

## Hechos de Health Connect que gobiernan la implementación

Health Connect guarda objetos `Record` dentro de un almacén local protegido por permisos granulares. Cada registro incluye tiempos, metadatos y el origen de datos de la aplicación que lo escribió; Arsen puede leerlos, pero no debe asumir que todos los fabricantes publican la misma granularidad.

- `HeartRateRecord` contiene una serie de muestras con `time` y pulsaciones por minuto.
- `OxygenSaturationRecord` contiene lecturas instantáneas con `time` y porcentaje.
- `ActiveCaloriesBurnedRecord` es un intervalo con `startTime`, `endTime` y energía.
- `StepsRecord` es un intervalo con `startTime`, `endTime` y conteo. Para pasos se usa `aggregate(COUNT_TOTAL)` porque Health Connect puede resolver duplicados entre fuentes.
- Las lecturas se filtran con `TimeRangeFilter`; la zona local se convierte a instantes ISO antes de cruzar el puente nativo.
- Android 14+ integra Health Connect en el sistema. Android 13 o inferior requiere la aplicación de Google Play. Health Connect requiere Android 9/API 28 y Google Play Services.
- La app del fabricante puede tardar o no publicar una métrica concreta. Un permiso concedido no equivale a que existan registros.

Fuentes oficiales consultadas: [disponibilidad](https://developer.android.com/health-and-fitness/health-connect/availability), [tipos de datos](https://developer.android.com/health-and-fitness/health-connect/data-types), [lectura](https://developer.android.com/health-and-fitness/health-connect/read-data), [formato y origen](https://developer.android.com/health-and-fitness/health-connect/data-format), [permisos](https://developer.android.com/health-and-fitness/health-connect/ui/permissions), [Mi Fitness](https://www.mi.com/global/support/faq/details/KA-728033/) y [Samsung Health](https://developer.samsung.com/health/health-connect-faq.html).

## Asistente de configuración

El asistente vive dentro de `Ajustes → Salud opcional`; no agrega una ruta nueva ni abre permisos automáticamente al entrar a la pantalla.

1. **Health Connect**: muestra `Disponible`, `Necesita actualización` o `Instalar`. Los botones abren la pantalla de Health Connect o la ficha de Play Store; el plugin conserva el fallback web.
2. **Permiso de Arsen**: explica que Arsen solo lee los cuatro tipos declarados y activa la integración después de que el contrato oficial devuelve al menos un permiso concedido. Los permisos parciales dejan las métricas restantes como `null`.
3. **App del reloj**: explica que el usuario debe abrir la app que administra su reloj, sincronizarlo y activar su conexión con Health Connect. El texto da ejemplos por marca sin escoger una app por el usuario.

Después, el usuario toca `Sincronizar salud` en Entreno. Si no hay registros, Arsen muestra `Sin datos publicados todavía` y una explicación recuperable; no convierte la ausencia en cero ni afirma que el reloj esté desconectado.

## Modelo de datos diario

```ts
type HealthMetricSummary = {
  heartRateAvgBpm: number | null
  heartRateMaxBpm: number | null
  heartRateMinBpm: number | null
  activeCaloriesKcal: number | null
  steps: number | null
  oxygenSaturationAvgPercent: number | null
}

type HealthWindowSummary = {
  rangeStart: string
  rangeEnd: string
  metrics: HealthMetricSummary
}

type HealthSummary = {
  syncedAt: string
  day: HealthWindowSummary
}
```

`day` inicia a medianoche local de `WorkoutSession.date` y termina en la menor de la hora de sincronización y el inicio del día siguiente. Se reemplaza solo después de una lectura válida. Un error conserva el resumen anterior.

Los respaldos anteriores que contengan `session` y `sessionEndSource` continúan siendo aceptados por el validador, pero esos campos quedan legacy: Arsen no los consulta ni los muestra. Los nuevos respaldos solo escriben el resumen diario.

## Flujo nativo

El plugin expone `getAvailability`, `getPermissions`, `requestHealthPermissions`, `openHealthConnectAccess`, `openHealthConnectInstall` y una lectura diaria con dos instantes (`dayStart`, `dayEnd`). Antes de leer vuelve a comprobar los permisos concedidos.

El manager:

- lee pulso y oxígeno con `readRecords` y conserva sus timestamps;
- suma calorías activas con `aggregate`;
- suma pasos con `aggregate`;
- pagina las respuestas de registros;
- devuelve `null` cuando no hay un valor o no existe permiso.

No se filtra únicamente por el paquete de Mi Fitness o Samsung Health porque el usuario puede usar cualquier app compatible y Health Connect es el contrato común.

## Interfaz

La tarjeta queda así:

```text
Salud sincronizada
Última lectura: 20:04

Resumen del día
00:00–20:04
Pulso promedio · máximo · mínimo
Calorías · pasos · oxígeno
```

No se muestra `Sesión de entrenamiento` ni se consulta el intervalo de series. En Progreso e Historial se reutiliza únicamente `health.day`.

## Verificación y límites

Sin teléfono físico se verifican tipos, permisos, estados de instalación, cálculo diario, respuesta parcial, ausencia de datos, persistencia, backups legacy, suite TypeScript, build web y test unitario Kotlin.

En dispositivo real todavía debe comprobarse que la app del fabricante elegida publique los datos concretos del reloj en Health Connect, la latencia de sincronización, la granularidad, los duplicados y la pantalla de permisos en la versión de Android del usuario.
