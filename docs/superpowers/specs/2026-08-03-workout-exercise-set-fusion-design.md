# Workout: fusion de ejercicios y series del dia

## Contexto

WorkoutPage muestra hoy dos superficies separadas:

- "Series registradas", una lista global con todas las series de la sesion.
- "Ejercicios del dia", una lista de ejercicios con estado y acceso al registro.

El usuario quiere que ambas queden fusionadas: el historial de series debe vivir dentro del contexto del ejercicio activo o seleccionado, con editar y eliminar desde ahi.

## Objetivo

Crear una sola seccion principal de "Ejercicios y series del dia" donde cada ejercicio del dia pueda desplegar sus series registradas de la sesion actual.

El flujo debe seguir siendo rapido para uso movil durante el entrenamiento: tocar un ejercicio debe revelar su historial del dia y permitir editar o eliminar series sin buscar en una lista global separada.

## Direccion elegida

Usar una fusion inline en la lista existente de ejercicios del dia.

- Cada ejercicio conserva su card, arte, estado, receta y boton de indicaciones.
- Al tocar el ejercicio, queda activo y despliega debajo sus series del dia.
- Solo se muestran las series del ejercicio activo dentro de su card.
- Las acciones de editar y eliminar reutilizan el flujo existente: `EditSetSheet`, `updateMainSet`, `deleteMainSet`, drop sets y confirmacion destructiva.
- La seccion global de "Series registradas" deja de ser la experiencia primaria; si se conserva, debe quedar secundaria y filtrada al ejercicio activo. La solucion preferida es eliminar la duplicacion visible y mostrar las series dentro de la seccion fusionada.

## Alcance

Incluido:

- Fusionar visual y funcionalmente "Ejercicios del dia" y "Series registradas".
- Mantener filtros de ejercicios por estado.
- Seleccionar/activar un ejercicio al presionarlo.
- Desplegar las series main registradas para ese ejercicio, ordenadas por `order`.
- Mostrar conteo y resumen breve de drop sets por serie.
- Editar serie desde el contexto del ejercicio.
- Eliminar serie desde el contexto del ejercicio.
- Cubrir con tests el despliegue, edicion y eliminacion desde el ejercicio activo.

Fuera de alcance:

- Cambiar el modelo de datos.
- Cambiar servicios de registro, salto, retomar o finalizar sesion salvo que sea necesario por una integracion directa.
- Redisenar `RegisterSetSheet` o `EditSetSheet`.
- Agregar dependencias.

## Flujo

1. El usuario entra a WorkoutPage.
2. Ve el card de "Ejercicio actual" y la seccion "Ejercicios y series del dia".
3. Toca un ejercicio de la lista.
4. Ese ejercicio queda activo y despliega sus series registradas del dia.
5. Desde cada row de serie puede:
   - Abrir edicion con `EditSetSheet`.
   - Eliminar con confirmacion.
6. Registrar una nueva serie sigue usando `RegisterSetSheet` para el ejercicio activo/seleccionado.
7. Saltar, cambiar de ejercicio, cambiar dia/rutina y finalizar sesion conservan su comportamiento existente.

## Estados

- Sin series para el ejercicio activo: mostrar un empty state compacto dentro del card del ejercicio.
- Con una o mas series: mostrar rows compactos con peso, reps, RIR y cantidad de drops.
- Pendiente/en progreso/hecho/saltado: conservar chips de estado actuales.
- Acciones pendientes: deshabilitar editar/eliminar como hoy con `isPending`.
- Filtro sin resultados: conservar empty state de filtro.

## Pruebas

Actualizar `WorkoutPage.test.tsx` para cubrir:

- Al presionar un ejercicio se despliegan sus series registradas dentro de la seccion fusionada.
- La lista fusionada no muestra series de otro ejercicio en el card activo.
- Editar una serie desde el ejercicio activo abre `EditSetSheet` y guardar llama `updateMainSet`.
- Eliminar una serie desde el ejercicio activo llama `deleteMainSet` tras confirmacion.

La verificacion final debe ejecutar al menos:

- `pnpm test src/domains/workout/pages/WorkoutPage.test.tsx`
- `pnpm build`
