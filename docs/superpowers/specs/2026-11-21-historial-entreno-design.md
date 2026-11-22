# Ajustes de entreno e historial

## Objetivo

Facilitar el registro y la consulta en teléfonos: dar protagonismo al ejercicio actual y a Entreno, y hacer que calendario y lista sean el centro del historial.

## Diseño aprobado

- Aumentar la imagen del ejercicio actual conservando controles y legibilidad a 360 px.
- Situar Entreno en el centro de la navegación de cinco pestañas y distinguirlo como acceso principal, con estados activo e inactivo accesibles.
- Reunir en un desplegable compacto los filtros de periodo, fecha única, rutina, día y ejercicio. La fecha única sustituye los campos de rango; periodo sigue disponible. Las opciones de día y ejercicio reaccionan a las selecciones aplicables.
- El calendario y la lista reflejan los filtros. Al abrir una fecha se muestran sus sesiones y se trasladan los filtros pertinentes; seleccionar un ejercicio limita los ejercicios mostrados en el detalle. El detalle completo de sesión ofrece filtros y búsqueda por ejercicio, sin alterar los datos.
- La pantalla por fecha sirve para elegir o crear sesiones, sin duplicar el detalle ni la edición de ejercicios. Conservar el detalle completo de sesión con sus acciones existentes, y mantener la creación manual y los enlaces previos.
- Las tarjetas de ejercicio del detalle de sesión comienzan cerradas. En Entreno, la sección de ejercicios y series adopta el aspecto de esas tarjetas y conserva estados, notas y acciones existentes.
- El aviso de sesión pendiente cobra presencia con una entrada breve y una señal visual de actividad limitada; conserva la fecha, el acceso directo y su estado deshabilitado. El movimiento reducido ofrece una versión estática.
- Mantener y verificar la paginación existente de la lista (20 sesiones por página), también al cambiar filtros.

## Restricciones

Interfaz en español, móvil desde 360 px, modo offline, navegación por teclado y controles etiquetados. Conservar datos históricos, instantáneas y edición de sesiones, rutas existentes y filtros usados por otras pantallas. No se agregan dependencias ni se cambia el esquema de datos.
