# Salud por ejercicio y carrusel de entrenamiento

## Intención

Ampliar la lectura opcional de Health Connect para conservar el resumen diario, el resumen de la sesión y una ventana de salud por ejercicio. La ventana de cada ejercicio se determina con las horas de sus series principales registradas en Arsen.

## Alcance

- Mantener los tres estados visibles de salud: todo el día, sesión de entrenamiento y ejercicio actual.
- Leer Health Connect con rangos específicos para el día, la sesión y cada ejercicio que tenga series.
- Persistir los resúmenes dentro de `WorkoutSession.health`; no crear una tabla Dexie ni cambiar el schema.
- Mostrar la tarjeta debajo de calentamiento en Entreno, con desplazamiento por gesto y navegación accesible.
- Ofrecer una vista compacta y otra expandida dentro de la misma tarjeta.
- Mostrar la duración y las métricas del ejercicio seleccionado en Progreso debajo de Última sesión y en el historial del ejercicio.
- Explicar que la disponibilidad y frescura dependen de Mi Fitness, Samsung Health, Fitbit, Garmin Connect u otra app compatible; algunas apps requieren abrirse para publicar datos y Health Connect puede entregar datos por intervalos de aproximadamente 30 minutos.

## Decisiones

- La ventana del ejercicio empieza en la primera serie principal y termina en la última serie principal registrada. Si solo existe una serie, no se envía una ventana porque no hay una duración real que medir.
- La ventana de sesión empieza en la primera serie principal registrada de cualquier ejercicio y termina en la última serie principal del último ejercicio. No se amplía con `startedAt`, `completedAt` ni la hora de sincronización cuando existen series; una sesión legacy sin series conserva el fallback de sus marcas guardadas.
- Health Connect sigue siendo la fuente de métricas; Arsen no prorratea métricas diarias entre ejercicios ni inventa valores faltantes.
- La lectura se hace bajo demanda al pulsar sincronizar. El carrusel cambia de estado localmente y no vuelve a consultar Health Connect.
- Los respaldos anteriores sin `session` ni `exercises` siguen siendo válidos.

## No alcance

- No se añade sincronización en segundo plano.
- No se afirma que todas las marcas actualicen datos en tiempo real.
- No se calcula una intensidad fisiológica propia por ejercicio si Health Connect no publicó registros en ese rango.
