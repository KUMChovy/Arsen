# Plan: eliminación de cuentas

1. Añadir migración para estado durable y auditoría de operaciones; pruebas con PostgreSQL aislado.
2. Implementar operación administrativa por etapas con sesión, permisos, protección del último administrador y autoeliminación, bloqueos, esperas, lotes, reintentos y fallos; TDD y pruebas de aislamiento.
3. Integrar adaptadores Clerk/Blob, rutas, estado paginado y respuestas limitadas sin secretos.
4. Añadir al panel confirmación clara, estado y reintento, con pruebas de accesibilidad y cambios de sesión.
5. Revisar, ejecutar pruebas y builds; documentar lo no probado y no activar ni aplicar migración sin autorización.
