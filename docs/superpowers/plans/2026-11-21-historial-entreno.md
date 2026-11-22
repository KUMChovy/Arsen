# Ajustes de entreno e historial — plan de implementación

> Ejecución: superpowers:executing-plans, completamente en línea; sin operaciones de Git sin aprobación expresa.

**Goal:** Mejorar la jerarquía visual del entreno y permitir consultar el historial filtrado por fecha y ejercicio.

**Architecture:** Reutilizar las consultas existentes, transportar los filtros pertinentes a la vista por fecha y filtrar sus ejercicios sin modificar datos guardados. Mantener la estructura y tokens actuales.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, Dexie, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-21-historial-entreno-design.md`.

## Restricciones y revisión

- Interfaz offline en español, ancho mínimo 360 px, controles accesibles y sin dependencias nuevas.
- Conservar edición, enlaces históricos y compatibilidad de consultas de otras pantallas.
- Verificar días con varias sesiones, ejercicio ausente, cambios de rutina/día, fecha sin sesiones y filtro activo en página posterior.

## Tarea 1: filtros compactos y coherencia de navegación

**Archivos:** `src/domains/progress/components/HistoryFilters.tsx`, sus pruebas, `src/domains/progress/pages/HistoryPage.tsx`, sus pruebas, `src/domains/progress/hooks.ts`, `src/domains/progress/components/HistoryView.tsx` y sus pruebas.

- [ ] Escribir pruebas fallidas de desplegable, fecha única, opciones dependientes y transmisión de filtros a la fecha seleccionada.
- [ ] Ejecutar las pruebas afectadas y comprobar que fallen por el comportamiento ausente.
- [ ] Implementar los filtros y la navegación por fecha, conservando filtros usados por otros clientes. Corregir dependencias reactivas de opciones; reiniciar la página de lista al cambiar resultados.
- [ ] Ejecutar pruebas afectadas y verificar paginación y cambios de selección.

## Tarea 2: detalle de fecha y búsqueda

**Archivos:** `src/domains/progress/pages/ProgressHistoryDatePage.tsx`, sus pruebas y, si es necesario, `src/domains/progress/hooks.ts` y `src/domains/progress/repository.ts` con sus pruebas.

- [ ] Escribir pruebas fallidas para varias sesiones, filtro de ejercicio transferido, búsqueda sin coincidencias y combinación con filtros.
- [ ] Ejecutar las pruebas y comprobar que fallen por el comportamiento ausente.
- [ ] Implementar búsqueda y filtros compactos en el detalle, con nombres históricos y preservando acciones de edición y creación.
- [ ] Ejecutar pruebas afectadas y comprobar que los filtros no alteran datos.

## Tarea 3: jerarquía visual

**Archivos:** `src/domains/workout/pages/WorkoutPage.tsx`, `src/app/navigation.tsx`, `src/app/AppShell.tsx` y pruebas afectadas.

- [ ] Añadir pruebas de navegación central, estado activo y conservación de controles del ejercicio actual; ejecutarlas y observar el fallo pertinente.
- [ ] Ajustar la escala del arte y destacar Entreno con tokens existentes, conservando accesibilidad y espacio para nombres largos.
- [ ] Ejecutar pruebas afectadas y revisar visualmente a 360 y 430 px.

## Tarea 4: revisión y verificación

- [ ] Revisar el diff completo, aplicar critique/polish y audit/harden de Impeccable y ejecutar su detector una sola vez.
- [ ] Ejecutar `pnpm test` y `pnpm build`; revisar resultados y corregir fallos atribuibles al cambio.
- [ ] Informar las verificaciones, limitaciones y cualquier deriva de documentación de diseño.

## Tarea 5: conservar un solo detalle de sesión

**Archivos:** `src/domains/progress/pages/ProgressHistoryDatePage.tsx`, `src/domains/progress/pages/ProgressHistorySessionPage.tsx`, sus pruebas y `src/domains/progress/pages/HistoryPage.tsx`.

- [ ] Escribir y ejecutar pruebas fallidas para abrir cada sesión desde la fecha, conservar el filtro de ejercicio y buscar en el detalle completo.
- [ ] Eliminar el detalle y edición duplicados de la pantalla por fecha, manteniendo selección entre sesiones, creación manual, filtros y compatibilidad de rutas.
- [ ] Aplicar filtro y búsqueda a las tarjetas del detalle completo sin cambiar sus totales ni acciones; mantener el contexto al navegar desde el calendario y la lista.
- [ ] Ejecutar pruebas afectadas, revisar el diff y ejecutar la suite y compilación completas.

## Tarea 6: tarjetas de ejercicios

**Archivos:** `src/domains/progress/pages/ProgressHistorySessionPage.tsx`, `src/domains/workout/pages/WorkoutPage.tsx` y sus pruebas.

- [ ] Probar que el detalle de sesión inicia con ejercicios cerrados y que puede abrirse cada tarjeta.
- [ ] Probar que Entreno presenta tarjetas con el estilo de historial y mantiene sus acciones, estados y navegación entre ejercicios.
- [ ] Implementar los cambios mínimos respetando filtros, registros y manejo de errores.
- [ ] Ejecutar pruebas afectadas, revisión visual disponible, detector, suite y compilación completas.

## Tarea 7: aviso de sesión pendiente

**Archivos:** `src/domains/workout/pages/WorkoutPage.tsx`, `src/domains/workout/pages/WorkoutPage.test.tsx`, `src/styles.css`.

- [ ] Probar que el aviso comunica la sesión pendiente y continúa la sesión correspondiente, sin habilitar acciones bloqueadas.
- [ ] Crear un aviso con entrada y señal de actividad breves, manteniendo controles accesibles y alternativa para movimiento reducido.
- [ ] Ejecutar pruebas afectadas, detector y verificaciones completas.
