# SPEC 02 — Tareas 5 y 6: limpieza, seguridad, pruebas y cierre

**Estado:** propuesta para revisión. **Fecha:** 25 de noviembre de 2026.

## Alcance y antecedentes

Este documento reúne las tareas **5. Limpieza y seguridad** y **6. Pruebas de fondo y cierre** de la lista de pendientes presentada al propietario. Estos números no sustituyen la numeración de tareas del plan original. La SPEC 02 original y su anexo de 72 horas siguen siendo la autoridad funcional; las instrucciones vigentes de `AGENTS.md` gobiernan el proceso de trabajo y las autorizaciones.

El propietario indica que las tareas anteriores están terminadas. Tratarlo como contexto de entrega y preservar ese trabajo; antes de cerrar esta SPEC, comprobar con evidencia qué está implementado, desplegado y probado. No interpretar los párrafos históricos de los documentos anteriores como estado actual sin contrastarlos con el código, el entorno correspondiente y las pruebas. En una prueba anterior el propietario confirmó una copia manual y restauró una rutina en Android; esa evidencia no demuestra por sí sola los demás casos de la matriz ni el comportamiento automático durante 72 horas.

**Objetivo:** dejar verificables y operables los mecanismos de mantenimiento y seguridad de la SPEC 02, y reunir la evidencia necesaria para decidir si la aplicación, el catálogo y la administración están listos para su entrega.

**Entregables:** controles y pruebas que falten, mantenimiento seguro verificable, matriz de validación con resultados, documentación de operación y recuperación, y una APK candidata identificada por versión. Un caso no ejecutado o sin evidencia queda marcado como pendiente.

## Restricciones

- El entrenamiento y los datos locales deben seguir disponibles offline; no borrar datos personales, copias confirmadas, credenciales, ejercicios publicados ni historiales para probar.
- Las pruebas que escriban o eliminen datos usan recursos de prueba aislados, identificadores propios y límites verificables. Las operaciones destructivas, migraciones y cambios en servicios externos requieren la autorización aplicable antes de ejecutarse.
- Neon, Clerk y Vercel usados para desarrollo no se consideran automáticamente entornos de producción. No activar tareas de limpieza o cambiar permisos, límites, dominios ni despliegues reales sin comprobar el alcance y obtener la autorización necesaria.
- No exponer ni registrar contraseñas, tokens, enlaces firmados, contenido de entrenamientos o datos de salud. Los diagnósticos usan estados y categorías sanitizadas.
- Preservar la autorización por invitación, el modo invitado, el control de roles en servidor y el consentimiento explícito para salud. No reducir validaciones, accesibilidad, manejo de errores ni integridad.
- Respetar el funcionamiento de WorkManager y la política de madrugada local y 72 horas descrita en el diseño aprobado de respaldos. Es una programación preferente, no una garantía de hora exacta ni de ejecución tras una detención forzada.

## Punto de partida a verificar

- `server/backups/cleanup.ts`, `expirePending.ts`, `maintenance.ts`, `maintenanceVercel.ts` y `vercelCleanup.ts` ya contienen componentes de mantenimiento y pruebas. El adaptador exige la variable de activación, conexión, token privado y secreto de cron; `vercel.json` no declara actualmente una programación cron. Comprobar su estado desplegado antes de cualquier activación.
- La retención existente contempla hasta cinco versiones confirmadas y una cola de limpieza posterior a la confirmación. El código de expiración considera cargas pendientes antiguas y vuelve a comprobar su estado bajo bloqueo. Conservar esos contratos y contrastarlos con la SPEC y las pruebas vigentes antes de modificarlos.
- `privateBlobToken.ts` fuerza el uso del token privado; el catálogo usa almacenamiento público separado. Verificar que todos los caminos de carga, lectura, firma y limpieza mantengan esa separación incluso si Vercel proporciona OIDC y un almacén por defecto.
- La documentación de continuación registra 74 ejercicios publicados y verificaciones de imágenes en desarrollo, junto con notas históricas contradictorias. Confirmar el estado efectivo antes de presentar la publicación, los permisos o la disponibilidad offline como terminados.
- Los diseños recientes de respaldo automático y administración describen más funcionalidad que las notas anteriores. Verificar implementaciones y pruebas presentes sin rehacerlas ni tratarlas como probadas en dispositivos por el solo hecho de existir.

## Tarea 5: limpieza y seguridad

### Mantenimiento de respaldos

1. Revisar retención, confirmación, cola de limpieza, expiración de cargas pendientes y protección del último respaldo válido. La selección y la eliminación solo pueden afectar objetos cuyo propietario y prefijo hayan sido derivados y verificados por el servidor.
2. Mantener una cola durable y reintentos idempotentes. Verificar concurrencia con nuevas confirmaciones, reconfirmaciones, cargas firmadas aún vigentes, interrupciones, listados parciales y errores de Neon o Blob. Una falla conserva el trabajo pendiente y nunca debe borrar una copia referenciada.
3. Mantener la expiración y el retraso existentes —siete días para cargas pendientes y una hora antes de la limpieza, salvo que el diseño aprobado vigente indique otra cosa— y comprobarlos con reloj controlado, sin esperar esos plazos en las pruebas.
4. Comprobar la ruta de mantenimiento autenticada, el secreto de cron, los límites de ejecución, observabilidad sanitizada y la puerta `BACKUP_MAINTENANCE_ENABLED`. Proponer una programación compatible con el plan y las capacidades efectivas del entorno; no suponer cuotas ni capacidad de Vercel sin comprobarlas. Los reintentos, límites y costos deben documentarse antes de solicitar su activación.
5. Si se requiere limpieza de imágenes públicas huérfanas, diseñarla y probarla separadamente antes de habilitarla: comprobar borradores, publicaciones, referencias históricas, cargas en curso y período de seguridad. Ningún recurso todavía referenciado se elimina; si no se puede demostrar, conservarlo y registrar la limitación.

### Autenticación, aislamiento y protección

1. Verificar invitaciones válidas, usadas, vencidas y revocadas; impedir registro público y cambios de rol solicitados por clientes. Probar sesión ausente, vencida, revocada y cambio de cuenta durante operaciones.
2. Con al menos dos cuentas de prueba y una cuenta administradora, comprobar aislamiento en respaldos, dispositivos, restauración y administración. Un invitado o usuario común no puede ejecutar acciones administrativas ni acceder a copias ajenas.
3. Verificar el contrato vigente de tokens Clerk, incluidos los clientes nativos sin `azp` cuando se configure explícitamente, y la comprobación de firma, emisor, vencimiento y sesión activa. No debilitar controles para hacer pasar una prueba.
4. Revisar origen HTTPS, CORS, límites de cuerpo, URLs firmadas con alcance y caducidad, validación de tipo/tamaño/hash, redirecciones y no-cache en datos privados. Comprobar que tokens maestros y credenciales no aparezcan en APK, bundles, solicitudes ni registros.
5. Revisar y medir los límites distribuidos ya configurados. La regla de desarrollo de 120 solicitudes por IP cada 10 minutos puede afectar copias con muchas imágenes: probar y documentar el comportamiento, sin convertir ese valor en una cuota universal ni cambiarlo sin autorización. Verificar interrupción, reintento y recuperación sin perder la copia local.
6. Comprobar por separado los datos de salud y su consentimiento, y documentar qué se incluye realmente. No afirmar que se respaldan datos de salud cuando la opción esté desactivada o no exista.

## Tarea 6: pruebas, documentación y cierre

### Matriz funcional y de regresión

Construir una matriz trazable a las secciones 22 y 24 de la SPEC original y al anexo, con columnas **caso, entorno, datos de prueba, pasos, resultado esperado, resultado observado, evidencia, fecha y estado**. Como mínimo debe cubrir:

- Acceso por invitación, inicio de sesión, invitado, reinicio offline y vinculación sin pérdida de datos.
- Respaldo manual, automático y versiones: cambios antes/durante/después del envío, copia idéntica, divergencia, reintentos, selección histórica, cambio de cuenta y errores de autorización o red.
- Restauración cancelada, confirmada y fallida; copia ajena, integridad alterada, versión incompatible, imágenes ausentes y modificaciones locales después de la vista previa. El reemplazo solo ocurre tras confirmación y validación completas.
- WorkManager con app en segundo plano o cerrada, conectividad intermitente, reinicio, batería y corte de madrugada/72 horas; registrar por separado detención forzada y restricciones del sistema sin prometer ejecución.
- Publicación, modificación, archivo, restauración y sincronización del catálogo para cuenta e invitado; actualización offline/reconexión, imágenes y preservación de rutinas, recetas y snapshots históricos.
- Panel web en computadora y móvil, permisos, filtros, paginación, imágenes, usuarios, metadatos y auditoría. Distinguir verificaciones simuladas, de integración y reales.
- Retención y mantenimiento con almacenamiento aislado: interrupción, objetos ausentes, prefijos ajenos, límites, fallo de transacción y protección de versiones confirmadas.

Las pruebas en teléfono, segundo dispositivo, tras reinicio y en intervalos reales se registran como **pendientes** hasta que el propietario las ejecute o exista evidencia equivalente. Ninguna simulación sustituye una prueba real si la SPEC la exige.

### Documentación operativa

Preparar una guía sin secretos que identifique entornos, variables requeridas, responsables y pasos para: configuración de Clerk/Neon/Blob/Vercel; invitaciones y administrador inicial; separación de almacenes; límites y retención; cron, diagnóstico y recuperación; despliegue y reversión; pérdida de conexión; y verificación de restauración. Indicar el origen privado no secreto que necesita la compilación Android, sin copiar tokens ni valores sensibles. Documentar lo que requiere autorización o pago y lo que no se haya podido verificar.

### Exportaciones antiguas

La SPEC propone retirar importación/exportación JSON y CSV solo después de comprobar respaldos y restauraciones remotas. Antes de cualquier retirada, identificar todas las rutas y usos existentes y producir evidencia de recuperación suficiente, incluida una estrategia para datos de usuarios invitados y sin conexión. Si falta paridad, migración segura o claridad sobre pérdida de funcionalidad, conservar los flujos y plantear la decisión al propietario; no eliminar serialización interna necesaria.

### Verificación y entrega

1. Ejecutar las pruebas unitarias y de integración pertinentes, `pnpm test`, `pnpm build` y las pruebas Android; generar el service worker con el comando de build del proyecto. Compilar el panel administrativo y el servidor cuando sus cambios lo requieran.
2. Revisar los cambios completos en modo inline según `AGENTS.md`; si se modifica la interfaz, aplicar las etapas de Impeccable exigidas y registrar cualquier revisión visual no realizada.
3. Generar una APK candidata con configuración y versión identificables. No sustituir una APK de usuario ni publicar una versión sin la autorización correspondiente.
4. Entregar la matriz y una lista de controles: **aprobado**, **fallido**, **pendiente** o **no aplica**, indicando evidencia y riesgos residuales. Separar pruebas reales de pruebas con simuladores o dobles.

## Criterios de aceptación

- El mantenimiento demuestra que conserva la última copia válida y no borra datos ajenos, publicados, referenciados o todavía necesarios; ante fallo queda trabajo recuperable.
- La identidad y permisos se comprueban en servidor, los almacenes permanecen separados y las pruebas cubren aislamiento, revocación y fallos sin revelar secretos.
- La matriz contiene resultados verificables para la SPEC y el anexo; las pruebas manuales y las dependientes del tiempo no se marcan como exitosas por anticipado.
- Existen instrucciones reproducibles de operación y recuperación, una APK candidata verificable y una lista explícita de limitaciones.
- La retirada de exportaciones antiguas solo se considera después de satisfacer las condiciones anteriores y preservar una vía segura para los datos de invitados y usuarios offline.

## Secuencia propuesta

1. Auditar el estado actual y registrar evidencias, sin alterar datos ni servicios.
2. Completar y probar en aislamiento mantenimiento y seguridad, siguiendo el proceso de corrección o diseño que corresponda.
3. Preparar y ejecutar la matriz automatizada; entregar al propietario las pruebas que requieren dispositivos o tiempo real.
4. Preparar documentación, APK y propuesta concreta de activación/despliegue. Ejecutar cambios externos únicamente con la autorización aplicable.
5. Cerrar solo cuando los criterios se cumplan; si existe alguna excepción, dejarla identificada y acordada, no presentarla como completada.
