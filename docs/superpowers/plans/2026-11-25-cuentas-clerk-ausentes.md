# Corrección de eliminación de cuentas ausentes en Clerk

**Objetivo:** permitir continuar una eliminación pendiente cuando Clerk confirme que la identidad ya no existe.

**Plan:** reproducir con pruebas el 404 `resource_not_found` y rechazar respuestas ambiguas; ajustar el adaptador de Clerk sin modificar la espera de seguridad; ejecutar pruebas y compilación; publicar en Preview y comprobar el rechazo de solicitudes sin autenticación. No ejecutar eliminaciones reales durante la verificación.
