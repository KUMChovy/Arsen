# Exportacion CSV De Progreso Mejorada

## Objetivo

Mejorar `exportProgressCsv` para que el archivo sea completo y legible para usuarios en Excel/Sheets, sin cambiar el respaldo JSON ni agregar servicios externos.

## Alcance

- El CSV de progreso se genera 100% local en el navegador.
- `exportProgressJson` y `buildProgressExport` conservan su formato actual.
- Las filas principales del timeline se expanden solo al serializar CSV: una fila por serie principal y una fila por cada drop set asociado.
- Los filtros existentes `canonicalName` y `dayId` se aplican igual que hoy porque el CSV sigue partiendo de `buildProgressExport(filters)`.

## Formato CSV

- Usar `papaparse` y su API `unparse` para serializar filas y escapar celdas.
- Agregar BOM UTF-8 (`\ufeff`) al inicio del contenido descargado.
- Usar separador `;` para reducir friccion con Excel en configuraciones es-MX/LatAm.`r`n- Escribir `sep=;` despues del BOM para que Excel detecte el separador correcto al abrir el CSV con doble click.
- Usar encabezados visibles en espanol:
  - `Fecha`
  - `Rutina`
  - `Dia`
  - `Ejercicio`
  - `Musculo`
  - `Equipo`
  - `Serie`
  - `Tipo de serie`
  - `Serie principal`
  - `Peso (kg)`
  - `Repeticiones`
  - `RIR`
  - `Volumen`
  - `Puntaje`
- `Tipo de serie` sera `principal` o `drop`.
- Serie principal queda vacia para filas principales y contiene el numero de serie principal para filas drop.
- Las columnas de texto se normalizan a una sola linea para evitar filas partidas por saltos internos en nombres/notas historicas.
- La columna Serie usa numeros para series principales y Drop N para drop sets.
- Los IDs tecnicos no se muestran en el CSV de usuario. El JSON sigue disponible como formato completo/depuracion.

## Numeros

- Peso y volumen se exportan con dos decimales.
- Puntaje se exporta con dos decimales.
- Repeticiones, RIR y serie se exportan como enteros.
- Los decimales visibles usan coma para lectura natural en Excel es-MX/LatAm.

## Testing

Actualizar `src/domains/settings/services.test.ts` con un test que falle si:

- El CSV no empieza con BOM.
- El header no usa los nombres nuevos.
- Un drop set registrado no aparece como fila propia.
- La fila drop no referencia su serie principal.
- El formato numerico no usa decimales consistentes.

## Fuera De Alcance

- No crear export avanzado ni ZIP.
- No cambiar backup completo JSON.
- No cambiar `exportProgressJson`.
- No modificar pantallas ni flujos de descarga.
