# Experiencia móvil — plan inline

**Diseño:** `docs/superpowers/specs/2026-11-25-experiencia-movil-design.md`.

1. Probar y conectar el botón central de `src/app/AppShell.tsx` con el ejercicio visible de `src/domains/workout/pages/WorkoutPage.tsx`; conservar navegación en otras rutas, estado sin ejercicio y duplicación existente. Eliminar el botón redundante de la tarjeta.
2. Probar la transición a todos hechos y usar el sheet de finalización existente; impedir aperturas por carga inicial de sesiones completas o ejercicios saltados, sin finalizar automáticamente.
3. Agrupar los controles existentes en `src/domains/settings/pages/SettingsPage.tsx` con categorías accesibles y revisar `src/domains/account/pages/AccountPage.tsx`; comprobar todas las acciones, selección y confirmaciones.
4. Diseñar persistencia local y construir centro de notificaciones accesible con historial, deduplicación y descarte por gesto; conectar avisos de sesión pendiente, deload y día por retomar sin alterar acciones de entrenamiento o confirmaciones destructivas. Cubrir persistencia y gestos.
5. Revisar interfaz móvil, flujos de error y foco; ejecutar pruebas y build. Documentar límites de verificación y mantener servicios externos sin cambios.
