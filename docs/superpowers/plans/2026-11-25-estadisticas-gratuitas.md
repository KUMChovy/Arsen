# Estadísticas gratuitas — plan inline

**Sustituido:** el propietario solicitó después consumo cero para estas métricas. Se retiraron la consulta y la ruta añadidas; el resumen previo permanece sin cambios.

**Diseño:** `docs/superpowers/specs/2026-11-25-estadisticas-gratuitas-diseno.md`.

1. Añadir pruebas con PGlite y dobles para una consulta agregada de estadísticas: acceso únicamente a administradores; datos propios y bytes de respaldo; errores de Clerk sin filtrar secretos; conteo de Clerk válido e inválido.
2. Implementar la operación en servidor y una ruta GET separada en el manejador administrativo; no modificar el contrato de `overview`, no consultar Blob ni revelar credenciales.
3. Añadir método validado al cliente y presentar las métricas y ausencias en el resumen. Cubrir respuesta antigua o no disponible y mantener utilizable el resumen original.
4. Ejecutar pruebas de servidor y panel, suite completa, compilación de app, panel y servidor; revisar cambios inline y documentar limitaciones y ausencia de despliegue.
