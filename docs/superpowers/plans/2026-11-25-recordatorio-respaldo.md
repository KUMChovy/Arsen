# Plan: recordatorio de respaldo

1. Probar selección del último día y fecha local en `src/domains/account/` sin acceder a servicios remotos.
2. Conectar aviso descartable y centro de notificaciones con enlace a Cuenta y respaldo, solo para fecha actual y día final; probar cambios y deduplicación.
3. Implementar programación local Android con WorkManager, permiso existente, comprobación de fecha y navegación sin iniciar copia; probar cálculo de hora y expiración.
4. Ejecutar pruebas, builds web y Android y revisar UX y condiciones de error. No confundir recordatorio con respaldo confirmado.
