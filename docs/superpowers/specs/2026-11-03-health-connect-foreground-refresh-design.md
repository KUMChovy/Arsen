# Health Connect: actualización en foreground

**Estado:** aprobado para implementación inline
**Fecha:** 2026-11-03
**Producto:** Arsen Android con Capacitor

## Intención

Evitar que Arsen muestre durante demasiado tiempo un resumen de salud guardado previamente cuando el usuario abre la app o la mantiene visible. La lectura nativa debe consultar el almacén actual de Health Connect; el problema está en que Arsen solo lee bajo demanda y, en la sincronización completa, procesa primero las sesiones antiguas.

## Hechos confirmados

- `HealthConnectManager` crea `TimeRangeFilter.between(dayStart, dayEnd)` y no redondea a bloques de 30 minutos.
- `resolveHealthDayWindow` limita `dayEnd` a la hora de lectura y al inicio del día siguiente.
- La app actualmente invoca `syncAllWorkoutHealth` desde el botón manual de Entreno; no hay lectura al entrar a foreground ni polling mientras la app está visible.
- `syncAllWorkoutHealth` recorre las sesiones en orden ascendente, por lo que la sesión de hoy puede esperar a que terminen muchas lecturas históricas.
- Health Connect permite consultar los registros actuales, pero no notifica nuevos datos a Arsen. La frescura efectiva depende de que la app del reloj ya haya publicado el registro.

## Objetivos

- Leer automáticamente la salud de las sesiones del día actual al montar la app.
- Releer la sesión actual al volver a foreground o recuperar el foco.
- Reintentar mientras la app permanezca visible cada 45 segundos y evitando lecturas concurrentes.
- Priorizar las sesiones de hoy cuando el usuario usa la sincronización manual completa.
- Mantener la sincronización histórica manual existente.
- Corregir la explicación visible: no afirmar bloques fijos de 30 minutos y explicar que la frecuencia depende de la publicación del proveedor.

## No objetivos

- No conectar Arsen directamente al reloj por Bluetooth.
- No confundir una lectura actual de Health Connect con una garantía de que el reloj ya publicó su medición.
- No añadir una dependencia nativa solo para lifecycle; se usarán `visibilitychange`, `focus` e intervalo de foreground del WebView.
- No implementar lectura en segundo plano, notificaciones ni `WorkManager`.
- No cambiar el modelo persistido ni guardar muestras crudas.

## Diseño

### Servicio

Agregar `syncCurrentWorkoutHealth(syncTime)` en `src/domains/health/services.ts`. Debe conservar las mismas guardas de integración habilitada, plataforma nativa y permisos implícitas en `syncWorkoutHealth`, seleccionar solo las sesiones cuyo `date` sea `localDateKey(syncTime)` y reutilizar `syncWorkoutHealth` para cada una.

Modificar `syncAllWorkoutHealth` para ordenar primero las sesiones del día actual y después las históricas. Así la tarjeta de Entreno puede actualizarse antes aunque la sincronización manual continúe con sesiones antiguas.

### Ciclo de vida

Agregar `useHealthAutoSync(enabled)` en `src/domains/health/hooks.ts`. Cuando `enabled` sea verdadero, ejecutará una lectura inmediata del almacén actual de Health Connect, una lectura al volver a `document.visibilityState === 'visible'`, una lectura al recibir `window.focus` y un intervalo de 45 segundos mientras siga visible. Si ya hay una lectura en curso, omitirá el disparo superpuesto. Los errores se consumirán porque la integración es opcional y no deben interrumpir la navegación ni la captura del entrenamiento.

Montar el hook una sola vez desde `AppShell`, usando `healthIntegrationEnabled` de los ajustes locales. La tarjeta seguirá mostrando el botón manual para recuperar históricos.

### Copy de interfaz

En `HealthSummaryCard` y `HealthSetupWizard`, reemplazar la frase de intervalos aproximados de 30 minutos por una explicación de que Arsen consulta el estado actual de Health Connect mientras está en foreground y que la app del reloj debe haber publicado el registro. Cambiar “Última lectura” a “Última consulta” para dejar claro que `syncedAt` es el momento en que Arsen leyó Health Connect, no el timestamp de la última muestra del reloj.

## Verificación

- Test de servicio: una sincronización actual solo consulta sesiones de la fecha local actual.
- Test de servicio: la sincronización completa consulta primero la sesión actual.
- Test del hook/componente: monta una sincronización, responde a `visibilitychange`/`focus`, evita solapamientos y limpia el intervalo.
- Test de UI: el texto ya no contiene la afirmación de 30 minutos y comunica la dependencia del proveedor.
- Suite TypeScript completa y build web.
- Tests unitarios Kotlin y build Android si el entorno Gradle puede crear sus cachés.
- En dispositivo real: verificar que una medición nueva publicada por la app del reloj aparece tras volver a foreground o en el siguiente intervalo; si aún no aparece, la causa queda fuera de Arsen y corresponde a la latencia del proveedor.

## Referencias

- Android Developers, [Synchronize data](https://developer.android.com/health-and-fitness/health-connect/sync-data): Health Connect no notifica nuevos datos; recomienda leer al volver a foreground y periódicamente mientras la app está visible.
- Android Developers, [Read data](https://developer.android.com/health-and-fitness/health-connect/read-data): `readRecords` y `aggregate` consultan registros dentro de un `TimeRangeFilter`; los datos acumulativos como pasos deben agregarse.
- Android Developers, [Write data](https://developer.android.com/health-and-fitness/health-connect/write-data): la frecuencia y granularidad dependen del escritor; no existe un bloque universal de 30 minutos.
