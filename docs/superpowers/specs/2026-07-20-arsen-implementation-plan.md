# Arsen Implementation Plan

## Objetivo

Implementar Arsen como app React web móvil-first, TypeScript, Tailwind, Dexie e IndexedDB, con funcionamiento offline completo y estructura lista para Capacitor.

Spec base: `docs/superpowers/specs/2026-07-20-arsen-design.md`.

## Fase 1: Base Del Proyecto

Entregables:

- Inicializar Vite React TypeScript.
- Configurar Tailwind CSS.
- Configurar React Router.
- Crear app shell móvil con bottom nav.
- Crear tokens CSS base inspirados en mockup v3.
- Instalar dependencias base: Dexie, dexie-react-hooks, lucide-react, recharts, zod.
- Configurar Vitest y Testing Library.

Criterios:

- `npm run dev` levanta app.
- Rutas `/`, `/rutina`, `/progreso`, `/settings` existen.
- Navegación móvil fija funciona.
- UI inicial respeta tema oscuro, morado y verde.

## Fase 2: Tipos, DB Y Seed

Entregables:

- Definir tipos principales: settings, routines, days, exercises, sessions, logs, sets, drop sets, skips.
- Crear schema Dexie versionado.
- Crear repositorios DB por dominio.
- Crear seed demo desde rutina del usuario.
- Crear normalización `canonicalName`.
- Crear settings iniciales: kg, rutina activa, deload on.

Criterios:

- Primera carga crea rutina demo editable.
- Recargar navegador conserva datos en IndexedDB.
- No hay dependencia de red para datos.

## Fase 3: Dominio Rutina

Entregables:

- Vista `/rutina`.
- Selector de rutina activa.
- Crear, duplicar, renombrar y eliminar rutina.
- Crear, renombrar, duplicar, mover y eliminar día.
- Crear, editar, duplicar, mover y eliminar ejercicio.
- Catálogo con búsqueda y filtros.
- Importar rutina JSON.
- Exportar rutina activa JSON.

Criterios:

- Cambiar rutina activa no borra historial.
- Eliminar rutina borra perfil activo, no logs.
- Duplicaciones generan IDs nuevos.
- Día renombrado no rompe ejercicios.

## Fase 4: Dominio Entreno

Entregables:

- Vista `/`.
- Detección de entrenamiento por fecha y weekday.
- Crear/continuar sesión activa.
- Registro de series principales.
- Registro de drop sets.
- Calentamientos generados y editables.
- Notas por sesión.
- Saltar/reactivar ejercicio.
- Estados `pending`, `in_progress`, `done`, `skipped`.
- Resumen diario.
- Varias sesiones por fecha.

Criterios:

- Registrar series actualiza estados y resumen.
- Drop sets suman volumen.
- Sesión incompleta queda persistida.
- Fecha seleccionada permite editar historial.

## Fase 5: Cálculos

Entregables:

- Volumen por serie.
- Volumen total.
- Score de rendimiento.
- Mejor serie.
- Peso máximo.
- Promedio reps.
- Promedio peso.
- Series completadas.
- Deload semanas 5 a 7.
- Agrupación global por `canonicalName`.

Criterios:

- Funciones puras y testeadas.
- Cálculos usan kg base y convierten vista kg/lb.
- Logs históricos con snapshots siguen funcionando tras editar rutinas.

## Fase 6: Progreso

Entregables:

- Vista `/progreso`.
- Tabs general, día, ejercicio, global.
- Historial compacto por ejercicio.
- Gráfica de score por sesión.
- Métricas por ejercicio.
- Timeline global cronológico.
- Vista de última sesión.

Criterios:

- Cambios entre rutinas quedan unidos por `canonicalName`.
- Gráficas cargan lazy.
- Listas largas no traban UI móvil.

## Fase 7: Export, Import Y Backups

Entregables:

- Export progreso JSON.
- Export progreso CSV.
- Export backup completo JSON.
- Import backup fusionar.
- Import backup reemplazar.
- Validación de schema con zod.
- Confirmaciones fuertes para reemplazo y borrado.

Criterios:

- Export progreso incluye todas las rutinas, sesiones, ejercicios, logs, series, drop sets y datos de gráfica.
- CSV es legible para entrenador.
- JSON sirve para IA.
- Import inválido no modifica DB.

## Fase 8: Ajustes Y Storage

Entregables:

- Vista `/settings`.
- Unidad kg/lb.
- Notificación deload.
- Estado de almacenamiento con Storage API.
- Solicitar persistencia.
- Limpieza por rango.
- Limpieza logs rutina activa.
- Borrar todo.

Criterios:

- Storage muestra uso/cuota cuando navegador lo soporte.
- Fallback claro si Storage API no está disponible.
- Acciones destructivas requieren confirmación.

## Fase 9: Pulido Visual

Entregables:

- Componentes compartidos: AppShell, Card, Button, Sheet, Tabs, SegmentedControl, Metric, ActionRow, ExerciseArt, BottomNav.
- Ajuste visual contra mockup v3.
- Iconos lucide-react.
- Assets de ejercicios dentro de `src/assets` o `public/assets`.
- Estados vacíos, error y loading.
- Accesibilidad básica: focus visible, labels, contraste, targets táctiles.

Criterios:

- Pantallas móviles no se rompen en 360px.
- Textos no se enciman.
- Botones principales tienen estados hover/focus/disabled/loading.
- UI mantiene densidad móvil sin perder legibilidad.

## Fase 10: Pruebas Y Preparación Capacitor

Entregables:

- Unit tests cálculos.
- Tests integración DB.
- Tests UI críticos.
- Build production.
- Revisión offline.
- Documentar siguiente paso Capacitor.

Criterios:

- `npm test` pasa.
- `npm run build` pasa.
- App usable sin red después de primera carga local.

## Orden De Trabajo Recomendado

1. Crear base Vite y dependencias.
2. Implementar DB + seed demo.
3. Implementar shell y rutas.
4. Implementar rutina.
5. Implementar entreno.
6. Implementar cálculos.
7. Implementar progreso.
8. Implementar ajustes/export/import.
9. Pulir visual.
10. Pruebas finales.

## Riesgos

- Alcance completo puede crecer mucho; cada fase debe cerrar criterios antes de pasar.
- IndexedDB requiere migraciones cuidadosas desde el inicio.
- Export/import necesita versionado para no romper datos futuros.
- Gráficas y assets pueden inflar bundle; deben cargar lazy.
- Capacitor posterior exige evitar APIs web no soportadas sin fallback.

