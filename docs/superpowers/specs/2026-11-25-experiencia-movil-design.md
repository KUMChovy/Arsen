# Experiencia móvil: entrenamiento, ajustes y avisos

El propietario pide conservar el entrenamiento offline y reorganizar la experiencia para trabajar cómodamente desde el teléfono. No desplegar durante este trabajo. Mantener los cambios previos de registro y el control de datos y permisos.

## Entreno y navegación

Cuando una sesión abierta pase de no tener todos sus ejercicios en estado `done` a tenerlos todos en ese estado, presentar automáticamente el sheet de finalización existente. La persona decide si finaliza o continúa; cada nueva transición a todos hechos puede volver a mostrarlo. No mostrarlo por ejercicios saltados ni cerrar sesiones automáticamente. Una sesión ya completada no vuelve a mostrar el aviso por recargar.

La barra inferior conserva las cinco rutas y toma como referencia la imagen: Entreno ocupa el centro y recibe énfasis visual. Fuera de Entreno navega a dicha pantalla; en Entreno se convierte en la acción para registrar la serie del ejercicio visible. Si no hay ejercicio disponible, la acción se desactiva. Se elimina la acción principal duplicada de la tarjeta, conservando las operaciones de edición y duplicación.

## Ajustes y cuenta

Organizar los ajustes existentes en categorías desplegables, con indicadores de estado cuando sean útiles; no retirar exportación, restauración, controles de salud, eliminación ni confirmaciones destructivas. Usar controles coherentes con su tipo: interruptores para estados binarios, selectores para alternativas, rangos cuando existan valores continuos y una pantalla específica para datos de cuenta y respaldo. No inventar preferencias que la aplicación no ofrece. Mantener accesibilidad, enfoque, operación a 360 px y funcionalidad offline.

La pantalla de cuenta y respaldo debe reducir la carga visual, agrupar acciones relacionadas y hacer claras sesión, estado de copia, restauración y confirmaciones. Mantener los caminos existentes y sus protecciones.

## Centro interno de notificaciones

Reunir avisos generados por Arsen, incluidos sesión pendiente, recordatorio de descarga y día por retomar, con historial de descartados. Persistir localmente con deduplicación por evento y estados activo/descartado; no recopilar notificaciones de otras aplicaciones ni prometer captura de avisos del sistema operativo. Permitir descartar deslizando y ofrecer alternativa accesible sin gestos. El descarte solo oculta el aviso; no ejecuta ni cancela la acción subyacente. Las confirmaciones destructivas y de reemplazo conservan su confirmación explícita.

## Estadísticas administrativas

Responder la pregunta de viabilidad con fuentes oficiales; la implementación de una integración remota no está incluida en esta solicitud de pregunta. Cualquier implementación posterior usaría exclusivamente servidor autorizado, credenciales privadas, datos agregados, permisos y límites reales del plan, y estados de indisponibilidad.

## Verificación

Probar transiciones de ejercicio y finalización, navegación contextual y ausencia de ejercicio, accesibilidad y alternativas sin gesto, persistencia y deduplicación, categorías y operaciones de ajustes y cuenta. Ejecutar suite y build; revisión visual en Android cuando haya dispositivo disponible. No suponer pruebas reales ni publicar.
