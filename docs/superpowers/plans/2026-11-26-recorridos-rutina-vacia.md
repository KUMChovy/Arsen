# Recorridos y primera rutina: plan

**Objetivo:** explicar funciones reales y facilitar la creación de una primera rutina sin datos de demostración.

**Diseño:** `docs/superpowers/specs/2026-11-25-recorridos-rutina-vacia-design.md`. Ejecución en línea, sin subagentes.

1. Probar y crear inicialización vacía y migración única de `routine-demo-current`; conservar instantáneas de sesiones, otras rutinas y catálogo personal. No tocar respaldos. Verificar transacción e idempotencia.
2. Probar y ampliar el asistente para descubrir ejercicios Sinful Shell con catálogo personal vacío; reutilizar servicios existentes y validar errores y cancelación.
3. Probar y ampliar los recorridos por página, con pasos específicos en Ajustes y las vistas de Rutina; asegurar objetivos visibles, estados vacíos y accesibilidad móvil.
4. Revisar alcance, ejecutar pruebas completas, compilación y comprobaciones visuales disponibles; informar limitaciones.

Riesgos a verificar: sesiones antiguas sin nombres capturados, otra rutina activa, migración repetida, catálogo global ausente y estados sin rutina, día o ejercicios.
