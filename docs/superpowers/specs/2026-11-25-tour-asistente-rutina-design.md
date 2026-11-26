# Recorrido inicial y asistente de rutinas

## Objetivo

Ayudar a una persona nueva a identificar las funciones principales de Arsen y crear una rutina propia desde el teléfono. El recorrido se muestra una vez al entrar, puede omitirse y no requiere cuenta ni conexión. El asistente es el flujo principal al crear una rutina; el editor existente permanece disponible para modificarla después.

## Recorrido

Una instalación nueva recibe un indicador local durante la inicialización de la base, en la misma transacción que los datos de ejemplo. Las bases existentes no reciben automáticamente el recorrido. Tras entrar y terminar la inicialización, se muestran coach marks sobre la navegación de Entreno, Rutina, Progreso y Ajustes, con pasos breves, siguiente, anterior y omitir. El avance y el cierre no alteran entrenamientos; completar u omitir persiste el estado en el dispositivo. Debe mantenerse usable con lector de pantalla, teclado, tamaños reducidos y sin conexión. Si un elemento objetivo no está disponible, el diálogo sigue funcionando sin resaltarlo.

## Asistente

Al elegir crear rutina, un diálogo móvil guía por nombre, días y selección opcional de ejercicios del catálogo personal existente, y presenta un resumen antes de guardar. La persona elige libremente ejercicios y días; no se generan prescripciones ni metas de entrenamiento. Se permite volver y cancelar sin escribir datos. La confirmación crea y activa la rutina, días y ejercicios en una sola transacción usando los servicios existentes y sus valores por defecto; un error revierte todo y conserva la entrada en pantalla para reintentar. Deshabilitar el envío duplicado. Los usuarios pueden editar recetas y agregar ejercicios después.

## Restricciones y verificación

Conservar datos, el modo invitado, historial, respaldos, accesibilidad y cambios previos. Sin servicios remotos ni despliegues. Probar detección de instalación nueva, persistencia y omisión del tour; foco y navegación de pasos; cancelación, validación, guardado y rollback del asistente; integración con el editor. Verificar suite, compilación y visualización en Android cuando se disponga de dispositivo.
