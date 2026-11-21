# Rediseño de Entreno Implementation Plan

> **Ejecución:** `superpowers:executing-plans`, íntegramente en línea; no crear ramas, worktrees ni commits sin autorización explícita.

**Goal:** Completar P0, P1 y P2 del rediseño de Entreno, preservando registros, compatibilidad y funcionamiento offline.

**Architecture:** Mantener sesiones y snapshots Dexie existentes, introduciendo solo metadatos opcionales para la composición local de sesión. Compartir servicios de validación, persistencia y métricas entre Entreno e Historial, y componentes de entrada y hojas entre registro y edición.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Dexie, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-21-entreno-redesign-design.md`, junto con la especificación completa suministrada por el usuario.

## Restricciones globales

- No implementar temporizadores; mantener solo descanso recomendado estático.
- Datos en kg, presentación kg/lb con helpers existentes; español es-MX; offline; sin dependencias nuevas innecesarias.
- Mantener snapshots, rutina original, drop sets, deload, Health Connect, exportación y restauración de respaldos.
- Un calentamiento no cuenta como serie principal ni volumen principal ni activa recomendaciones.
- Accesibilidad, navegación por teclado, foco modal, áreas seguras, movimiento reducido y anchos de 320, 360, 390 y 430 px.

## Riesgos a probar

1. Fallo al guardar un drop set: ninguna serie parcial ni cambio de peso de rutina debe persistir.
2. Dos pulsaciones rápidas o recarga durante el guardado: no duplicar registros confirmados.
3. Ejercicio temporal, reemplazado o con rutina eliminada: conservar identidad, snapshot, historial y backup.
4. Finalización manual seguida de edición y ejercicios omitidos: no reabrir silenciosamente ni fingir que hay series completas.
5. Sesión antigua o backup sin campos nuevos: importar, mostrar y restaurar sin perder información.

## Tarea 1: Composición persistente de sesión y estados

**Archivos:** `src/domains/workout/types.ts`, `services.ts`, `repository.ts`, `hooks.ts`, `src/shared/validation/arsenImportSchemas.ts`, pruebas de servicios y validación.

- [ ] Añadir pruebas de persistencia para agregar, sustituir y ordenar ejercicios solo en la sesión; mantener intacta la rutina y los logs preexistentes.
- [ ] Añadir pruebas de sesión antigua, importación/exportación de backups y snapshots de ejercicios sin fila de rutina.
- [ ] Definir metadatos opcionales de sesión, identificadores estables y sus servicios transaccionales; usar la lista de rutina como respaldo para sesiones antiguas y validar los nuevos campos en importación.
- [ ] Añadir pruebas de omisión/restauración, sesión finalizada manualmente, transición automática y recuperación tras recarga; conciliar las transiciones sin redefinir los estados existentes.
- [ ] Ejecutar `pnpm test src/domains/workout/services.test.ts src/shared/validation/arsenImportSchemas.test.ts` y verificar que pasan.

## Tarea 2: Escrituras de series, calentamientos y notas

**Archivos:** `src/domains/workout/services.ts`, `src/domains/workout/services.test.ts`, cálculos y pruebas correspondientes.

- [ ] Crear pruebas de validación de peso cero, repeticiones enteras positivas, RIR válido, valores no finitos y conversión; probar rollback cuando falla el drop set.
- [ ] Escribir cada serie principal y sus drop sets en una sola transacción, manteniendo los límites y tratamiento de cargas existentes; impedir actualizaciones de rutina para ejercicios temporales.
- [ ] Añadir servicios y pruebas para crear, editar y eliminar calentamientos, así como guardar notas de sesión y ejercicio; comprobar que no alteran métricas principales ni intervalo Health Connect.
- [ ] Ejecutar `pnpm test src/domains/workout/services.test.ts src/shared/calculations/workout.test.ts src/shared/calculations/progression.test.ts`.

## Tarea 3: Registro y edición accesibles

**Archivos:** `src/domains/workout/components/RegisterSetSheet.tsx`, `EditSetSheet.tsx`, componentes compartidos de hoja y entrada, pruebas de componentes.

- [ ] Probar precarga en orden serie actual, historial, rutina; modificaciones manuales, steppers por unidad y modo de carga, RIR exacto, drop sets y doble pulsación.
- [ ] Compartir entradas accesibles y una hoja con diálogo etiquetado, foco inicial y retorno, desplazamiento, teclado virtual y confirmación de descarte de cambios.
- [ ] Añadir duplicación explícita, errores asociados a controles, guardado pendiente protegido y confirmación antes de borrar.
- [ ] Ejecutar `pnpm test src/domains/workout/components/RegisterSetSheet.test.tsx` y las pruebas nuevas de edición y hoja.

## Tarea 4: Preparación, navegación, adaptaciones y notas

**Archivos:** `src/domains/workout/pages/WorkoutPage.tsx`, `src/domains/workout/hooks.ts`, componentes de Entreno y `WorkoutPage.test.tsx`.

- [ ] Probar preparación y continuación, selección libre, anterior/siguiente sin omitir, retorno a ejercicios completados, omitir/restaurar y cambios de rutina/día bajo las restricciones de sesión.
- [ ] Reorganizar Entreno en preparación, ejercicio actual y revisión, con barra compacta, información secundaria desplegable y acciones contextuales válidas.
- [ ] Integrar ejercicios ocasionales, sustitución y orden local, notas de ejercicio y sesión, calentamientos registrables, referencias históricas y recomendaciones.
- [ ] Verificar 320–430 px, foco, etiquetas, ausencia de desbordamientos, retroalimentación accesible y movimiento reducido; ejecutar `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`.

## Tarea 5: Resumen, historial, respaldo y salud

**Archivos:** `src/domains/progress/repository.ts`, páginas de historial, pruebas de Progreso y Settings, `src/domains/health` si se requiere.

- [ ] Probar que el resumen y el historial coinciden en ejercicios, omisiones, series principales, drop sets, volumen, notas y salud; mostrar calentamientos separados de métricas principales.
- [ ] Integrar las notas, calentamientos y snapshots de ejercicios temporales en Historial sin cambiar las agregaciones de Progreso ni la sincronización Health Connect.
- [ ] Probar exportación y restauración de sesiones nuevas y antiguas y recuperación sin red.
- [ ] Ejecutar las pruebas de Progreso, Settings y Health Connect afectadas.

## Tarea 6: Revisión y verificación final

- [ ] Revisar íntegramente el diff contra la especificación y el diseño; usar las fases `critique`, `polish`, `audit` y `harden` de Impeccable.
- [ ] Ejecutar el detector de Impeccable una vez sobre los archivos de interfaz cambiados y revisar la interfaz renderizada en los anchos solicitados.
- [ ] Ejecutar `pnpm test` y `pnpm build`; resolver regresiones y documentar toda comprobación que no sea posible realizar.
- [ ] Informar componentes reutilizados o nuevos, cambios de datos, resultados y limitaciones; no realizar operaciones Git sin aprobación separada.

## Ajuste posterior: acciones y referencia histórica

- [ ] Reproducir el problema de contención del menú y agregar una prueba de acciones dentro de un desplegable que participa en el flujo de la tarjeta.
- [ ] Agregar pruebas para abrir y cerrar «Última sesión», conservando fecha, series, drops y el estado vacío.
- [ ] Ajustar `src/domains/workout/pages/WorkoutPage.tsx` con controles semánticos y de tamaño táctil; ejecutar la prueba de página, la suite completa y la compilación con generación del service worker.
- [ ] Revisar la presentación en navegador si está disponible y documentar cualquier limitación de verificación visual.

## Ajuste posterior: icono de opciones y contracción de ejercicios

- [ ] Añadir pruebas de apertura y cierre del icono junto a indicaciones y de las acciones existentes dentro del panel.
- [ ] Añadir pruebas para expandir y contraer el mismo ejercicio, conservar el ejercicio actual y seleccionar otro sin modificar las series.
- [ ] Cambiar `WorkoutPage.tsx` para distinguir una contracción intencional del estado inicial; comprobar las pruebas de página, la suite y la compilación.

## Ajuste posterior: hoja de opciones

- [ ] Probar que el icono abre un diálogo etiquetado con foco, que Escape y el botón de cierre lo cierran y devuelven el foco, y que siguen disponibles omisión, orden y adaptaciones.
- [ ] Reubicar el panel existente en una hoja inferior accesible con agrupaciones visuales y controles táctiles; conservar la selección de catálogo al cerrar y reabrir.
- [ ] Ejecutar las pruebas de Entreno, la suite y la compilación; revisar visualmente cuando el navegador esté disponible.
