# Estadísticas gratuitas en el resumen administrativo

**Cambio posterior del propietario:** las métricas nuevas no deben consumir recursos. Se retira la consulta adicional y la ruta de estadísticas; el resumen anterior conserva sus consultas existentes. Las métricas remotas en vivo no pueden garantizar consumo cero.

El propietario solicita recuperar la mayor cantidad posible de estadísticas sin contratar servicios adicionales. El resumen existente conserva su contrato y se amplía con una consulta administrativa independiente de solo lectura. La interfaz distingue claramente datos observados, valores no disponibles y métricas facturables que no se pueden recuperar de forma fiable.

Para un administrador autenticado, consultar en Neon el tamaño de la base actual, respaldos confirmados y pendientes, sus bytes declarados y trabajos de limpieza pendientes; consultar en Clerk el número total de usuarios registrados. El tamaño de la base no es el consumo facturable total de Neon ni el tamaño agregado de Blob. Los bytes de respaldos son metadatos de Arsen, no una medición completa del almacén. No mostrar contenidos, identificadores personales, tokens ni cuotas supuestas.

Una falla o ausencia de permisos en un proveedor produce únicamente un estado no disponible para su métrica. La consulta a Clerk usa su clave en servidor, HTTPS, tiempo límite, sin redirecciones y validación estricta del conteo. Todas las rutas comprueban el rol administrador en servidor y responden sin caché. No enumerar Blob periódicamente: sus listados consumen operaciones. No introducir suscripciones, credenciales nuevas ni cambios externos; las cifras de facturación y cuotas quedan fuera hasta comprobar acceso y plan efectivos.
