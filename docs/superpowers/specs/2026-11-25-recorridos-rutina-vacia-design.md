# Recorridos detallados y primera rutina

## Objetivo

Explicar las funciones reales de cada pantalla mediante recorridos que se puedan omitir y volver a abrir. Ampliar especialmente Ajustes y las vistas Ver, Editar y Catálogo de Rutina. Guiar la primera creación sin exigir una rutina de demostración.

## Datos existentes y primera entrada

Las instalaciones nuevas se inicializan con configuración válida, sin rutina ni días precreados. En instalaciones existentes se retira una sola vez la rutina identificada como `routine-demo-current`, incluso si fue modificada, conforme a la indicación de la persona. Se conservan las demás rutinas, los ejercicios personales del catálogo y el historial, incluidos los nombres necesarios para consultar sesiones antiguas. Si era la rutina activa, se activa otra existente cuando proceda; en caso contrario no se altera la selección. La operación es transaccional e idempotente y no borra copias de respaldo.

## Experiencia

- Los recorridos mantienen sus controles de anterior, siguiente, omitir y ayuda manual. Apuntan a elementos visibles y adaptan los pasos a estados vacíos, pestañas y secciones disponibles, sin cambiar ni guardar datos por el usuario.
- Ajustes explica Datos, Salud opcional, Rutinas, Deload, Notificaciones, Almacenamiento y Zona de limpieza; identifica importación, exportación y operaciones de reemplazo con claridad.
- Rutina diferencia Ver, Editar y Catálogo; explica sus acciones reales y el catálogo Sinful Shell, sus filtros, fichas e incorporación al catálogo personal y a los días.
- El asistente existente guía nombre, días, ejercicios y revisión; permite descubrir y utilizar Sinful Shell incluso con catálogo personal vacío. Conservará la opción de terminar sin elegir ejercicios y la edición posterior.
- Ningún recorrido promete funciones que no existan ni bloquea el uso normal. La experiencia funciona en móvil, con lector de pantalla y sin conexión para los datos disponibles localmente.

## Verificación

Pruebas de inicialización y migración, preservación de sesiones e idempotencia; pruebas de recorridos con vistas y estados vacíos; pruebas del asistente y catálogo; suite completa, compilación y verificación visual si hay dispositivo o emulador disponible.
