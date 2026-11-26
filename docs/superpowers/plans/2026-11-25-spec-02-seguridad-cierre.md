# SPEC 02: seguridad y cierre — plan de ejecución

**Objetivo:** reunir evidencia y completar los controles de seguridad, operación y entrega descritos en la especificación.

**Diseño:** `docs/superpowers/specs/2026-11-25-spec-02-seguridad-cierre-diseno.md`. Ejecución inline; ninguna operación externa, destructiva o de Git sin autorización aplicable.

1. Auditar código, pruebas y estado local; distinguir explícitamente entorno real, simulación y pruebas pendientes. Registrar hallazgos en `docs/spec-02-evidencia-cierre.md`.
2. Investigar cada fallo hasta su causa; para los cambios necesarios, preparar pruebas reproducibles y aplicar el cambio mínimo con TDD. Mantener intactos los datos y los controles existentes.
3. Completar la matriz trazable a la especificación y documentar configuración, retención, recuperación, límites, operación y autorizaciones en el mismo registro. No retirar exportaciones sin paridad demostrada.
4. Ejecutar pruebas web, compilaciones y pruebas Android; preparar una APK identificable sin instalarla ni publicarla. Registrar fallos, omisiones y evidencia verificable.
5. Revisar los cambios inline y contrastar cada criterio. Las pruebas con dispositivos, tiempo real y servicios externos quedan pendientes hasta disponer de autorización y evidencia.

**Focos de revisión:** confirmaciones concurrentes con limpieza; listado incompleto o error de almacenamiento; sesión revocada o cambio de cuenta; recuperación ante pérdida de red; tratamiento de salud sin consentimiento.
