# Recorrido inicial y asistente — plan inline

**Diseño:** `docs/superpowers/specs/2026-11-25-tour-asistente-rutina-design.md`.

1. Añadir pruebas de inicialización para que solo instalaciones nuevas reciban una marca local del tour; completar u omitir debe persistir sin modificar los datos de entrenamiento.
2. Implementar coach marks accesibles en `src/app/`, asociados a la navegación existente; probar secuencia, omisión, persistencia y ausencia del elemento objetivo.
3. Probar un servicio de creación atómica para nombre, días y ejercicios del catálogo, incluidos fallo y rollback. Implementarlo reutilizando las operaciones y validaciones de `src/domains/routine/services.ts`.
4. Crear un diálogo de pasos en `src/domains/routine/components/` y conectarlo a las acciones existentes de creación en `RoutinePage.tsx`. Probar validación, retroceso, cancelación, errores y prevención de doble envío.
5. Revisar accesibilidad y estados móviles, ejecutar pruebas y compilación. Registrar las verificaciones de dispositivo o visualización que no se hayan podido realizar. No desplegar ni ejecutar operaciones Git sin autorización.
