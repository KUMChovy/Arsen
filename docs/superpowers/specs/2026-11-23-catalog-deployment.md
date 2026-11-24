# Configuración pendiente del catálogo público

Las rutas `/api/v1/catalog` y `/api/v1/catalog/version` devuelven 503 por defecto. No habilitarlas hasta completar las comprobaciones siguientes en el entorno de destino:

1. Configurar `DATABASE_URL` exclusivamente en Vercel y aplicar `server/migrations/002_catalog.sql` en una base aislada. Verificar la migración y cargar el catálogo inicial con imágenes válidas; la migración crea la versión 0 y las rutas no la sirven como catálogo publicado.
2. Configurar y probar una regla distribuida del firewall de Vercel para las rutas `/api/v1/catalog*`, limitada por IP. Como punto de partida, usar 120 solicitudes por IP cada 10 minutos y respuesta 429; ajustar con mediciones reales. Verificar desde fuera que el límite se aplica antes de habilitar las rutas. Vercel documenta el límite por IP en todos los planes y una regla de límite por proyecto en Hobby: https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting.
3. Configurar HTTPS y CORS de solo lectura para los recursos de imagen. Verificar disponibilidad, tamaño, tipo y SHA-256 antes de publicar. El verificador de imágenes del servidor aún no está conectado a un proveedor real de objetos.
4. Solo después de esas verificaciones, configurar `CATALOG_PUBLIC_ENABLED=true` en el entorno del servidor. Esa variable es un interruptor de activación, no comprueba que la regla del firewall esté configurada.
5. Para la compilación Android, configurar `VITE_CATALOG_API_ORIGIN` con el origen HTTPS público, sin secretos; una cadena vacía deja desactivadas las consultas. Validar respuesta de versión, descarga y reconexión en la APK.

La lectura y publicación existentes se han probado localmente, pero las rutas no están desplegadas, el catálogo inicial no está cargado y la regla de firewall no está configurada. No se han verificado límites de cuota con tráfico real.

## Ruta privada de cuenta

La ruta `GET /api/v1/account` permanece desactivada salvo `ACCOUNT_API_ENABLED=true`. Antes de activarla es necesario aplicar las migraciones en el entorno de destino, crear de forma controlada el primer perfil administrador, configurar `DATABASE_URL` y `CLERK_SECRET_KEY` como variables privadas de Vercel, y establecer `CLERK_ISSUER` como el origen HTTPS exacto de la instancia Clerk y `ACCOUNT_ALLOWED_ORIGINS` como una lista separada por comas de orígenes HTTPS exactos de los clientes autorizados. No anteponer `VITE_` a secretos. `CLERK_ALLOW_NATIVE_NO_AZP=true` solo se utiliza después de comprobar el flujo nativo sin `azp`; no elimina las comprobaciones de firma, emisor y sesión activa.

Antes de habilitar el endpoint, verificar las reglas distribuidas de protección y límites de solicitudes para las rutas privadas, probar autorización con dos cuentas y una sesión revocada, y comprobar el origen y la renovación de sesión en Android. La ruta, por sí sola, no implementa registro, gestión de invitaciones, respaldos ni acceso de administrador. Las claves de desarrollo no se deben usar para producción.
