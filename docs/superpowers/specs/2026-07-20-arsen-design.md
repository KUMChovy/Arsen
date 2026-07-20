# Arsen Design Spec

## Resumen

Arsen es una app web móvil-first para registrar entrenamiento de fuerza, funcionar 100% offline en teléfono y quedar preparada para empaquetarse después con Capacitor. El alcance inicial será completo: rutina activa, gestión de rutinas, registro de sesiones, drop sets, calentamientos, historial, progreso, exportaciones, backups, importación, ajustes, deload y estado de almacenamiento.

Stack aprobado: Vite, React, TypeScript, Tailwind CSS, Dexie.js, IndexedDB y React Router. La arquitectura será por dominios para mantener separadas las responsabilidades de rutina, entreno, progreso, ajustes y persistencia.

## Decisiones Aprobadas

- Alcance completo desde el inicio.
- TypeScript obligatorio.
- IndexedDB como base principal, mediante Dexie.js.
- App 100% offline.
- Rutina demo precargada y editable usando el JSON del usuario como base.
- Mapeo inicial editable: Dia 1 = lunes, Dia 3 = miércoles, Dia 5 = viernes, Dia 6 = sábado.
- Unidad base: kg, con ajuste kg/lb desde el inicio.
- Se permiten varias sesiones en la misma fecha.
- Importación con modos fusionar y reemplazar.
- Exportar progreso en JSON y CSV para entrenador o IA.
- Exportar progreso usa timeline global cronológico de todas las rutinas y ejercicios, no solo la rutina activa.
- Eliminar rutina, día o ejercicio no borra historial.

## Rutas

| Pantalla | Ruta | Propósito |
|---|---|---|
| Entreno | `/` | Mostrar entrenamiento del día, estados, calentamientos, registro y resumen diario. |
| Rutina | `/rutina` | Ver, crear, editar, duplicar, importar, exportar y eliminar rutinas, días y ejercicios. |
| Rendimiento | `/progreso` | Mostrar historial, métricas, gráficas y progreso global por ejercicio. |
| Ajustes | `/settings` | Administrar backups, importaciones, notificaciones, unidades, storage y limpieza. |

## Arquitectura

Estructura propuesta:

```txt
src/
  app/
    router.tsx
    providers.tsx
    AppShell.tsx
  db/
    schema.ts
    migrations.ts
    seedDemoRoutine.ts
  domains/
    routine/
      types.ts
      repository.ts
      services.ts
      components/
      pages/
    workout/
      types.ts
      repository.ts
      services.ts
      components/
      pages/
    progress/
      types.ts
      services.ts
      exports.ts
      components/
      pages/
    settings/
      types.ts
      services.ts
      components/
      pages/
  shared/
    calculations/
    components/
    hooks/
    utils/
    styles/
```

Reglas React/performance:

- Rutas pesadas con lazy loading: progreso, editor de rutina, export/import y gráficas.
- Gráficas cargadas solo al entrar a `/progreso`.
- Evitar barrel imports grandes; usar importaciones directas cuando convenga.
- Estado derivado se calcula durante render o con `useMemo`, no se duplica en stores.
- Agrupaciones de logs, ejercicios y rutinas con `Map` y `Set`.
- Hooks separados por dependencia: rutina activa, sesión activa, métricas, storage.
- Listas largas con `content-visibility: auto`.
- Acciones de usuario en handlers, no en effects innecesarios.

## Modelo De Datos

Tablas Dexie:

```txt
settings
routines
routineDays
routineExercises
exerciseCatalog
workoutSessions
exerciseLogs
setLogs
dropSetLogs
skipLogs
```

Entidades principales:

- `Settings`: unidad preferida, tema, notificaciones, persistencia storage, rutina activa.
- `Routine`: nombre, activa, fecha creación, fecha edición.
- `RoutineDay`: rutina, nombre visible, weekday opcional, orden, descripción.
- `RoutineExercise`: día, nombre, canonicalName, músculo, equipo, series objetivo, rango reps, RIR, descanso, calentamiento, progresión, notas, orden.
- `ExerciseCatalogItem`: canonicalName, nombre, músculo, equipo, aliases, defaults y asset opcional.
- `WorkoutSession`: rutina, día, fecha, notas, unidad visible, estado.
- `ExerciseLog`: sesión, ejercicio, estado, notas y snapshot mínimo del ejercicio.
- `SetLog`: peso, reps, RIR, orden, unidad visible, tipo `main` o `warmup`.
- `DropSetLog`: set principal, peso, reps, RIR, orden.
- `SkipLog`: sesión, ejercicio, fecha y motivo opcional.

Regla histórica: los logs guardan snapshot del ejercicio. Si se renombra o elimina una rutina, el progreso histórico sigue legible y exportable.

## Flujo De Entreno

La ruta `/` detecta la fecha seleccionada, por defecto hoy. Busca la rutina activa y el día asignado por weekday. Si ya existe sesión para esa fecha y día, la continúa. Si no existe, muestra preview y crea sesión al primer registro, nota o skip.

Estados de ejercicio:

- `pending`: sin series ni skip.
- `in_progress`: tiene series principales, pero menos que objetivo.
- `done`: series principales completadas mayor o igual al objetivo.
- `skipped`: marcado como saltado temporalmente.

Registro:

- Registrar peso, reps y RIR por serie.
- Agregar drop sets debajo de cualquier serie principal.
- Guardar notas por sesión y por ejercicio.
- Cambiar fecha de sesión.
- Registrar varias sesiones en la misma fecha.
- Generar calentamientos según protocolo y peso de trabajo.
- Editar o eliminar sesiones existentes desde historial.

Resumen diario:

- Ejercicios completados.
- Ejercicios pendientes, en progreso y saltados.
- Series principales completadas.
- Drop sets completados.
- Volumen total.

## Gestión De Rutinas

La ruta `/rutina` tendrá tres niveles:

1. Vista de rutina: selector de rutina activa, días, volumen semanal, importar, exportar, crear, duplicar, renombrar y eliminar rutina.
2. Detalle de día: lista de ejercicios, ordenar, renombrar, duplicar, mover y eliminar día.
3. Editor de ejercicio: nombre, músculo, equipo, series, reps, RIR, descanso, calentamiento, progresión y notas.

Catálogo:

- Buscar por nombre.
- Filtrar por músculo y equipo.
- Agregar desde catálogo a un día.
- Crear ejercicio manual nuevo.
- Guardar ejercicio nuevo en catálogo.
- Mostrar indicador de progreso global disponible cuando existan logs por `canonicalName`.

Duplicar rutina, día o ejercicio siempre genera IDs nuevos. Renombrar día no rompe ejercicios porque se ligan por `dayId`, no por texto.

## Rendimiento

La ruta `/progreso` tendrá:

- Vista general con sesiones recientes, volumen semanal, PRs, deload y mejores ejercicios.
- Vista por día con progreso de ejercicios del día.
- Vista por ejercicio con historial compacto, mejor serie, peso máximo, promedio de reps, promedio de peso, volumen total y score por sesión.
- Vista global que une ejercicios entre rutinas por `canonicalName`.
- Exportación de progreso global.

Exportar progreso:

- JSON completo para análisis por IA.
- CSV legible para entrenador.
- Orden cronológico global.
- Incluye todas las rutinas, sesiones, ejercicios, logs, series y drop sets.
- Cada punto incluye fecha, rutina, día, ejercicio, best set, volumen, score, unidad y notas relevantes.
- Incluye datos de gráfica reproducible y, si el navegador lo permite, imagen o metadata de gráfica.

## Ajustes

La ruta `/settings` incluirá:

- Exportar respaldo completo.
- Importar respaldo con modo fusionar o reemplazar.
- Importar rutina como nueva o reemplazando una rutina seleccionada.
- Exportar rutina activa.
- Exportar progreso global JSON/CSV.
- Cambiar unidad kg/lb.
- Activar o desactivar notificación de deload.
- Estado de almacenamiento: registros, rutinas, uso estimado, cuota y persistencia Storage API.
- Limpieza: borrar sesiones por rango, borrar logs de rutina activa o borrar todo con confirmación fuerte.

Backups completos incluyen settings, rutinas, catálogo, sesiones y logs. Importaciones validan versión de schema antes de escribir.

## Cálculos

| Cálculo | Lógica |
|---|---|
| Volumen por serie | `peso * reps` |
| Volumen total | Suma de series principales y drop sets |
| Score de rendimiento | `peso * (1 + reps / 30)` |
| Mejor serie | Serie principal con mayor score |
| Peso máximo | Mayor peso en series principales |
| Promedio de reps | Promedio en series principales |
| Promedio de peso | Promedio en series principales |
| Series completadas | Conteo de series principales |
| Deload | Semanas desde primer registro; avisar semanas 5 a 7 |
| Día de entrenamiento | Mapeo weekday contra rutina activa |

Los cálculos viven en funciones puras dentro de `shared/calculations`, con pruebas unitarias.

## Diseño Visual

Dirección aprobada: oscuro, atlético, premium, móvil-first, cercano a las imágenes adjuntas.

Rasgos:

- Fondo negro/charcoal.
- Superficies compactas con borde fino.
- Morado para navegación, selección y acciones secundarias.
- Verde ácido para rendimiento, progreso y guardar registro.
- Cards con radio moderado.
- Bottom nav fija con cuatro rutas.
- Sheets inferiores para registro, editor y exportación.
- Inputs grandes para dedo.
- Densidad alta, pero legible en móvil.
- Iconos con `lucide-react`.
- Imágenes de ejercicios generadas en estilo oscuro, monocromo y highlight morado.

Mockup visual aprobado:

- `.superpowers/brainstorm/arsen-1784512623/content/arsen-mobile-mockups-v3.html`
- Asset generado: `.superpowers/brainstorm/arsen-1784512623/content/assets/arsen-exercise-sprite.png`

## Errores Y Estados

- Sin rutina activa: CTA para crear o importar rutina.
- Día sin entrenamiento: mostrar descanso y permitir iniciar sesión manual.
- Sesión incompleta: conservar borrador local.
- Import JSON inválido: mostrar error con motivo y no tocar DB.
- Reemplazar backup: pedir confirmación fuerte.
- Storage sin persistencia: mostrar advertencia y botón para solicitar persistencia.
- Export fallido: permitir reintentar y mantener datos intactos.

## Testing

Pruebas unitarias:

- Cálculos de volumen, score, mejor serie, promedios y deload.
- Mapeo de día de semana.
- Normalización `canonicalName`.
- Import/export JSON.

Pruebas de integración:

- Crear rutina, día y ejercicio.
- Registrar sesión con series y drop sets.
- Editar sesión existente.
- Fusionar backup sin duplicar.
- Reemplazar backup con confirmación.

Pruebas UI:

- Navegación principal.
- Registro móvil.
- Editor de rutina.
- Export progreso JSON/CSV.
- Estados vacíos y errores principales.

## Fases De Implementación

Aunque el alcance inicial es completo, la construcción se hará por capas:

1. Scaffolding Vite/React/TS/Tailwind, routing y shell móvil.
2. Dexie schema, seed demo y repositorios.
3. Dominio de rutinas y catálogo.
4. Dominio de entreno, sesiones, series y drop sets.
5. Cálculos y resumen diario.
6. Dominio de progreso, historial y gráficas.
7. Export/import backups, rutinas y progreso JSON/CSV.
8. Ajustes, unidades, Storage API, deload y limpieza.
9. Pulido visual contra mockup v3.
10. Pruebas y preparación para Capacitor.

