# Diseño — Historial como sección independiente

## Intención

Convertir Historial en una sección de primer nivel, separada de Progreso, para que la revisión cronológica no compita con los análisis y ejercicios.

## Decisiones

- La entrada principal será `/historial`, enlazada desde la navegación inferior.
- `/progreso` conservará solo Resumen y Ejercicios; no abrirá calendarios ni rutas antiguas de Historial.
- La vista cronológica usará paginación local de 20 sesiones por página. El calendario seguirá usando el conjunto completo para marcar días.
- Las rutas `/progreso/historial/:date` y `/progreso/historial/sesion/:sessionId` se mantienen para compatibilidad, pero ningún flujo nuevo las genera.
- El detalle de sesión preferirá `/historial/sesion/:sessionId` y conservará accesibilidad mediante iconos Lucide con `aria-label` y `title`.

## No objetivos

- No cambiar el modelo Dexie ni crear una segunda fuente de historial.
- No alterar los cálculos de Progreso ni la exportación existente.
- No eliminar todavía la página antigua por fecha, porque puede existir en marcadores o datos externos.

## Estados y límites

- Historial vacío y sin resultados conservan sus estados actuales.
- La paginación muestra rango visible y controles anterior/siguiente; los controles quedan deshabilitados en los extremos.
- El selector de calendario no abre la vista antigua; una fecha entrenada abre una sesión exacta y una fecha sin entrenamiento conserva la ruta de creación compatible.
