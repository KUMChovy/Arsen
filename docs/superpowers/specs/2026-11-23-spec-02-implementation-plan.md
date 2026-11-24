# Plan de implementación: SPEC 02

> Ejecución: `executing-plans`, completamente inline. Las pruebas se escriben primero y cada entrega se verifica antes de continuar. No crear ramas, worktrees ni commits sin autorización expresa.

**Objetivo:** añadir cuentas opcionales, respaldo y restauración seguros, catálogo global offline y administración privada a ARSEN sin afectar el entrenamiento local.

**Arquitectura:** IndexedDB sigue siendo la fuente local; la API TypeScript valida sesiones, permisos y contratos, Neon PostgreSQL conserva metadatos y versiones, y almacenamiento de objetos privado conserva bytes. Android prepara instantáneas en el WebView y WorkManager las envía desde almacenamiento nativo. El catálogo tiene almacenamiento y sincronización independientes.

**Tecnología:** React 19, TypeScript, Dexie, Capacitor 8, Kotlin, WorkManager, Vercel, Neon PostgreSQL, almacenamiento de objetos, Zod y Vitest. El propietario eligió evaluar Clerk para invitaciones; la integración y la reanudación de sesión nativa siguen pendientes de comprobación.

**Diseño:** `docs/superpowers/specs/2026-11-23-spec-02-architecture-design.md`; la SPEC 02 entregada por el propietario y su anexo de 72 horas prevalecen como requisitos de producto.

## Restricciones globales

- SPEC 01 está completada según confirmó el propietario; preservar los cambios existentes y el contrato local.
- Entrenamiento, rutinas, historial, progreso y catálogo ya descargado funcionan sin conexión ni cuenta.
- La web se limita a administración. No almacenar secretos de servidor en los clientes.
- Los respaldos se acumulan localmente y se envían cada 72 horas aproximadamente; no enviar uno por entrenamiento. El usuario puede solicitar uno manualmente.
- Las instantáneas incluyen datos personales y recursos necesarios; excluyen catálogo global, cachés, credenciales y salud sin consentimiento explícito.
- Mantener hasta cinco versiones confirmadas; no eliminar una versión válida antes de confirmar la nueva.
- Los invitados reciben el mismo catálogo publicado sin iniciar sesión ni actualizar la APK.
- No retirar importaciones ni exportaciones antiguas hasta verificar restauración y respaldo remotos.
- Las pruebas en dispositivo real se realizarán cuando el propietario tenga la nueva APK; hasta entonces registrar esa verificación como pendiente.

## Riesgos de revisión

1. Una cuenta solicita o sustituye objetos de otra: autorización por usuario en todas las rutas, cargas y descargas (tareas 2 y 4).
2. Una confirmación o limpieza falla a mitad del proceso: preservar la última versión válida y repetir sin duplicar (tarea 4).
3. Un cambio posterior a la instantánea se marca como respaldado: confirmar solo la revisión enviada (tareas 5 y 7).
4. Una descarga de catálogo se interrumpe: conservar la versión y las imágenes anteriores (tareas 9 y 10).
5. Un resumen de salud se incluye sin permiso o una restauración falla: excluirlo por defecto y mantener intacta la base local (tareas 5 y 6).

## Mapa de archivos

- `src/shared/validation/remoteBackup.ts`: contrato de metadatos; `src/shared/validation/remoteCatalog.ts`: contratos públicos y administrativos.
- `server/`: API, autorización, adaptadores de autenticación, almacenamiento y PostgreSQL; `server/migrations/`: esquema SQL versionado; pruebas junto a cada módulo. `api/`: adaptador de despliegue Vercel.
- `src/domains/account/`: estado de cuenta, sesión y puente nativo; `src/domains/settings/`: interfaz de cuenta y respaldo.
- `src/db/contractBackup.ts`, `src/db/schema.ts` y `src/db/revisionTracking.ts`: instantáneas, restauración y revisiones.
- `android/app/src/main/kotlin/com/kumchovy/arsen/codex/backup/`: puente, almacenamiento protegido y trabajador. Pruebas Kotlin en rutas correspondientes de `src/test` y `src/androidTest`.
- `src/domains/routine/`: repositorio y sincronización del catálogo global; conservar las recetas personales existentes.
- `admin/`: aplicación web privada responsive; comparte contratos con `src/shared/validation/` y no duplica reglas de autorización del servidor.

## Tarea 1: contrato y línea base

**Archivos:** `src/shared/validation/remoteBackup.ts`, `src/shared/validation/remoteBackup.test.ts`, `src/db/contractBackup.ts`.

- [x] Validar metadatos de preparación: UUID, versión, revisión, versión base, hash, tamaño y declaración de consentimiento; rechazar campos desconocidos.
- [x] Ejecutar `node node_modules/vitest/vitest.mjs run src/shared/validation/remoteBackup.test.ts` y comprobar las cuatro pruebas.
- [ ] Confirmar mediante una prueba de integración que el servidor no usa `healthConsent` como prueba suficiente de consentimiento ni acepta un `userId` enviado por el cliente.
- [ ] Revisar el contrato existente antes de usarlo para transporte: actualmente `createContractBackup()` incluye salud y copias locales del catálogo.

## Tarea 2: API, autenticación y roles

**Archivos:** `server/auth/`, `server/http/`, `server/migrations/`, `api/`, `package.json` y pruebas de servidor.

Adaptación Clerk: probar la migración en PostgreSQL sin el esquema `neon_auth`; conservar las restricciones de perfil, rol, invitación y dispositivo. Cambiar el canje local para aceptar exclusivamente identidad y correo verificado proporcionados por código de servidor, con pruebas de correo erróneo, falta de verificación, vencimiento y concurrencia. No exponer rutas hasta conectar la comprobación de sesión real de Clerk. Probar toda la suite de servidor y tipos; no ejecutar migraciones remotas automáticamente.

Avance: migración y canje probados sin esquema `neon_auth`; los perfiles son identidades externas y solo deben ser creados por el servidor tras autenticación. Existe un verificador de sesión Clerk y un lector de la API probados con respuestas simuladas. Aún no están conectados a rutas ni probados con la instancia real, y la limpieza ante eliminación de usuarios de Clerk debe diseñarse sin borrar respaldos inesperadamente. El propietario confirmó que activó «Invite-only».

Verificador Clerk: usar firmas reales en pruebas para aceptar únicamente tokens RS256 del emisor configurado con `sub`, `sid`, `exp` y `nbf`, controlar `azp` y rechazar sesiones no activas o pertenecientes a otro usuario. El lector de sesiones es inyectado para probar el límite con el proveedor; un adaptador de red separado utilizará el Backend API oficial con credenciales solo en servidor.

Activación de invitaciones: consultar directamente Clerk con el identificador derivado del token verificado, exigir cuenta no bloqueada y correo principal verificado, y pasar esa identidad al canje local. Probar identidad ajena, correo sin verificar y proveedor no disponible; no aceptar correo ni ID en la solicitud del cliente. Esta base no se publica hasta resolver la integración con las invitaciones nativas de Clerk y verificar las credenciales reales.

Una sola invitación: leer del perfil obtenido por Backend API el UUID no secreto colocado en `public_metadata.arsen_invitation_id` por el servidor al crear la invitación Clerk; canjear en PostgreSQL únicamente si coincide el correo principal verificado, sin aceptar el UUID del cliente. Probar ausencias, coincidencia y consumo único. La creación en Clerk y los reintentos entre servicios siguen siendo tareas independientes pendientes.

La activación es idempotente para la misma cuenta: una repetición aceptada previamente devuelve éxito solo cuando el registro de invitación coincide con el usuario y correo verificado y el perfil sigue existiendo. Un usuario diferente nunca puede reutilizarla. Probar dos intentos simultáneos y pérdida de la primera respuesta antes de conectar la ruta.

Transporte de cuenta: agregar rutas privadas `POST /api/v1/account/activate` y `POST /api/v1/account/devices` al manejador de cuenta existente. La activación verifica la sesión de Clerk sin exigir perfil previo y consulta la identidad del proveedor; la vinculación exige perfil y toma su dueño de la sesión. Limitar los cuerpos, mantener CORS explícito y `no-store`, rechazar métodos incorrectos y no filtrar errores internos. Usar el adaptador Vercel desactivado por defecto; probar sesión ausente, activación, cuerpo inválido, perfil y origen.

Invitaciones administrativas: agregar `POST /api/v1/admin/invitations` con cuerpo JSON acotado y CORS por lista explícita; reutilizar la autorización de administrador y el envío recuperable ya probados. No exponer tokens ni mensajes internos. El adaptador requiere `ADMIN_API_ENABLED=true` y configuración completa y permanece desactivado hasta verificar límites de tráfico y el flujo nativo. Las pruebas no deben enviar correos reales.

Avance: la ruta y el adaptador existen y están deshabilitados por defecto. Falta incorporar auditoría de creación, proteger tráfico y verificar el flujo real y nativo antes de habilitarlos; no se enviaron correos durante las pruebas.

Auditoría de invitaciones: migración aditiva 005 con registro de actor, acción, UUID de objetivo y fecha, sin correos ni tokens. Crear invitación local y auditoría en una sola sentencia; no contactar Clerk si la auditoría falla y no duplicarla en reintentos. Probar rollback, reintento, aislamiento y roles; verificar la migración en Neon mediante rollback antes de aplicarla en desarrollo.

Avance: la auditoría y sus pruebas están implementadas. La migración 005 pasó primero una prueba real revertida y después se aplicó a Neon de desarrollo. Las invitaciones siguen sin habilitarse en despliegue y no se han enviado correos.

Creación recuperable: la operación de servidor exige rol administrador y recibe un UUID de idempotencia y correo. Guarda primero el registro local; antes de solicitar una invitación de Clerk consulta si ya existe una con el mismo correo y marcador. Si la respuesta de creación se pierde, un reintento conserva el UUID y busca el marcador antes de volver a intentar; una coincidencia con otro correo se rechaza. El adaptador real debe paginar los resultados de Clerk y comparar correo y metadatos exactos, no asumir que un error de red significa que no se envió correo. No se publicará hasta comprobar permisos, límites y comportamiento real.

Avance: el canje mediante metadatos y la creación recuperable están probados contra PostgreSQL embebido con el proveedor simulado. Existe un adaptador HTTP para listar y crear invitaciones, con paginación, búsqueda de revocadas y pruebas simuladas; aún debe verificarse contra Clerk real. Los límites de solicitudes, la interfaz y la integración de extremo a extremo siguen pendientes; no se ha enviado ninguna invitación.

Consulta privada de cuenta: implementar `GET` con sesión comprobada y perfil existente, respuesta sin caché y CORS restringido a orígenes explícitos; responder la comprobación previa solo a orígenes permitidos. Probar ausencia de sesión, rol desconocido, origen no permitido y métodos distintos. Mantener cualquier adaptador de despliegue deshabilitado hasta validar issuer, claves, origen nativo y servicios reales.

Adaptador Vercel: leer únicamente en servidor `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_ISSUER` HTTPS y `ACCOUNT_ALLOWED_ORIGINS`; crear verificador JWKS y consulta de rol con Neon. Por defecto responde 503 salvo que `ACCOUNT_API_ENABLED=true` y toda la configuración sea válida. Permitir tokens nativos sin `azp` solo mediante `CLERK_ALLOW_NATIVE_NO_AZP=true`. Probar que sin configuración y con issuer inválido permanece cerrado; no activar ni desplegar hasta verificar WAF, sesión y acceso nativo.

Avance: la ruta y su adaptador existen y están deshabilitados por defecto; pruebas locales cubren sesión, perfil, CORS y configuración incompleta. Neon respondió a una consulta de solo lectura y las migraciones 001–003 se ejecutaron en una transacción revertida, sin dejar tablas. Clerk Development respondió con usuario de prueba verificado; el lector de identidad y la consulta de invitaciones se comprobaron en modo de solo lectura y las claves públicas del dominio coincidieron con la instancia. Falta probar un token de una sesión real, crear el primer administrador de manera segura y completar las rutas restantes; no se ha aplicado una migración permanente ni publicado la ruta.

Actualización: un token temporal emitido por Backend API para una sesión real de desarrollo pasó el verificador de firma, emisor y estado de sesión. La consulta de sesiones requiere `user_id`; las comprobaciones previas que informaron «no identificada» sin ese filtro no eran concluyentes. Aún falta verificar un token obtenido mediante el SDK Android y la rehidratación en segundo plano, crear el primer administrador y habilitar rutas de forma segura.

Vinculación de dispositivo en servidor: validar UUID y sesión con perfil registrado, insertar la relación usuario-dispositivo sin confiar en un usuario del cliente y permitir que el propietario repita la operación. Un identificador perteneciente a otra cuenta se rechaza sin reasignarlo; probar autorización ausente, valores inválidos, reintento y colisión entre cuentas en PostgreSQL embebido. No exponer la operación hasta conectar la autorización y la interfaz de vinculación.

Administrador inicial de desarrollo: implementar una función solo de servidor que acepte una identidad obtenida de Clerk y rechace entornos no `development`, correo no verificado o identificador inválido. Bajo bloqueo exclusivo, crear el perfil administrador únicamente si no existen perfiles; no convertir cuentas existentes ni aceptar identidad desde una ruta pública. Probar fallos, repetición y competencia. La prueba real podrá utilizar la única cuenta de prueba del propietario tras comprobar que su sesión sigue activa y que la base sigue vacía; no usar el procedimiento para producción.

- [ ] Probar sesión ausente, expirada y revocada; ninguna puede leer o escribir datos privados. Probar que un usuario común recibe 403 en cada acción administrativa.
- [ ] Implementar verificación de sesión en servidor y resolución de roles desde datos confiables. Registrar perfiles, invitaciones y dispositivos con restricciones de unicidad y claves foráneas; preparar un procedimiento de administrador ejecutado solo desde el servidor.
- [ ] Probar registro con invitación válida, invitación usada y registro no autorizado; evitar que una petición cambie su propio rol.
- [ ] Evaluar e implementar registro restringido, acceso, recuperación y cierre con Clerk conservando Neon PostgreSQL. Rediseñar la migración dependiente de Neon Auth y verificar el mecanismo nativo de sesión y renovación sin WebView antes de comprometerlo con WorkManager.
- [ ] Ejecutar las pruebas del adaptador y una prueba integrada contra una instancia Neon aislada cuando esté configurada; registrar los resultados y los servicios pendientes si no existe esa instancia.

## Tarea 3: almacenamiento y modelo remoto

**Archivos:** `server/migrations/`, `server/storage/`, `server/backups/` y sus pruebas.

Adaptador transaccional Neon: las operaciones condicionales de reserva y confirmación necesitan una conexión interactiva, no la API HTTP de lotes. Usar el `Pool` del controlador Neon por WebSocket; iniciar, confirmar o revertir explícitamente y liberar siempre el cliente, sin registrar credenciales. Probar commit, rollback y liberación, y ejecutar una prueba real temporal con rollback antes de conectar rutas.

Avance: el adaptador ya está probado con fallos de inicio y reversión; una prueba optativa se conectó a Neon real, creó una tabla temporal, forzó rollback y confirmó su ausencia en la misma conexión. Las rutas que lo utilicen deben cerrar el pool al terminar y manejar respuestas indeterminadas de commit mediante operaciones idempotentes.

Lector privado: derivar las rutas de objetos de un hash del propietario autenticado, UUID del respaldo y hash del identificador de cada imagen; no aceptar rutas del cliente. Leer con acceso privado y sin caché, limitar los bytes durante la transferencia y rechazar tamaños anunciados incoherentes. Probar aislamiento de rutas, límites e interrupciones. Este lector no demuestra inmutabilidad por sí solo; la carga deberá impedir sobrescrituras y la eliminación deberá respetar referencias antes de conectar la confirmación.

Avance: `createPrivateBlobReader` y su adaptador Vercel Blob derivan rutas de propiedad, desactivan caché CDN y rechazan tamaños excesivos, componentes incompletos y rutas inesperadas; están probados con flujos simulados. Falta un límite agregado de tamaño definido en el servidor y verificar el almacenamiento real. No se conectan aún a confirmación ni a rutas públicas.

Firma de carga privada: reutilizar la misma función de rutas del lector y generar una URL PUT acotada a una ruta, tipo, tamaño y cinco minutos, con sobrescritura y sufijos aleatorios deshabilitados. No devolver el token maestro ni el material de delegación. Probar restricciones con el SDK simulado. La función que autorice cada componente debe verificar propietario, estado pendiente y manifiesto antes de solicitar la firma; ningún firmador se expondrá directamente.

El firmador de Vercel Blob ya existe y está probado con el SDK simulado; todavía no se ha probado contra un bucket real ni se ha conectado a la autorización de componentes. La confirmación rechaza una copia con salud sin leer sus objetos cuando el consentimiento ya fue retirado y vuelve a comprobarlo después de verificarlos.

Autorización del manifiesto: recibir UUID y tamaño, comprobar sesión y rol, consultar el respaldo pendiente por propietario derivado de la sesión y exigir tamaño positivo menor o igual al tamaño total declarado y a 4 MiB. Consultar consentimiento actual antes de permitir una carga con salud. Solo entonces invocar el firmador con la ruta de manifiesto; pruebas con dos cuentas, estado confirmado, salud sin consentimiento y tamaños inválidos. El llamador de transporte deberá limitar el cuerpo, enviar `Cache-Control: no-store` y aplicar límites de frecuencia.

Avance: la autorización y sus pruebas están implementadas; todavía no está conectada a una ruta ni a un Blob real. Las autorizaciones de componentes binarios requieren además comprobar la pertenencia al manifiesto y limitar el tamaño agregado antes de poder publicarse.

Reserva de componentes: crear `server/migrations/004_backup_components.sql` con claves de componente y tamaño ligados al respaldo y propietario mediante claves foráneas. Validar el manifiesto realmente subido antes de reservar; aceptar únicamente sus IDs, asociar sus hashes a los tamaños solicitados, exigir suma exacta incluyendo manifiesto y límite agregado de servidor. Bajo bloqueo del perfil, volver a comprobar propiedad, estado y consentimiento y registrar componentes atómicamente. Probar manifiesto alterado, componentes ajenos, duplicados, suma diferente, reintento idéntico y conflicto con una reserva ya existente, sin publicar rutas todavía.

Avance: la migración y la reserva transaccional están probadas localmente, incluido rollback al fallar una inserción; las cuatro migraciones se probaron en Neon dentro de una transacción revertida. Falta conectar los tamaños reservados al firmador y verificar el flujo en un Blob real.

Autorización de componentes: comprobar sesión, propietario, respaldo pendiente, consentimiento actual y componente ya reservado; usar exclusivamente su tamaño guardado y derivar la ruta del identificador presentado. Probar identidad ajena, ID no reservado y consentimiento retirado. El transporte limitará cuerpo, frecuencia y caché antes de publicar la función. Implementado y probado localmente; falta conexión de transporte y validación con Blob real.

- [ ] Probar que solo el propietario obtiene autorizaciones temporales para sus propios objetos y que no se aceptan rutas arbitrarias, tamaño excesivo ni tipo inválido.
- [ ] Crear tablas de dispositivos, revisiones, respaldos, componentes y auditoría, con claves únicas, relaciones y estados de carga confirmada. Separar recursos públicos y privados.
- [ ] Implementar carga directa autorizada y lectura privada de objetos para eludir el límite predeterminado de Vercel; verificar tamaño y hash real antes de confirmar. Ninguna credencial permanente llega a Android o al panel.
- [ ] Comprobar expiración, cargas interrumpidas, objetos incompletos y limpieza que nunca borre un objeto referenciado por una versión confirmada.

## Tarea 4: API de respaldos y conflictos

**Archivos:** `server/backups/`, `server/http/`, `api/`, contratos y pruebas integradas.

Avance parcial: `prepareBackup` valida una petición acotada, deriva el propietario de autorización, bloquea el perfil durante la decisión, comprueba dispositivo, consentimiento de salud guardado y versión base, y reutiliza metadatos pendientes idénticos. `confirmBackup` vuelve a comprobar propietario, consentimiento y versión base después de llamar a un verificador de objetos inyectado, y confirma de forma idempotente bajo bloqueo del perfil. El validador del manifiesto comprueba hash, tamaño acotado, contrato, versión de esquema, relaciones, imágenes declaradas y salud. `verifyArchive` valida los hashes de los binarios y el tamaño agregado, definido como bytes del manifiesto más bytes de los componentes. Todavía no hay un adaptador de almacenamiento real que limite la lectura durante la transferencia, garantice propiedad y versiones inmutables; estas funciones no están expuestas como rutas y no se deben conectar hasta completar ese adaptador y la revocación de sesión.

Listado privado: aceptar solo `GET` autenticado, derivar el propietario de la sesión y devolver metadatos de hasta cinco versiones confirmadas propias en orden descendente, sin manifiestos, datos de salud ni cargas pendientes. Probar aislamiento entre cuentas, ausencia de sesión y orden con PostgreSQL embebido. No exponer hasta conectar almacenamiento y las demás rutas privadas.

Descarga privada: firmar una URL GET de corta duración para una ruta derivada del propietario, respaldo y componente, sin caché y sin revelar material de delegación. Antes de firmar, comprobar sesión, propiedad, respaldo confirmado y consentimiento vigente si contiene salud; para imágenes exigir un componente previamente reservado. No aceptar rutas, dueños ni tamaños del cliente. Probar aislamiento de cuentas, cargas pendientes, componentes desconocidos y permisos retirados. La ruta y el bucket real siguen pendientes.

Retención transaccional: migración 006 ajusta la relación de respaldo base para que una eliminación solo limpie el ID base, preservando el propietario, y crea una cola duradera de objetos pendientes de limpieza. Al confirmar una versión, conservar cinco y registrar las versiones excedentes para limpieza en la misma transacción, sin borrar objetos durante la confirmación. Usar `clock_timestamp()` para ordenar confirmaciones después de esperar el bloqueo. Probar rollback ante fallo de cola, claves base de referencias antiguas, aislamiento de cuentas y el último respaldo válido; la limpieza efectiva de Blob y la demora de expiración se implementan y verifican por separado.

Avance: migración y retención transaccional probadas localmente, con rollback si falla la cola, límite de cinco y protección frente a la reutilización de un UUID pendiente de limpieza. La migración 006 pasó una prueba real revertida y se aplicó a Neon de desarrollo tras verificar que aún no había respaldos. Los objetos se programan para limpieza después de una hora; falta implementar y probar el trabajador que los elimina, así como la recolección de cargas incompletas antes de activar el servicio.

Limpieza diferida: serializar preparación y limpieza con bloqueo consultivo por usuario. Procesar un elemento vencido bajo transacción y bloqueo de fila, comprobar que el respaldo ya no existe y eliminar solo nombres dentro del prefijo derivado, en lotes limitados; conservar la cola si falla o si se alcanza el límite y retirarla solo tras una lectura vacía. Probar interrupción, prefijos ajenos, respaldo recreado y reintento, sin ejecutar eliminaciones reales. Falta después un disparador de mantenimiento autenticado y la limpieza separada de cargas pendientes abandonadas.

Avance: el procesador y el adaptador Blob están probados con almacenamiento simulado, y la firma mantiene bloqueos hasta entregar cada URL para evitar que una limpieza concurrente afecte a un respaldo nuevo. La limpieza real y la recolección de cargas pendientes aún no están habilitadas.

Disparador de limpieza: ofrecer una ruta de mantenimiento `GET` desactivada por defecto, protegida por `CRON_SECRET` de servidor de al menos 32 bytes y comparación de tiempo constante; procesar un elemento por solicitud y ocultar errores internos. Probar métodos, secreto incorrecto, fallo de proveedor y configuración ausente. No programar el cron ni activar la ruta hasta probar Blob real y la limpieza de cargas abandonadas.

Pendientes abandonados: bajo bloqueo consultivo y de perfil, retirar solo una versión que siga pendiente y tenga al menos siete días; insertar su identificador en la cola de objetos en la misma transacción y no tocar versiones confirmadas. Probar fechas, aislamiento y rollback si falla la cola. El cliente conservará la instantánea hasta confirmación y tendrá que preparar otro ID si la versión expiró.

Avance: el disparador y su adaptador están implementados y desactivados; el bloqueo consultivo se comprobó también en una transacción revertida de Neon real. La CLI creó el proyecto `arsen-development` y el Blob privado de desarrollo, sin desplegar. Una revisión automática rechazó descargar todas las variables de Vercel por incluir potencialmente otros secretos; se solicitó al propietario proporcionar únicamente el token de Blob en `.env.local`. Falta la prueba real de Blob, programar el cron y recoger cargas pendientes abandonadas.

Serialización de enlaces: firmar cargas y descargas dentro de una transacción que mantenga los bloqueos consultivo y de perfil hasta obtener la URL, y limitar la duración de la llamada al proveedor. Probar que el firmador se ejecuta dentro de la transacción, que una falla revierte y que una versión eliminada no puede volver a utilizar su identificador mientras la limpieza sigue pendiente.

Avance: firmador y autorización de descarga probados con SDK simulado y PostgreSQL embebido. La autorización obtenida dura hasta dos minutos; revocar consentimiento o acceso no invalida una URL ya emitida, por lo que debe mantenerse ese plazo corto y confirmarse el comportamiento real del proveedor. No hay ruta ni prueba de Blob real.

Integración local: probar una instantánea real de Dexie con imagen personal a través de preparación, autorización de manifiesto, reserva, autorización de imagen, verificación de bytes, confirmación, listado y autorización de descarga, con PostgreSQL embebido y almacenamiento simulado. Restaurar la copia obtenida y comprobar los datos; un usuario distinto no debe poder descargarla. La prueba no reemplaza la verificación en servicios externos ni en Android.

Avance: la prueba integrada `server/backups/backupFlow.test.ts` recorre ese flujo con una imagen personal y restaura la rutina y la imagen, además de rechazar la descarga de otra cuenta. Las URL y los objetos son simulados; no se ha verificado la inmutabilidad ni la carga real en Vercel Blob.

Transporte de respaldo: crear un manejador privado que componga las operaciones existentes, limite cuerpos JSON antes de parsear, aplique CORS por lista explícita y `Cache-Control: no-store`, y mantenga errores internos sin datos sensibles. Incluir preparación, listado, firma de manifiesto, reserva, firma de imagen, confirmación y firma de descarga; probar rutas, permisos y cuerpos excesivos con dependencias simuladas. El adaptador Vercel debe seguir apagado hasta configurar y probar Blob, límites distribuidos y las credenciales reales; no equivale a una restauración Android funcional.

El manejador HTTP y el adaptador Vercel ya comparten la configuración y autorización de Clerk/Neon con la ruta de cuenta, cierran el pool transaccional al terminar la solicitud y requieren un límite de tamaño configurado en servidor. Sin habilitación o con configuración ausente responden 503. No habilitar mientras falten la política de retención, reglas distribuidas y una prueba completa en el bucket privado; el enrutamiento de Vercel tampoco ha sido verificado en despliegue.

- [ ] Probar `GET /api/v1/backups`, `GET /api/v1/backups/latest`, `POST /api/v1/backups`, `GET /api/v1/backups/:id` y `GET /api/v1/sync/status` con dos cuentas y sin sesión.

Estado remoto: implementar `server/backups/syncStatus.ts` y ruta `api/v1/sync/status.ts`, reutilizando la puerta y CORS de respaldos. Una consulta acotada devuelve última copia, cargas remotas pendientes y consentimiento, sin interpretar los cambios locales. Probar dos cuentas, invitado, error de método, ausencia de perfil y que no se exponga contenido; mantener la puerta desactivada hasta desplegar y verificar el servicio.
- [ ] Implementar preparación, verificación y confirmación idempotentes; asignar propietario desde la sesión y comprobar la versión base contra la última confirmada antes de aceptar una nueva.
- [ ] Probar dos solicitudes idénticas, confirmaciones concurrentes, hash incorrecto, objeto ausente, fallo transaccional y versión divergente. No duplicar ni borrar la última versión válida.
- [ ] Conservar hasta cinco versiones confirmadas, seleccionando versiones excedentes solamente después de confirmar la nueva; probar un fallo de limpieza y su reintento.

## Tarea 5: instantáneas personales y consentimiento

**Archivos:** `src/db/contractBackup.ts`, `src/db/revisionTracking.ts`, `src/domains/settings/`, sus pruebas y contrato compartido.

Avance parcial: `createRemoteContractBackup` captura datos y revisión en una transacción, excluye salud por defecto, preferencias específicas del dispositivo y caché del catálogo global, y mantiene recursos personales. La exportación local conserva su comportamiento anterior. Todavía faltan transporte, confirmación remota y estado de revisiones enviadas.

- [x] Probar que la instantánea sin consentimiento excluye salud y catálogo global reconstruible, pero conserva recetas, copias personales, historial y recursos referenciados.
- [x] Añadir una preparación remota explícita al serializador existente; capturar revisión y datos en la misma transacción, sin cambiar el formato de exportación existente.
- [ ] Probar modificación concurrente, hash determinista, recurso ausente y cambios posteriores a la preparación. Registrar revisión preparada y confirmada por separado.
- [ ] Ejecutar pruebas de integridad y respaldo; comprobar que las mutaciones del contrato incrementan la revisión sin incluir escrituras de caché global.

## Tarea 6: vinculación y restauración

**Archivos:** `src/domains/account/`, `src/domains/settings/services.ts`, `src/db/contractBackup.ts`, componentes de Ajustes y pruebas.

- [ ] Probar modo invitado, vinculación con datos locales existentes y primer respaldo solo tras autorización explícita.
- [ ] Implementar listado y vista previa de fecha, tamaño, versión y resumen. Detectar divergencia y pedir una decisión explícita antes de reemplazar información local.
- [ ] Probar hash, versión y recursos incorrectos y fallo de escritura: ningún caso modifica datos locales. Restaurar una copia válida en una sola transacción.
- [ ] Probar restauración en una base nueva y conservar credenciales y preferencias específicas del dispositivo fuera del respaldo portable.

## Tarea 7: puente nativo y WorkManager

**Archivos:** `android/app/build.gradle`, `android/app/src/main/kotlin/com/kumchovy/arsen/codex/backup/`, registro del plugin en `MainActivity.java`, `src/domains/account/` y pruebas Kotlin/TypeScript.

Almacenamiento nativo: implementar un almacén Kotlin que recibe una clave AES y un directorio privado, cifra propietario/revisión/contenido con AES-GCM y reemplaza atómicamente el archivo tras sincronizarlo. Rechazar tamaños fuera del límite, revisiones inválidas y contenido alterado. Reconocer confirmaciones solo si propietario, revisión y huella siguen coincidiendo; probar archivo cifrado, modificación posterior, error de integridad y persistencia en pruebas JVM. Integrar después Android Keystore en `noBackupFilesDir`, puente, sesión y WorkManager; no exponer todavía un flujo de cuenta incompleto.

Coordinación nativa: incorporar una operación de envío que lea una instantánea existente, exija una sesión de su misma cuenta, solicite al transporte una confirmación explícita del servidor y solo entonces reconozca exactamente esa revisión y huella. Sin sesión, con otra cuenta, ante fallo de red, respuesta no confirmada o error de lectura se conserva la copia. Si llega una revisión más reciente durante el envío, la confirmación anterior no la elimina. La operación no programa trabajos ni afirma que Clerk o WorkManager estén conectados; estas integraciones se hacen después con pruebas propias.

Motor de trabajo: crear `BackupWorkerEngine.kt` usando el almacén existente, `NativeSessionProvider` y un transporte inyectado. Sin pendiente no consulta Clerk; ante sesión ausente, identidad distinta o fallo de almacenamiento devuelve un estado explícito y no elimina datos. El transporte obtiene tokens renovados mediante una función que vuelve a comprobar el propietario en cada solicitud. Errores transitorios se reintentan, cancelaciones se propagan, y una revisión creada durante el envío queda pendiente. Probar estos comportamientos antes de conectar `CoroutineWorker` o red real.

Decodificación nativa: `PendingEnvelope.kt` interpreta el mismo sobre JSON emitido por `src/domains/account/pendingBackup.ts`. Rechaza claves desconocidas, UUID/revisión/tamaños inválidos, UTF-8 o base64 malformados, componentes duplicados, huellas distintas, metadatos de salud incompatibles y preferencias del dispositivo. El tamaño del sobre y cada componente están acotados antes de cargar; la revisión debe coincidir con la instantánea cifrada. Probar la misma estructura de datos en Kotlin y TypeScript antes de enviar cualquier solicitud.

El parser usa `kotlinx-serialization-json:1.13.0`, ya presente por el SDK de Clerk, declarado explícitamente porque el transporte depende de él. Su validación no reemplaza la validación integral del servidor antes de confirmar.

Transporte nativo: implementar el protocolo de preparación, firma, carga directa de manifiesto, reserva, firma/carga de imágenes y confirmación usando un cliente HTTP inyectable. Obtener token nuevo para cada llamada a la API; no enviarlo a Blob ni guardar URLs firmadas. Validar que cada URL de carga pertenezca a `https://vercel.com/api/blob` y al objeto derivado del propietario/versión/componente. En una carga HTTP 400 potencialmente repetida, continuar únicamente hasta la validación de reserva/confirmación; ninguna falla de Blob, reserva o confirmación por sí sola borra la copia. Distinguir sesión, permiso, conflicto, datos inválidos y reintentos. Probar con transporte simulado los pasos, fallos, reintentos, cambio de cuenta y confirmación idempotente; agregar el adaptador HTTPS real por separado y verificarlo antes de programar el trabajo.

Dependencias Android previstas: `com.clerk:clerk-android-api:1.5.0` y `androidx.work:work-runtime-ktx:2.12.0`, versiones estables documentadas por sus proveedores el 23-11-2026. Verificar resolución y compatibilidad de Gradle antes de integrarlas; la ausencia de clave pública no debe interrumpir el modo invitado.

Compatibilidad: Clerk 1.5.0 usa metadatos Kotlin 2.4, incompatibles con el compilador 2.2.21 existente. Evaluar el compilador Kotlin 2.4.21 con el AGP actual mediante compilación, empaquetado y pruebas de Health Connect y respaldos; conservar el cambio solo si todas esas verificaciones pasan. No omitir comprobaciones de metadatos.

La compilación debug y las pruebas unitarias Android pasaron con Kotlin 2.4.21, Clerk 1.5.0 y WorkManager 2.12.0; queda pendiente ejecutar la APK en un dispositivo. Inicializar Clerk una vez en `Application` solo cuando exista una clave pública validada (`pk_test_` o `pk_live_`); sin ella conservar el modo invitado. Gradle leerá únicamente `CLERK_PUBLISHABLE_KEY` de `.env.local` o del entorno y rechazará valores inválidos antes de incorporarlos a la APK. Probar la decisión de inicio y verificar compilación sin clave. La inicialización aún no equivale a una sesión nativa ni al trabajador operativo.

Avance: `ArsenApplication` inicializa Clerk de manera condicional y el build sin clave conserva el modo invitado; se probó que una clave secreta ficticia se rechaza en Gradle. `PendingBackupSubmission` verifica propietario y conserva copias ante errores o revisiones nuevas; sus pruebas y las demás pruebas unitarias Android pasan. Aún no hay puente de inicio de sesión, transporte nativo ni programación WorkManager; los artefactos debug generados no completan esas funciones. Native API y la clave pública de desarrollo siguen pendientes de confirmación/configuración del propietario.

Sesión para el trabajo nativo: esperar un tiempo acotado a que Clerk termine de inicializar, leer identidad y sesión, obtener un token renovado y volver a comprobar que identidad y sesión no cambiaron durante la operación. No registrar ni exponer el token al WebView; conservar la instantánea si falla, no hay cuenta o cambia de sesión. Probar esta lógica con una fuente ficticia y compilar el adaptador real del SDK. La rehidratación y renovación tras finalizar el proceso requieren validación en dispositivo.

Acceso Android: crear el puente `ArsenAccount` en `android/app/src/main/kotlin/com/kumchovy/arsen/codex/account/` y registrarlo en `MainActivity.java`. La operación de contraseña aplica límites, llama al SDK nativo, devuelve exclusivamente estado e identidad y no registra ni devuelve tokens; ante verificación adicional usa el portal oficial solo mediante acción explícita. Crear `src/domains/account/native.ts`, servicios y pantalla `AccountPage.tsx`, con ruta perezosa y entrada desde Ajustes; probar modo navegador, estados de error, carga, validación, acceso, verificación adicional y navegación de invitado. La sesión real y el portal adicional requieren prueba en dispositivo. No vincular ni activar automáticamente los respaldos.

Formato de envío nativo: codificar en UTF-8 un sobre JSON versionado con ID de respaldo estable, dispositivo, base confirmada, revisión, manifiesto y binarios personales en base64. Derivar el tamaño de objetos y validar huella del manifiesto, revisión, duplicados y límite explícito antes de persistir; el límite del sobre incluye la expansión de base64. No incluir tokens ni credenciales. Probar codificación estable, corrupción, duplicados y límites. El trabajador deberá validar nuevamente el sobre y solo reconocer la instantánea tras confirmación del servidor.

Avance: la página de cuenta y el puente para Clerk están implementados; las pruebas React pasan, mientras el último cambio Kotlin de protección ante sesión activa sigue pendiente de verificación. El sobre de respaldo valida huellas, binarios, límites, consentimiento y exclusión de configuraciones del dispositivo; se probó con una instantánea real en IndexedDB simulado y el flujo de respaldo con almacenamiento simulado. El transporte, el puente de instantánea, WorkManager y las pruebas con dispositivo aún no están implementados.

Avance: la clave pública de desarrollo está configurada localmente. `ClerkSessionSource` espera a Clerk y solicita un token sin usar caché, con límites de tiempo; `NativeSessionProvider` comprueba que el usuario y la sesión no cambien, rechaza tokens malformados y no incluye tokens en mensajes de diagnóstico. Las pruebas simuladas y la compilación Android con la clave pública pasan. Todavía falta iniciar sesión desde la aplicación y comprobar el SDK en un dispositivo, y tampoco se ha implementado el envío ni la programación con WorkManager.

- [ ] Probar consolidación de varias modificaciones, persistencia de instantánea y revisión pendiente aunque el WebView se cierre antes de preparar el último cambio.
- [ ] Implementar transferencia al almacenamiento persistente protegido, reemplazo atómico de instantáneas, comprobación de sesión y envío sin acceso directo a Dexie.
- [ ] Programar trabajo único con conectividad y objetivo de 72 horas, retroceso exponencial, reintentos y respaldo manual; no prometer una hora exacta ni ejecución tras detención forzada.
- [ ] Probar que un error temporal no elimina pendientes, confirmación de revisión antigua conserva cambios posteriores y reintentos no duplican versiones.
- [ ] Ejecutar pruebas Kotlin y generar APK; realizar pruebas instrumentadas y en dos dispositivos cuando estén disponibles.

## Tarea 8: catálogo global y publicación

**Archivos:** `server/catalog/`, `server/migrations/`, `src/shared/validation/remoteCatalog.ts`, datos y pruebas de `src/domains/routine/data/`.

- [ ] Verificar los 74 IDs, contenido e imágenes incluidos y crear una migración inicial idempotente que conserve los IDs actuales.
- [ ] Probar creación de borrador, publicación, modificación, archivo y restauración: solo publicaciones visibles en API pública; usuarios e invitados no pueden escribir.
- [ ] Implementar versión global monotónica, historial y publicación transaccional con comprobación de recursos y auditoría. Proveer `GET /api/v1/catalog`, `/version` y `/changes` con caché y límites de solicitudes.
- [ ] Probar que un fallo antes de confirmar no incrementa versión ni publica contenido parcial; probar ETag y consulta sin cambios.

## Tarea 9: catálogo local y sincronización

**Archivos:** `src/db/schema.ts`, `src/domains/routine/repository.ts`, `src/domains/routine/services.ts`, `src/domains/routine/data/` y pruebas Dexie.

- [ ] Probar instalación nueva con catálogo incluido, aplicación de una versión nueva y repetición sin duplicados; una descarga inválida conserva la versión anterior.
- [ ] Añadir tablas locales y migración Dexie para catálogo y versión independientes de la revisión personal. Validar el conjunto antes de aplicarlo en una sola transacción.
- [ ] Probar modificación y archivo de ejercicios sin alterar rutinas existentes, parámetros personales ni snapshots históricos. Mantener accesibles las referencias archivadas.
- [ ] Descargar o almacenar imágenes verificadas con alternativa local; probar interrupción, imagen ausente y uso offline.
- [x] Asociar a las copias personales una referencia versionada de imagen global en `assetKind`, sin incluir el binario global en el respaldo. Propagarla a rutinas e historial; probar copia, snapshot, caché offline, valores desconocidos y alternativa si falta la imagen.

## Tarea 10: integración automática del catálogo

**Archivos:** `src/app/`, `src/domains/routine/hooks.ts`, `src/domains/routine/components/SinfulShellBrowserSheet.tsx`, `src/domains/routine/pages/RoutinePage.tsx` y pruebas de interfaz.

- [ ] Probar comprobación silenciosa al abrir, volver a primer plano, recuperar conectividad y entrar al catálogo cuando la última comprobación esté obsoleta; limitar solicitudes repetidas.
- [ ] Conectar búsqueda, detalle y selección a la copia local versionada para cuentas e invitados, sin bloquear Entreno o Rutina.
- [ ] Probar dos usuarios y un invitado que reciben el mismo ejercicio; un usuario offline conserva su catálogo y lo actualiza al reconectarse. Verificar que no se requiere actualizar la APK.

## Tarea 11: panel administrativo

Primera operación: `server/migrations/007_catalog_draft_audit.sql`, `server/catalog/adminDrafts.ts` y pruebas PGlite. Exigir rol admin y método correcto, esquema estricto y longitud acotada; listar páginas de hasta 100 por ID y crear/editar con comparación contra el borrador anterior. Registrar actor y objetivo de forma atómica; conservar publicación y versión sin cambios y no filtrar borradores a invitados. Probar cuentas no autorizadas, entrada inválida, conflicto concurrente y fallo de auditoría. No habilitar rutas ni ejecutar esta migración sobre Neon hasta integrar el adaptador y comprobar su despliegue.

Transporte: conectar las operaciones a `/api/v1/admin/catalog/drafts` con CORS por lista, JSON limitado a 64 KiB, respuestas privadas sin caché y errores sanitizados. El adaptador de Vercel exige `ADMIN_CATALOG_API_ENABLED=true` y configuración de Clerk/Neon; permanece deshabilitado hasta aplicar y validar la migración, límites distribuidos y pruebas reales. Probar rutas, orígenes, límites, fallos internos y respuesta 503 sin configuración.

Archivo del catálogo: implementar `server/catalog/archive.ts` y pruebas con PGlite para rol, método, elementos ausentes, repetición, versión, auditoría y rollback. Una restauración reutilizará publicación validada. No exponer la operación hasta integrar correctamente el verificador de imágenes y el panel.

Para poder integrarla después en el panel, añadir el transporte `/api/v1/admin/catalog/archive` a la misma puerta desactivada de administración, con JSON acotado, autorización del servidor y respuestas sin caché. La puerta no se activará hasta validar el entorno completo; la restauración sigue pendiente de un verificador de imágenes seguro.

Imágenes de publicación: crear `server/catalog/verifyImage.ts` con pruebas para origen público Blob exacto, límites y hash del contenido, tipo MIME, redirecciones y fallos de red. El origen se configura en servidor, nunca se acepta desde una solicitud. Mantener la publicación sin ruta habilitada hasta configurar un almacén público separado y verificarla.

Preparar `/api/v1/admin/catalog/publish` detrás de la misma puerta administrativa deshabilitada y exigir un origen de imágenes válido del servidor. La operación reutiliza la publicación transaccional y el verificador anterior; no habrá solicitudes de imagen para usuarios no autorizados. Falta crear el almacén público, probarlo en vivo y establecer los límites distribuidos antes de activar la ruta.

Carga de imagen: implementar autorizador de carga con sesión y rol, MIME/longitud limitados y ruta aleatoria del servidor; firmar operación `put` pública sin sobrescritura con token independiente. Probar ausencia de sesión, rol, ruta y alcance, y rechazo de entradas inválidas. Conectar al panel solo cuando exista un almacén público; mantener la puerta cerrada hasta prueba real y límites distribuidos.

Limitación: una carga de imagen que se abandone antes de guardar el borrador puede dejar un objeto público sin referencia. No hay limpieza automática de imágenes huérfanas; antes de activarla deberá comprobarse que ninguna versión publicada ni borrador la referencia y protegerse contra cargas en curso.

Datos del panel: implementar consulta paginada `server/auth/adminAccounts.ts` para rol, fecha, cantidad de dispositivos y de respaldos confirmados y fecha del último, sin contenido ni correos. Probar autenticación, rol, paginación, que los pendientes no cuenten, y que ningún dato privado de la instantánea aparezca. Mantener sin desplegar hasta integrar transporte y revisar los límites de acceso.

Conectar la consulta a `GET /api/v1/admin/accounts`, reutilizando la validación de origen, sesión, rol y la puerta existente `ADMIN_API_ENABLED`; probar 401/403 y errores sanitizados antes de cualquier despliegue.

Añadir `GET /api/v1/admin/accounts/:userId/backups` para metadatos de hasta cinco versiones confirmadas sin contenido, hashes ni enlaces. Probar administrador, usuario, invitado, filtros por propietario, pendientes y cuenta inexistente; reutilizar los controles de origen y despliegue del administrador.

Añadir `GET /api/v1/admin/overview` con recuentos de cuentas, dispositivos, copias confirmadas y ejercicios publicados; no incluir contenido personal ni contar borradores o cargas incompletas como publicadas/confirmadas. Verificar permisos y que la respuesta no exponga información de entrenamiento.

Cliente administrativo: `src/admin/api.ts` centraliza llamadas privadas, exige origen HTTPS explícito, obtiene tokens bajo demanda, impide redirecciones y credenciales inválidas y valida respuestas. Probar respuestas inválidas, errores, sesión ausente, origen no seguro y que el token solo vaya en cabeceras. La interfaz y la carga oficial de Clerk se implementan y prueban después; el cliente aislado no equivale al panel operativo.

Autenticación del panel: cargar los bundles web oficiales de Clerk desde el dominio deducido de la clave pública, validar clave y dominio antes de cargar, usar el SDK para iniciar/cerrar sesión y obtener cada token en memoria. Las pruebas usan un cargador ficticio, verifican origen y orden de scripts y rechazan claves inválidas; no se finge una sesión real. La clave pública es la única configuración de Clerk que puede incluirse en el bundle.

Aplicación web independiente: `admin/index.html`, `admin/main.tsx`, `admin/vite.config.ts` y `src/admin/` compilan por separado a `dist-admin`. El panel adapta navegación a móvil/escritorio y usa datos reales de las rutas protegidas: resumen, cuentas, metadatos de respaldos, borradores, publicación/archivo e invitaciones. Las respuestas de una sesión anterior se descartan al cambiar de cuenta. La carga de imágenes y verificación remota de copias se identifican como pendientes; no se simulan ni habilitan. Probar inicio/cierre, denegación, sesiones cambiantes, datos vacíos, creación de borrador e invitación; validar build y exclusión de secretos. No desplegar hasta configurar dominios, migraciones, almacenamiento y protecciones pendientes.

Avance: listado y guardado de borradores, puerta de despliegue desactivada, migración 007 y archivo transaccional probados con PGlite y rutas simuladas. La migración 007 no se ha aplicado a Neon; la API de borradores sigue desactivada. No hay panel administrativo ni ruta de archivo/publicación desplegada.

Actualización: existe una aplicación administrativa independiente en `admin/` y `src/admin/`, con acceso Clerk, resumen, cuentas, metadatos de respaldos, borradores, publicación/archivo, invitaciones e integración de carga de imágenes. Las funciones se probaron con dependencias y PostgreSQL simulados, incluyendo cambios de sesión, invitaciones repetidas e imágenes verificadas. La aplicación y las rutas no se han desplegado; la carga de imágenes aún requiere almacén público y prueba real. El estado de «no hay panel» en el párrafo anterior corresponde al momento previo a esta actualización.

**Archivos:** `admin/`, `server/admin/`, `server/catalog/`, pruebas y configuración Vercel.

- [ ] Aplicar `impeccable shape` antes de construir las pantallas; usar jerarquía responsive accesible y mensajes en español.
- [ ] Probar dashboard, búsqueda y filtros, edición, carga de imagen, guardar borrador, publicación, archivo y restauración. La confirmación comunica disponibilidad remota, no recepción en todos los dispositivos.
- [ ] Implementar usuarios, metadatos e integridad de respaldos, diagnóstico y auditoría; confirmar eliminaciones y proteger el único respaldo válido.
- [ ] Aplicar `impeccable critique`, `polish`, `audit` y `harden`; probar las mismas acciones en viewport móvil y escritorio y verificar controles de autorización del servidor.

## Tarea 12: cierre, documentación y APK

**Archivos:** documentación de despliegue, configuración, Ajustes, importaciones/exportaciones y pruebas existentes.

- [ ] Documentar variables requeridas sin secretos, creación segura de administrador, invitaciones, almacenamiento, límites, retención, recuperación y despliegue.
- [ ] Ejecutar la matriz completa de las secciones 22 y 24 y del anexo de 72 horas. Verificar consumo y límites previstos sin afirmar una cuota universal para cualquier uso.
- [ ] Retirar importación/exportación JSON y CSV solo después de verificar restauración remota completa; mantener serialización interna necesaria.
- [ ] Revisar el diff completo inline. Ejecutar `pnpm test`, `pnpm build` y pruebas Android; si `pnpm` permanece bloqueado, documentar comandos equivalentes y límites. Generar la APK cuando sus dependencias estén configuradas.
- [ ] Verificar en dispositivo real conectividad, batería, reinicio, detención forzada, ejecución sin abrir la aplicación y restauración en otro teléfono cuando el propietario disponga de la nueva APK. Informar explícitamente cualquier prueba pendiente.

## Estado

**Diagnóstico de restauración Android:** la copia más reciente estaba confirmada y `/backups/download` devolvía 200, pero el cliente rechazaba el enlace porque esperaba el host de cargas `vercel.com/api/blob`. Las descargas privadas reales usan el dominio HTTPS del almacén privado y la ruta directa del objeto. Android recibe el origen no secreto configurado en `ARSEN_PRIVATE_BLOB_ORIGIN`, exige coincidencia exacta de host y ruta derivada, verifica parámetros de firma sin duplicados y mantiene las comprobaciones de tamaño y SHA-256. Las pruebas de Android pasan y una prueba JVM descargó el manifiesto real y verificó su huella sin mostrar contenido. La restauración completa en teléfono sigue pendiente de prueba del propietario.

**Corrección del almacén de respaldo (24-11-2026):** la copia de prueba quedó pendiente porque Vercel proporcionaba OIDC junto con `BLOB_STORE_ID` del catálogo público. La versión del SDK resolvía esas credenciales antes que `BLOB_READ_WRITE_TOKEN` cuando el token privado no se pasaba explícitamente: se comprobó que la firma remota apuntaba al almacén público y que el manifiesto privado no existía. Las operaciones de firma, lectura y limpieza de respaldos ahora pasan explícitamente el token privado y rechazan su ausencia o coincidencia con el token del catálogo. Las pruebas simuladas y una prueba real con OIDC y un ID de almacén público configurados verificaron carga, lectura y limpieza en el almacén privado. La versión desplegada firma para el almacén privado; falta que el teléfono reintente la copia existente y el servidor la confirme.

**Diagnóstico de preparación Android:** el teléfono pudo registrar el dispositivo y consultar la última copia (404 esperado al no existir ninguna), pero no inició una carga. El puente usaba `PluginCall.getLong`, que solo acepta valores representados como `Long`, mientras que el JSON de Android representa revisiones pequeñas como `Integer`. Leer el valor numérico crudo y validar que sea entero, no negativo y seguro para JavaScript; probar `Int`, `Long`, límites y números inválidos, y comprobar la interpretación de JSON de Capacitor con una prueba instrumentada en un teléfono. Las pruebas JVM pasan; la verificación en dispositivo queda pendiente de conexión.

**Avance Android y vista previa (24-11-2026):** la aplicación prepara copias manuales con la cuenta nativa y conserva las pendientes cifradas; WorkManager envía una instantánea preparada, reintenta fallos temporales y respeta la revisión. La restauración descarga manifiesto y componentes verificando tamaño y SHA-256, muestra una confirmación y usa el reemplazo transaccional protegido por la revisión local. La preparación automática de cambios nuevos y la programación periódica desde la interfaz siguen pendientes; WorkManager no puede crear una instantánea desde IndexedDB con el WebView cerrado. No se han verificado aún Clerk, los respaldos ni la restauración de extremo a extremo en un dispositivo.

Se creó una vista previa de Vercel y se asignó `https://arsen-development-preview.vercel.app`. El usuario autorizó retirar Vercel Authentication del proyecto de desarrollo para que Android alcance la API; Clerk sigue siendo obligatorio para las rutas privadas. El Blob público real superó una prueba aislada de carga firmada, integridad y limpieza. Tras la autorización explícita del usuario se publicaron la regla de 120 solicitudes por IP cada 600 segundos y las variables de Neon, Clerk, Blob y orígenes como secretos en Preview. Después de una autorización adicional se activaron en Preview las API de cuenta, respaldos y administración, el límite de 12 MiB y la aceptación de sesiones nativas sin `azp` sujetas a verificación de firma y sesión activa. Una comprobación de la cuenta real de desarrollo obtuvo HTTP 200 en cuenta, listado de respaldos y resumen administrativo; las mismas rutas rechazaron solicitudes sin sesión con 401. El catálogo administrativo sigue desactivado. La ejecución completa de respaldo y restauración en Android sigue pendiente de prueba por el propietario.

**Restauración conectada:** el autorizador de descarga devuelve, solo a la cuenta propietaria y para versiones confirmadas, la huella SHA-256 y el tamaño exacto del manifiesto o componente junto a su URL temporal. El cliente debe verificar ambos antes de procesar los bytes; el reemplazo local sigue requiriendo confirmación explícita y revisión local sin cambios. Probar aislamiento, metadatos faltantes, bytes alterados y errores antes de conectar la interfaz.

**Despliegue Hobby:** Vercel rechazó la distribución de rutas en más de doce funciones. Agrupar las rutas en `api/gateway.ts`, que delega a los mismos controladores y conserva sus puertas de configuración y autorización. La compilación inicial reconoció la función dinámica pero devolvió 404 en la ruta, por lo que el despliegue usa una entrada estática y una reescritura explícita. Excluir únicamente las entradas duplicadas durante el despliegue; probar que las rutas y los 404 mantienen sus controles.

**Blob de desarrollo:** el 23-11-2026 se verificaron contra el almacén privado real la firma y carga de un objeto aislado, rechazo de tipo y tamaño no autorizados, protección frente a sobrescritura y lectura sin firma, lectura mediante el adaptador, descarga firmada y eliminación mediante el adaptador de limpieza. La prueba optativa `RUN_BLOB_LIVE_CHECK=1` crea un identificador aleatorio y elimina únicamente el objeto de esa ejecución. Esto no verifica todavía el respaldo completo con Neon, la aplicación Android ni la limpieza programada en producción.

**Consultas de respaldos:** reutilizar la lista autenticada de hasta cinco versiones confirmadas para exponer `GET /api/v1/backups/latest` y `GET /api/v1/backups/:id`. Ambos devuelven `backup` o 404, sin revelar copias de otros usuarios, y conservan los controles de origen y `no-store` del transporte. Probar ausencia de sesión, lista vacía, aislamiento por cuenta y métodos incorrectos. El estado de sincronización requiere un contrato separado y no se deduce de una lista de respaldos.

Las dos consultas anteriores están implementadas y probadas con el transporte y PostgreSQL embebido; no están habilitadas ni verificadas en un despliegue real.

**Entorno aislado para integración:** permitir que el constructor de `ArsenDatabase` reciba opcionalmente un nombre y proveedores IndexedDB explícitos. La instancia normal mantiene su nombre y comportamiento; la prueba optativa usará un nombre aleatorio y un `IDBFactory` nuevo en memoria, sin abrir ni borrar la instancia personal. Probar el aislamiento antes de conectar la prueba al almacén privado y conservar esta distinción en sus resultados.

Resultado: `server/backups/backupBlobLive.test.ts` preparó, subió, confirmó y restauró una copia de prueba con imagen usando IndexedDB aislado en memoria, PostgreSQL embebido y Blob real; eliminó sus objetos temporales. Se detectó que Vercel puede comprimir respuestas sin `Content-Length`, y el SDK informa longitud cero: el adaptador ahora limita los bytes decodificados y la verificación posterior comprueba tamaño total y hashes. Las pruebas cubren longitud desconocida, exceso y diferencias por compresión. Esto aún no prueba Neon, sesión Android ni dispositivos en ese mismo flujo.

**Neon de desarrollo:** el propietario configuró una base inicialmente sin tablas de ARSEN. El 23-11-2026 se verificaron las migraciones 001–004 en una transacción revertida y después se aplicaron juntas en otra transacción; las migraciones 005 de auditoría y 006 de retención se probaron y aplicaron después. Con autorización explícita del propietario, se creó como administrador inicial la única cuenta verificada de Clerk Development. Una prueba optativa autenticó una sesión real y resolvió ese perfil mediante la ruta de cuenta. Las referencias históricas siguientes a «migraciones no aplicadas» o «administrador pendiente» ya no reflejan este estado.

**Actualización:** Clerk ya está seleccionado y el propietario confirmó el modo exclusivo por invitación. La migración inicial y el canje local ya no dependen del esquema `neon_auth`; el verificador de Clerk y el lector de sesiones existen, pero aún no están conectados ni verificados contra los servicios reales. Las referencias a la dependencia de `neon_auth` en el párrafo histórico siguiente describen el estado anterior.

La tarea 1 tiene validación de metadatos y pruebas. La tarea 2 tiene verificadores locales de firma, emisor, audiencia, vencimiento e identidad, una consulta parametrizada de roles y creación y canje de invitaciones probados con PostgreSQL embebido; todavía no están conectados al proveedor ni a ninguna ruta. La migración inicial define perfiles, roles, invitaciones y dispositivos y no se ha aplicado a Neon. Managed Better Auth permite registros públicos por defecto: el propietario pidió evaluar Clerk, que documenta invitaciones restringidas y SDK Android, pero su funcionamiento desde WorkManager y el contrato de tokens aún no se han verificado. La migración actual depende de `neon_auth.user` y no es compatible con Clerk sin rediseño. Verificar solo un JWT no confirma que su sesión siga activa: la revocación debe comprobarse antes de usar esta base para autorizar operaciones. Las tareas 3 y 4 incluyen la migración de metadatos, preparación y confirmación transaccional, y validación de manifiestos y componentes a través de un lector inyectado; faltan el adaptador real de objetos inmutables, rutas, sesión y retención remota. Las tareas 5 y 6 incluyen preparación y restauración transaccional del contrato local remoto, pero no un flujo conectado ni una interfaz de resolución de conflictos. La tarea 8 dispone de validación, migración de catálogo, publicación transaccional, lectura pública con ETag y rutas Vercel deshabilitadas por defecto. La tarea 9 tiene copia local transaccional e imágenes verificadas en Cache Storage; las copias personales, rutinas e historial conservan referencias de imágenes globales sin incluir sus bytes en respaldos. La tarea 10 comprueba al iniciar, volver a primer plano, recuperar conectividad y entrar al catálogo si se configura un origen HTTPS; el selector lee la copia descargada y permite crear una copia personal sin alterar recetas existentes. No existen rutas desplegadas o imágenes iniciales cargadas, y falta verificar almacenamiento real, WAF, cuotas, recuperación de imágenes archivadas en un dispositivo nuevo y comportamiento en Android. No hay respaldo remoto operativo, WorkManager ni panel administrativo.
