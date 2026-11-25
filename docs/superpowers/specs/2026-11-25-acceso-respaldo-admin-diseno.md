# Acceso, respaldo y administración: diseño de correcciones

## Propósito

Hacer que el acceso móvil, la restauración y los estados de respaldo sean claros y reconocibles, y que el catálogo y las cuentas se puedan administrar cómodamente desde computadora. Conservar los flujos de datos que el propietario ya probó, la operación offline y la identidad oscura y morada de ARSEN. El archivo `tkh.png` existente es el recurso de marca; se conserva el original. La imagen de referencia de acceso mencionada por el propietario todavía no está disponible en la conversación y se incorporará a la revisión visual al recibirla.

## Acceso y cuenta

- Separar visual y estructuralmente el acceso inicial de la pantalla de cuenta y respaldo. El acceso móvil muestra el logo, registro por invitación, inicio de sesión e invitado, con negro y morado, disposición mínima y efectos discretos compatibles con movimiento reducido. Mantener funcionamiento en 360 px, zonas seguras y controles accesibles.
- Un invitado que abre Cuenta y respaldo llega al acceso y puede volver sin borrar datos. Una persona con sesión ve una página de gestión específica: identidad de cuenta, protección confirmada, cambios pendientes y acciones de respaldo/restauración y sesión. Una sesión temporalmente sin red no bloquea el entrenamiento ni borra el estado local.
- Al completar registro, acceso o verificación se solicita el permiso nativo de notificaciones de respaldo, informando su propósito y respetando la decisión del usuario. Si se deniega, mostrar cómo volver a intentarlo o habilitarlo desde Android; nunca tratar la denegación como fallo de acceso ni activar automáticamente la copia en la nube.
- Al elegir revisar una copia, presentar una confirmación visible y accesible con fecha, tamaño, aviso de reemplazo y acciones claras de restaurar o cancelar. Mantener las comprobaciones existentes de cuenta, integridad y revisión local; nada se reemplaza sin confirmación explícita.
- Al activar el respaldo automático, mostrar un resultado distinguible: activado y pendiente de envío, ya coincidente con copia confirmada, o error. Esperar la confirmación de la operación de WorkManager y comprobar su estado; si Android no programa el trabajo, no informar que está activo ni dejar una configuración nueva que lo indique. Una copia preparada permanece a salvo ante errores; no declarar protección en nube antes de confirmación del servidor.

## Administración

- Conservar la separación de borrador, publicación, archivo y restauración y sus autorizaciones en servidor. Presentar un panel de escritorio con identidad propia, adaptable a móvil: resumen con datos reales, catálogo con búsqueda y filtros dinámicos sobre el conjunto paginado del servidor, editor claro y vista previa de imagen seleccionada o guardada. Las alertas y confirmaciones reutilizan SweetAlert con foco accesible; no introducir borrado irreversible ni controles sin operación.
- En la lista de cuentas, recuperar desde Clerk en el servidor el nombre o correo principal correspondiente a los IDs de perfiles autorizados. Consultar solo después de verificar el rol administrador, limitar y validar los resultados y no incluir credenciales, imágenes ni contenido de respaldo. Si Clerk falla o no hay datos, conservar los metadatos existentes y mostrar un identificador alternativo sin inventar nombres. No registrar información personal en logs.
- Conservar los metadatos y estados de respaldos como información confirmada por servidor; no inferir que un respaldo automático llegó a la nube solo porque esté programado.

## Verificación y límites

Cubrir con pruebas acceso invitado y vinculado, denegación de notificaciones, programación fallida y exitosa, restauración confirmada/cancelada/fallida, búsqueda y paginación, vista previa, autorización administrativa y fallos de Clerk. Ejecutar pruebas y builds web y Android. Revisar escritorio y móvil; si no hay dispositivo Android, señalar que las capturas y el permiso nativo necesitan prueba manual. No desplegar ni cambiar servicios externos sin autorización específica.
