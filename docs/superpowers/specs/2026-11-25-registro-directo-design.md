# Registro directo y activación de cuenta

El propietario solicita que cualquier persona pueda registrarse desde la app y usar sus funciones, incluidos respaldos, sin invitación. Esta decisión sustituye el requisito anterior de acceso únicamente por invitación. Se mantiene acceso local como invitado y el control administrativo exclusivamente en servidor.

La activación existente verificará sesión de Clerk, identidad y correo principal verificado y creará idempotentemente un perfil con el rol por defecto `user`. Nunca aceptará un rol del cliente ni modificará el rol de un perfil existente. Las cuentas bloqueadas y sesiones inválidas continuarán rechazadas. Los registros existentes sin perfil se activarán al volver a solicitar respaldo después de verificar su correo. Los controles existentes de autorización, propiedad y consentimiento de salud permanecen vigentes.

La pantalla inicial conservará su disposición y cambiará únicamente los textos que afirman que se necesita invitación. Errores y cancelación seguirán sin conceder acceso automáticamente. Las pruebas con proveedores simulados y base aislada comprobarán activación, reintentos, sesión inválida, correo no verificado, identidad discordante y preservación de roles. El despliegue, configuración real de Clerk y prueba en teléfono se validarán por separado; no cambiar datos o servicios externos sin autorización aplicable.
