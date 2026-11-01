# Health Connect y APK ARSEN — Diseño de corrección

## Objetivo

Hacer visible y accionable el flujo de Health Connect desde un único botón **Activar integración**, reforzar la lectura diaria nativa para que no dependa de un único agregado frágil y entregar APK debug identificables como ARSEN v2.

## Decisiones

- Ajustes no consulta la disponibilidad de Health Connect al cargar la pantalla para decidir qué botón mostrar.
- **Activar integración** ejecuta la detección; si Health Connect falta o requiere actualización, abre automáticamente Google Play y mantiene la integración apagada.
- La sección de salud usa una tarjeta con cabecera y estado visual propio, siguiendo la jerarquía de la sección Deload, sin un botón verde separado para “Health Connect instalado”.
- La lectura nativa conserva `readRecords` para pulso/oxígeno y `aggregate` para calorías/pasos. Cada agregado se extrae con el acceso tipado oficial y una falla aislada no descarta las demás métricas.
- La interfaz muestra una alerta distinta cuando la lectura terminó sin registros, para que no parezca que el botón no hizo nada.
- El nombre visible de la aplicación será `ARSEN`; esta nueva salida conservará `com.kumchovy.arsen.codex` para actualizar instalaciones existentes. El namespace Kotlin permanece estable.
- La versión Android será `1.0.0-v2`, el código de versión será `1` y el APK debug se nombrará `Arsen-v2-debug.apk`.

## No objetivos

- No se añade sincronización en segundo plano.
- No se intenta detectar qué aplicación de fabricante usa el usuario.
- No se cambian los permisos ni se agregan tipos de datos nuevos.
- No se crea un migrador destructivo de respaldos legacy.

## Evidencia y límites

Health Connect documenta `readRecords` para registros individuales y `aggregate` para tipos acumulativos como pasos; la implementación seguirá ese reparto. La confirmación de datos reales de Mi Fitness requiere un teléfono Android con el reloj sincronizado.
