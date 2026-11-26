# SPEC 02 — registro inicial de evidencia y operación

Fecha: 2026-11-25. Estado: **pendiente de cierre**. Este registro no acredita el estado de servicios desplegados ni reemplaza las pruebas reales exigidas por la especificación.

## Resultados locales

- `pnpm test --run`: 157 archivos y 920 pruebas aprobadas; siete pruebas de servicios reales omitidas. Incluye dobles, PGlite y componentes simulados, no demuestra funcionamiento en servicios reales.
- `pnpm build`: aprobado con acceso a la caché local; incluye TypeScript, Vite y generación del service worker. Vite advirtió un fragmento mayor de 500 kB. Panel y paquete del servidor compilados mediante Vite, exit 0.
- Tras sincronizar Capacitor, `gradlew.bat testDebugUnitTest --rerun assembleDebug -ParsenPackageSuffix=rc20261125 -ParsenVersionCode=20261125 --offline --no-daemon`: aprobado. Los XML de resultados registran 80 pruebas, cero fallos y una omitida: descarga real privada. Son pruebas JVM, no instrumentadas ni de dispositivo.
- APK debug: `android/app/build/outputs/apk/debug/Arsen-rc20261125-debug.apk`; versión `1.0.0-rc20261125`, código `20261125`, paquete `com.kumchovy.arsen.codex`; SHA-256 `3473c083ec9ceb6f28cf4e4766c949536443dc5a3432fa81d5af4c1eec13653d`. No se instaló ni publicó. Comparar las credenciales privadas disponibles localmente contra entradas descomprimidas de la APK no encontró coincidencias en cuatro categorías; esto no cubre secretos ausentes, transformados o desconocidos. Comparte identificador de aplicación con la instalación existente: no instalar sin evaluar firma, datos y autorización.

## Matriz inicial

La referencia funcional es la SPEC 02 original, secciones 22 y 24, y su anexo de 72 horas, citados por el diseño. No se localizaron aquí como documento independiente: la trazabilidad detallada a sus casos queda pendiente. Los casos propuestos deben usar datos aislados y sin información personal. Fecha de observación: 2026-11-25; sin ejecución real, evidencia y resultado observado son «sin ejecutar».

| Caso y pasos | Entorno y datos | Esperado | Observado / evidencia | Estado |
|---|---|---|---|---|
| Retención: confirmar sexta versión | PGlite; dos propietarios sintéticos | Conservar cinco y encolar solo la más antigua propia | Aprobado en `server/backups/retention.test.ts`; rollback probado | Aprobado simulado |
| Limpieza: listar, borrar y reintentar | PGlite y Blob simulado | Rechazar prefijo ajeno y conservar cola ante fallo | `server/backups/cleanup.test.ts`: tres pruebas aprobadas | Aprobado simulado |
| Expirar pendiente antigua | PGlite; fecha artificial | Expirar pendiente antigua, conservar recientes y confirmadas; rollback | `server/backups/expirePending.test.ts`: dos pruebas aprobadas; bordes exactos pendientes | Parcial |
| Ruta de mantenimiento: secreto y puerta | Solicitudes simuladas | Denegar sin autorización, no cachear ni revelar errores | `maintenance.test.ts`, `maintenanceVercel.test.ts` aprobados | Aprobado simulado |
| Invitaciones válidas, usadas, vencidas y revocadas; sesiones sin o con revocación | Dos cuentas y administrador de prueba aislados | Solo acceso autorizado; roles decididos por servidor | Hay pruebas automatizadas en `server/auth/`; falta matriz caso por caso y verificación real | Pendiente |
| Aislamiento de copias, dispositivos, restauración y administración | Dos cuentas y administrador aislados | Denegar acceso cruzado y acciones administrativas no autorizadas | Pruebas automatizadas parciales en `server/backups/` y `server/auth/`; falta verificación real | Pendiente |
| Sesión nativa sin azp, firma, emisor, caducidad y sesión activa | Tokens sintéticos y entorno Clerk aislado | Aplicar contrato configurado sin debilitar validación | `server/auth/clerkVerifier.test.ts`: emisor incorrecto, caducidad, sesión revocada y azp nativo configurado; comportamiento desplegado sin verificar | Parcial |
| HTTPS, CORS, tamaños, hash, caducidad, redirecciones y secretos en artefactos | Solicitudes y artefactos aislados | Rechazar entradas inválidas; sin secretos ni caché privada | Pruebas dispersas existentes; inspección completa y escaneo de APK pendientes | Pendiente |
| Límite de solicitudes y recuperación de copia con muchas imágenes | Entorno de prueba aislado | Detectar límites y reintentar sin perder instantánea | Límite y comportamiento real no medidos | Pendiente |
| Invitado, reinicio offline y vinculación | Android real; rutina sintética | Datos locales intactos | Sin ejecutar | Pendiente |
| Copia manual, automática, versiones, cambios, divergencia, reintentos y cambio de cuenta | Dos dispositivos y cuentas de prueba | Conservar revisiones y elegir versión correcta | Flujo simulado en `server/backups/backupFlow.test.ts`; prueba histórica manual descrita por el propietario, no reproducida aquí | Pendiente |
| Restauración cancelada, confirmada y fallida; copia ajena, integridad, versión, imágenes y cambios tras vista previa | Dispositivos aislados | Reemplazar solo tras validación y confirmación | Hay pruebas automatizadas parciales; falta matriz y ejecución real | Pendiente |
| WorkManager: fondo, cierre, red, reinicio, batería, madrugada y 72 horas | Android real; intervalos reales | Ejecución preferente y recuperación, sin garantía de hora exacta | Sin ejecutar; registrar por separado detención forzada y restricciones del sistema | Pendiente |
| Publicar, modificar, archivar, restaurar y sincronizar catálogo; offline e imágenes | Administrador, usuario e invitado aislados | Conservar rutinas, recetas y snapshots | Pruebas de servidor y componentes simulados; estado publicado real sin verificar | Pendiente |
| Panel en móvil y escritorio: permisos, filtros, paginación, usuarios, imágenes y auditoría | Navegadores y cuentas de prueba | Operaciones autorizadas y datos coherentes | `src/admin/AdminApp.test.tsx` aprobado con dobles; sin revisión visual ni real | Pendiente |
| Mantenimiento concurrente: confirmación, enlaces vigentes, listados parciales, transacción y servicios caídos | Base y almacenamiento aislados | Ninguna copia referenciada borrada; trabajo recuperable | Algunos fallos y rollback probados; concurrencia y límites reales sin demostrar | Pendiente |
| Salud y consentimiento | Datos sintéticos | No incluir salud sin consentimiento | `backupService.ts` y `automaticBackup.ts` usan `healthConsent: false`; no afirmar respaldo remoto de salud | Parcial |

## Operación y recuperación: guía preliminar

- **Responsables y entornos:** el propietario debe identificar responsables y confirmar qué proyecto de Clerk, base Neon, almacenes Blob y despliegue Vercel son de prueba o producción antes de operar. El código local y `.env.example` no prueban el estado desplegado.
- **Clerk y Neon:** configurar de forma privada `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_ISSUER` y `ACCOUNT_ALLOWED_ORIGINS`; `CLERK_ALLOW_NATIVE_NO_AZP` solo si el contrato nativo lo requiere y se ha verificado. Invitaciones y administrador inicial deben prepararse y comprobarse en entorno aislado antes de conceder acceso real.
- **Almacenamiento:** `BLOB_READ_WRITE_TOKEN` corresponde a respaldos privados y `CATALOG_BLOB_READ_WRITE_TOKEN` al catálogo público; deben ser distintos. No copiar valores a documentación ni a variables `VITE_`. La configuración real de almacenes y OIDC está pendiente de verificación.
- **Puertas:** las APIs usan las variables de activación respectivas; el respaldo necesita `BACKUP_API_ENABLED` y `BACKUP_MAX_BYTES`. Mantenimiento exige `BACKUP_MAINTENANCE_ENABLED=true`, conexión, token privado y `CRON_SECRET`. La ruta local es `GET /api/cron/cleanup`, con Bearer secreto y respuestas `no-store`. `vercel.json` no declara cron. No activar hasta comprobar plan, frecuencia admisible, permisos, costos, límites y estado desplegado; aún no hay propuesta validada de programación.
- **Retención y fallos:** se conservan cinco confirmaciones; los pendientes antiguos se encolan tras siete días y la limpieza se retrasa una hora. Una ejecución atiende un lote de hasta 100 objetos o una expiración. El trabajo permanece en cola ante fallos; investigar estados y categorías sin registrar tokens, enlaces ni contenido. El selector examina primero la entrada vencida más antigua: si queda `blocked`, puede impedir avanzar a entradas posteriores y expiraciones. Vigilarlo y resolver la causa antes de activar; no eliminar manualmente registros u objetos sin investigación y autorización.
- **Recuperación:** conservar la copia local, resolver conexión o autorización y reintentar. Antes de reemplazar datos, comprobar identidad, versión y vista previa, y confirmar explícitamente. La restauración real y el procedimiento de reversión de despliegue todavía deben ensayarse con recursos aislados. No limpiar imágenes públicas hasta demostrar que no hay referencias.
- **Android:** `CLERK_PUBLISHABLE_KEY`, `ARSEN_BACKUP_API_ORIGIN`, `ARSEN_PRIVATE_BLOB_ORIGIN` y `VITE_CATALOG_API_ORIGIN` son configuración de compilación no secreta; el origen privado identifica el almacén, no es una credencial. Verificar entorno y ausencia de secretos en el artefacto antes de distribuir. Una APK debug no equivale a una versión de producción firmada.
- **Exportaciones:** conservar importación de respaldo completo y rutina, y exportaciones JSON/CSV de Ajustes (`src/domains/settings/pages/SettingsPage.tsx`). La paridad para invitados, offline y datos de salud no está demostrada.

## Pendientes para cierre

Completar verificación en servicios y dispositivos autorizados, matriz detallada, medición de límites y costo, preparación y prueba de recuperación/reversión y pruebas Android instrumentadas y reales. La APK debug identificada arriba es candidata para pruebas, no una versión lista para publicación. En aquella ejecución inicial no se activó cron ni se cambiaron servicios externos. La revisión fue inline; no hubo revisión independiente ni validación visual de interfaz.

## Seguimiento del 25 de noviembre: tareas 5 y 6

- **Registro:** la decisión posterior del propietario permite el registro directo desde la app. La exigencia anterior de impedir registro público mediante invitación queda sustituida por esa decisión; la activación sigue exigiendo identidad y correo verificado, y el rol se decide en el servidor. La configuración efectiva de Clerk debe verificarse en su entorno.
- **Cola bloqueada:** se reprodujo que una entrada asociada a una copia existente impedía avanzar a las siguientes. `cleanupOneBackup` conserva la entrada y aplaza su revisión una hora; una prueba con PGlite comprueba que la siguiente entrada avanza sin eliminar la copia referenciada. El cambio está local y aún no se ha desplegado. Los errores de listado o borrado conservan la cola; los lotes se limitan a 100 objetos y la entrada solo se retira tras un listado vacío.
- **Enlaces:** el código firma cargas con vigencia máxima de cinco minutos y descargas de dos; la demora de una hora de la cola ofrece margen, pero no sustituye una prueba real de concurrencia, interrupción y almacenamiento. No se han borrado imágenes públicas.
- **Entorno:** el proyecto `arsen-development` recibió un despliegue Preview anterior a la corrección de la cola, enlazado al dominio `arsen-development-preview.vercel.app`; el panel respondió 200 y cuenta, respaldos y administración respondieron 401 sin sesión. Esto no acredita una copia o restauración autenticada ni el estado de producción. La APK `Arsen-tour-rc4-debug.apk` se compiló localmente, SHA-256 `21b19de9350e772949038bac0d013530379e6a8daf74ef40d7947e728f15f464`; comparte identificador con la instalación existente y no se instaló.
- **Cron:** la propuesta inicial es una ejecución diaria, solo después de probar mantenimiento con datos aislados, confirmar el entorno y resolver observabilidad y recuperación. Vercel ejecuta cron sobre el despliegue de producción; una URL Preview enlazada no demuestra que se ejecute allí. En Hobby la frecuencia es diaria con precisión aproximada de una hora; verificar plan y configuración vigentes antes de aplicar. La operación consulta Neon y utiliza Vercel y Blob: no es de consumo cero y puede despertar cómputo. Una ejecución procesa como máximo un lote o una expiración, por lo que una vez al día puede no vaciar la cola con suficiente rapidez. No configurar ni activar hasta medir carga, costos, retrasos y capacidad. Referencias: https://vercel.com/docs/cron-jobs y https://vercel.com/docs/cron-jobs/usage-and-pricing.
- **Decisión posterior:** el propietario eligió mantenimiento manual desde el panel en lugar de cron. Hay una implementación local con autenticación y rol de administrador, confirmación y una unidad por ejecución; no realiza consultas periódicas y la puerta del cron sigue desactivada. Ejecutarla sí utiliza Neon, Vercel y Blob. Aún requiere despliegue y pruebas reales con recursos aislados; no se ha ejecutado limpieza real. La operación manual no aparece todavía en la auditoría administrativa persistente.
- **Pruebas reales pendientes:** aislamiento de dos cuentas y administrador, límites de carga en red, limpieza concurrente en almacenamiento aislado, restauración real, reinicio y 72 horas en Android, panel visual y procedimiento de reversión. No se consideran aprobadas por las pruebas simuladas. Se conservan las exportaciones locales para invitados y usuarios offline.

### Casos automatizados adicionales

Todos los casos siguientes se ejecutaron el 25 de noviembre de 2026 con PostgreSQL PGlite en memoria o dobles, sin acceso a cuentas reales ni borrado remoto. Su estado es **aprobado en aislamiento**, no en producción.

| Caso y pasos | Resultado esperado y observado | Evidencia |
|---|---|---|
| Preparar con dispositivo ajeno o dueño aportado por el cliente | Rechazado sin crear versión | `server/backups/prepare.test.ts` |
| Preparar dos veces, base divergente o ID en cola | Reintento idempotente; divergencia e ID en limpieza rechazados | `server/backups/prepare.test.ts` |
| Confirmar copia ajena, incompleta o con base cambiada | No se confirma ni se expone la copia | `server/backups/confirm.test.ts` |
| Revocar consentimiento antes o durante la verificación | No se confirman datos de salud sin consentimiento | `server/backups/confirm.test.ts` |
| Descargar sin sesión, como otra cuenta o una versión sin confirmar | No se firma acceso | `server/backups/authorizeDownload.test.ts` |
| Confirmar sexta versión o fallar al encolarla | Se conservan cinco; el error revierte la transacción | `server/backups/retention.test.ts` |
| Expirar copia antigua, conservar reciente y confirmada; fallo de cola | Solo se encola la antigua; el fallo conserva sus metadatos | `server/backups/expirePending.test.ts` |
| Listado ajeno, copia referenciada o borrado fallido | No se borra información ajena o referenciada; la cola se conserva | `server/backups/cleanup.test.ts` |
| Entrada referenciada seguida de otra entrada | Se aplaza la primera y avanza la segunda | `server/backups/cleanup.test.ts` |
| Listado vacío con páginas adicionales | Se informa error y no se da por terminada la limpieza | `server/backups/vercelCleanup.test.ts` |

Una ejecución real de estos mismos casos, la inspección de solicitudes y las condiciones de concurrencia siguen pendientes; la tabla no reemplaza la matriz trazable completa a la SPEC original y su anexo, que aún no se localizaron.
