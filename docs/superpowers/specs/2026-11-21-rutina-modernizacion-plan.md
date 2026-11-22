# Modernización de Rutina: plan de implementación

> Ejecución inline mediante `executing-plans`; sin ramas ni commits sin autorización independiente.

**Objetivo:** completar las tres fases de la especificación, preservando los datos y flujos existentes.

**Diseño:** `docs/superpowers/specs/2026-11-21-rutina-modernizacion-design.md`. React, TypeScript, Dexie, Vitest y componentes existentes; sin dependencias adicionales.

**Riesgos prioritarios:** sesiones anteriores sin instantáneas; respaldo con campos nuevos; doble envío y cambios concurrentes; arrastre y navegación mediante teclado; fallos de IndexedDB sin pérdida de borradores.

## 1. Integridad de planificación

**Archivos:** `src/domains/routine/services.ts`, `services.test.ts`.

- [ ] Escribir y ejecutar pruebas fallidas para duplicación independiente, orden íntegro y rechazo de identificadores ajenos o repetidos.
- [ ] Corregir duplicación y validación transaccional de órdenes; incorporar `moveExerciseToDay(exerciseId, dayId)` con validación de pertenencia y orden coherente.
- [ ] Ejecutar pruebas del dominio de Rutina.

## 2. Instantáneas y compatibilidad

**Archivos:** `src/domains/workout/services.ts`, `types.ts`, `services.test.ts`; `src/domains/routine/services.ts`; `src/domains/progress/repository.ts`; `src/shared/validation/arsenImportSchemas.ts`; pruebas de progreso y respaldo.

- [ ] Probar que una sesión captura el plan y nombres, que las ediciones o eliminaciones posteriores no cambian sus datos y que las sesiones antiguas se preservan cuando sea posible.
- [ ] Implementar instantáneas opcionales, lecturas históricas compatibles y respaldo; eliminar la modificación automática del peso planificado al registrar series.
- [ ] Probar importación de datos antiguos y exportación/restauración de los nuevos campos.

## 3. UX de planificación

**Archivos:** `src/domains/routine/pages/RoutinePage.tsx`, pruebas correspondientes y componentes compartidos si resulta necesario.

- [ ] Cubrir tarjetas compactas, estados, menús, selector de días, movimiento entre días, acciones de orden y controles numéricos con pruebas de comportamiento.
- [ ] Reutilizar componentes y arrastre existentes con asa dedicada; aplicar menús accesibles, stepper, guardado y errores sin perder borradores.
- [ ] Verificar anchuras móviles, teclado y escritorio; efectuar critique, polish, audit y harden de Impeccable.

## 4. Integración y actualización opcional

**Archivos:** servicios y páginas de Entreno, Progreso e Historial y sus pruebas.

- [ ] Probar que Entreno usa el plan de sesión y que la propuesta solo modifica ejercicios y valores seleccionados, detecta conflictos, ignora ejercicios temporales y es segura ante repetición.
- [ ] Añadir revisión y confirmación explícita de propuestas basadas en series principales y navegación contextual a Historial con el filtro de rutina.
- [ ] Verificar transferencia, historial y cambios posteriores sin alterar registros previos.

## 5. Cierre

- [ ] Revisar el diff completo, límites de dominio, accesibilidad, compatibilidad y cambios no relacionados.
- [ ] Ejecutar `pnpm test`, `pnpm build` y el detector de Impeccable; registrar resultados y cualquier requisito pendiente sin declararlo completo.

## 6. Hoja de acciones y edición compacta

**Archivos:** `src/domains/routine/components/ExerciseActions.tsx` y su prueba; `src/domains/routine/pages/RoutinePage.tsx` y su prueba.

- [x] Probar que el icono abre una hoja identificada, contiene el foco, cierra con Escape y devuelve el foco; verificar mover, editar y reordenar.
- [x] Implementar la hoja inferior con las acciones existentes y sin anidar diálogos.
- [x] Probar secciones plegables de ajustes de día y opciones avanzadas de receta, incluyendo conservación de los valores al plegar y desplegar.
- [x] Ejecutar pruebas, build y detector. La inspección de tamaños móviles sigue pendiente: el entorno no proporciona navegador ni superficie de Computer Use.

## 7. Contraste de la hoja de acciones

- [x] Reproducir el primer plano ausente al montar la hoja fuera del shell.
- [x] Declarar el color de texto en la hoja y distinguir visualmente las acciones sin alterar sus comportamientos.
- [x] Ejecutar la suite completa y el build. La inspección visual sigue pendiente porque el entorno no dispone de navegador.
