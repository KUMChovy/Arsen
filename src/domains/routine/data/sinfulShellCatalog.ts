import { getBundledExerciseAsset } from '../../../shared/assets/exerciseImages'
import type { MuscleGroup } from '../types'
import { muscleGroups, normalizeMuscleGroup } from '../utils/muscles'

export type SinfulShellExercise = {
  id: string
  name: string
  canonicalName: string
  mainMuscle: MuscleGroup
  aliases: string[]
  technicalNotes: string
  bundledAssetId: string
}

export const SINFUL_SHELL_SCHEMA_VERSION = 1
export const SINFUL_SHELL_EXPECTED_COUNT = 74
export const sinfulShellMuscleFilters = ['Todos', ...muscleGroups] as const

export const sinfulShellCatalog: readonly SinfulShellExercise[] = [
  {
    "id": "sinful-shell-press-inclinado",
    "name": "Press inclinado",
    "canonicalName": "press-inclinado",
    "mainMuscle": "Pecho",
    "aliases": [
      "press inclinado con barra",
      "press de banca inclinado"
    ],
    "technicalNotes": "Músculo principal: pectoral superior. Mantén los omóplatos retraídos, baja la barra con control hacia la parte alta del pecho y evita despegar los glúteos del banco.",
    "bundledAssetId": "press-inclinado--pecho"
  },
  {
    "id": "sinful-shell-press-plano",
    "name": "Press plano",
    "canonicalName": "press-plano",
    "mainMuscle": "Pecho",
    "aliases": [
      "press de banca",
      "press banca con barra"
    ],
    "technicalNotes": "Músculo principal: pectoral mayor. Retrae y deprime los omóplatos, apoya firmemente los pies y controla la barra hasta tocar suavemente el pecho.",
    "bundledAssetId": "press-plano--pecho"
  },
  {
    "id": "sinful-shell-pec-deck",
    "name": "Pec deck",
    "canonicalName": "pec-deck",
    "mainMuscle": "Pecho",
    "aliases": [
      "aperturas en pec deck",
      "mariposa en máquina"
    ],
    "technicalNotes": "Músculo principal: pectoral mayor. Mantén el pecho elevado y los codos alineados con las empuñaduras; junta los brazos sin perder el control del estiramiento.",
    "bundledAssetId": "pec-deck--pecho"
  },
  {
    "id": "sinful-shell-cruce-de-poleas",
    "name": "Cruce de poleas",
    "canonicalName": "cruce-de-poleas",
    "mainMuscle": "Pecho",
    "aliases": [
      "cross over",
      "aperturas en polea"
    ],
    "technicalNotes": "Músculo principal: pectoral mayor. Conserva una ligera flexión de codos, estabiliza el torso y cruza las manos sin convertir el movimiento en un press.",
    "bundledAssetId": "cruce-de-poleas--pecho"
  },
  {
    "id": "sinful-shell-remo-t",
    "name": "Remo T",
    "canonicalName": "remo-t",
    "mainMuscle": "Espalda",
    "aliases": [
      "remo en barra T",
      "t-bar row"
    ],
    "technicalNotes": "Músculo principal: dorsal ancho y espalda media. Mantén la columna neutra, lleva los codos hacia atrás y evita impulsar el peso con la cadera.",
    "bundledAssetId": "remo-t--espalda"
  },
  {
    "id": "sinful-shell-jalon-al-pecho",
    "name": "Jalón al pecho",
    "canonicalName": "jalon-al-pecho",
    "mainMuscle": "Espalda",
    "aliases": [
      "jalón frontal",
      "lat pulldown"
    ],
    "technicalNotes": "Músculo principal: dorsal ancho. Inicia bajando los hombros, lleva la barra hacia la parte alta del pecho y evita balancear el torso.",
    "bundledAssetId": "jalon-al-pecho--espalda"
  },
  {
    "id": "sinful-shell-pullover-unilateral-en-polea",
    "name": "Pullover unilateral en polea",
    "canonicalName": "pullover-unilateral-en-polea",
    "mainMuscle": "Espalda",
    "aliases": [
      "jalón unilateral con brazo recto",
      "pullover a una mano"
    ],
    "technicalNotes": "Músculo principal: dorsal ancho. Mantén el brazo casi extendido, la cadera estable y dirige la mano hacia el costado sin flexionar de más el codo.",
    "bundledAssetId": "pullover-unilateral-en-polea--espalda"
  },
  {
    "id": "sinful-shell-press-militar-en-maquina",
    "name": "Press militar en máquina",
    "canonicalName": "press-militar-en-maquina",
    "mainMuscle": "Hombros",
    "aliases": [
      "press de hombro en máquina",
      "shoulder press máquina"
    ],
    "technicalNotes": "Músculo principal: deltoide anterior. Mantén la espalda apoyada, los antebrazos verticales y evita bloquear los codos con fuerza al extender.",
    "bundledAssetId": "press-militar-en-maquina--hombros"
  },
  {
    "id": "sinful-shell-face-pull",
    "name": "Face pull",
    "canonicalName": "face-pull",
    "mainMuscle": "Hombros",
    "aliases": [
      "jalón a la cara",
      "facepull"
    ],
    "technicalNotes": "Músculo principal: deltoide posterior. Lleva la cuerda hacia la cara separando las manos, rota externamente los hombros y evita elevar los trapecios.",
    "bundledAssetId": "face-pull--hombros"
  },
  {
    "id": "sinful-shell-elevacion-lateral-con-mancuerna",
    "name": "Elevación lateral con mancuerna",
    "canonicalName": "elevacion-lateral-con-mancuerna",
    "mainMuscle": "Hombros",
    "aliases": [
      "elevaciones laterales",
      "laterales con mancuernas"
    ],
    "technicalNotes": "Músculo principal: deltoide lateral. Eleva los brazos en el plano escapular con codos suaves y detente antes de perder control o encoger los hombros.",
    "bundledAssetId": "elevacion-lateral-con-mancuerna--hombros"
  },
  {
    "id": "sinful-shell-curl-predicador",
    "name": "Curl predicador",
    "canonicalName": "curl-predicador",
    "mainMuscle": "Brazos",
    "aliases": [
      "curl Scott",
      "curl en banco predicador"
    ],
    "technicalNotes": "Músculo principal: bíceps braquial. Mantén los brazos apoyados, extiende sin hiperextender el codo y evita despegar el torso para mover más peso.",
    "bundledAssetId": "curl-predicador--brazos"
  },
  {
    "id": "sinful-shell-extension-de-triceps-en-polea",
    "name": "Extensión de tríceps en polea",
    "canonicalName": "extension-de-triceps-en-polea",
    "mainMuscle": "Brazos",
    "aliases": [
      "jalón de tríceps",
      "pushdown de tríceps"
    ],
    "technicalNotes": "Músculo principal: tríceps braquial. Fija los codos junto al torso, extiende por completo con control y evita inclinarte para impulsar la carga.",
    "bundledAssetId": "extension-de-triceps-en-polea--brazos"
  },
  {
    "id": "sinful-shell-curl-martillo",
    "name": "Curl martillo",
    "canonicalName": "curl-martillo",
    "mainMuscle": "Brazos",
    "aliases": [
      "curl neutro",
      "hammer curl"
    ],
    "technicalNotes": "Músculo principal: braquial y braquiorradial. Conserva las muñecas neutras, los codos junto al cuerpo y evita balancear el torso.",
    "bundledAssetId": "curl-martillo--brazos"
  },
  {
    "id": "sinful-shell-curl-de-muneca",
    "name": "Curl de muñeca",
    "canonicalName": "curl-de-muneca",
    "mainMuscle": "Brazos",
    "aliases": [
      "curl de antebrazo",
      "flexión de muñeca"
    ],
    "technicalNotes": "Músculo principal: flexores del antebrazo. Apoya los antebrazos, mueve solo las muñecas y usa un recorrido controlado sin rebotes.",
    "bundledAssetId": "curl-de-muneca--brazos"
  },
  {
    "id": "sinful-shell-curl-invertido",
    "name": "Curl invertido",
    "canonicalName": "curl-invertido",
    "mainMuscle": "Brazos",
    "aliases": [
      "curl prono",
      "reverse curl"
    ],
    "technicalNotes": "Músculo principal: braquiorradial y extensores del antebrazo. Usa agarre prono, mantén las muñecas alineadas y evita separar los codos del cuerpo.",
    "bundledAssetId": "curl-invertido--brazos"
  },
  {
    "id": "sinful-shell-curl-braquiorradial",
    "name": "Curl braquiorradial",
    "canonicalName": "curl-braquiorradial",
    "mainMuscle": "Brazos",
    "aliases": [
      "curl Zottman parcial",
      "curl para braquiorradial"
    ],
    "technicalNotes": "Músculo principal: braquiorradial. Trabaja con agarre neutro o semiprono, controla la bajada y evita compensar con hombros o espalda.",
    "bundledAssetId": "curl-braquiorradial--brazos"
  },
  {
    "id": "sinful-shell-curl-con-barra-z",
    "name": "Curl con barra Z",
    "canonicalName": "curl-con-barra-z",
    "mainMuscle": "Brazos",
    "aliases": [
      "curl EZ",
      "curl con barra ez"
    ],
    "technicalNotes": "Músculo principal: bíceps braquial. Mantén los codos quietos, no arquees la espalda y baja la barra hasta una extensión cómoda.",
    "bundledAssetId": "curl-con-barra-z--brazos"
  },
  {
    "id": "sinful-shell-curl-bayesian",
    "name": "Curl bayesian",
    "canonicalName": "curl-bayesian",
    "mainMuscle": "Brazos",
    "aliases": [
      "curl bayesiano",
      "curl en polea detrás del cuerpo"
    ],
    "technicalNotes": "Músculo principal: bíceps braquial, porción larga. Coloca el brazo ligeramente detrás del torso, conserva el hombro estable y aprovecha el estiramiento sin adelantar el codo.",
    "bundledAssetId": "curl-bayesian--brazos"
  },
  {
    "id": "sinful-shell-rompecraneos",
    "name": "Rompecráneos",
    "canonicalName": "rompecraneos",
    "mainMuscle": "Brazos",
    "aliases": [
      "extensión de tríceps acostado",
      "skull crusher"
    ],
    "technicalNotes": "Músculo principal: tríceps braquial. Mantén los brazos inclinados y los codos estables; baja la barra detrás de la frente sin forzar la articulación.",
    "bundledAssetId": "rompecraneos--brazos"
  },
  {
    "id": "sinful-shell-hack-squat",
    "name": "Hack squat",
    "canonicalName": "hack-squat",
    "mainMuscle": "Piernas",
    "aliases": [
      "sentadilla hack",
      "hack en máquina"
    ],
    "technicalNotes": "Músculo principal: cuádriceps. Mantén la espalda apoyada, las rodillas alineadas con los pies y baja solo hasta conservar la pelvis estable.",
    "bundledAssetId": "hack-squat--piernas"
  },
  {
    "id": "sinful-shell-peso-muerto-rumano",
    "name": "Peso muerto rumano",
    "canonicalName": "peso-muerto-rumano",
    "mainMuscle": "Piernas",
    "aliases": [
      "rumano con barra",
      "romanian deadlift"
    ],
    "technicalNotes": "Músculo principal: isquiotibiales. Lleva la cadera hacia atrás con columna neutra, mantiene la barra cerca de las piernas y detén el descenso cuando pierdas tensión femoral.",
    "bundledAssetId": "peso-muerto-rumano--piernas"
  },
  {
    "id": "sinful-shell-prensa-45-grados",
    "name": "Prensa 45 grados",
    "canonicalName": "prensa-45-grados",
    "mainMuscle": "Piernas",
    "aliases": [
      "prensa inclinada",
      "leg press 45"
    ],
    "technicalNotes": "Músculo principal: cuádriceps y glúteos. Mantén la zona lumbar apoyada, alinea las rodillas con los pies y evita bloquearlas al extender.",
    "bundledAssetId": "prensa-45-grados--piernas"
  },
  {
    "id": "sinful-shell-curl-femoral",
    "name": "Curl femoral",
    "canonicalName": "curl-femoral",
    "mainMuscle": "Piernas",
    "aliases": [
      "curl de piernas",
      "leg curl"
    ],
    "technicalNotes": "Músculo principal: isquiotibiales. Mantén la cadera apoyada, flexiona las rodillas sin rebote y controla la fase de regreso.",
    "bundledAssetId": "curl-femoral--piernas"
  },
  {
    "id": "sinful-shell-extension-de-cuadriceps",
    "name": "Extensión de cuádriceps",
    "canonicalName": "extension-de-cuadriceps",
    "mainMuscle": "Piernas",
    "aliases": [
      "extensión de piernas",
      "leg extension"
    ],
    "technicalNotes": "Músculo principal: cuádriceps. Ajusta el eje de la máquina a la rodilla, extiende con control y evita lanzar el peso desde abajo.",
    "bundledAssetId": "extension-de-cuadriceps--piernas"
  },
  {
    "id": "sinful-shell-abduccion-de-cadera-en-maquina",
    "name": "Abducción de cadera en máquina",
    "canonicalName": "abduccion-de-cadera-en-maquina",
    "mainMuscle": "Piernas",
    "aliases": [
      "abductores en máquina",
      "apertura de cadera"
    ],
    "technicalNotes": "Músculo principal: glúteo medio. Mantén la pelvis estable, abre las piernas sin rebote y controla el regreso hasta conservar tensión.",
    "bundledAssetId": "abduccion-de-cadera-en-maquina--piernas"
  },
  {
    "id": "sinful-shell-aduccion-de-cadera-en-maquina",
    "name": "Aducción de cadera en máquina",
    "canonicalName": "aduccion-de-cadera-en-maquina",
    "mainMuscle": "Piernas",
    "aliases": [
      "aductores en máquina",
      "cierre de cadera"
    ],
    "technicalNotes": "Músculo principal: aductores. Mantén el torso estable, junta las piernas con control y evita forzar una apertura excesiva.",
    "bundledAssetId": "aduccion-de-cadera-en-maquina--piernas"
  },
  {
    "id": "sinful-shell-elevacion-de-gemelos",
    "name": "Elevación de gemelos",
    "canonicalName": "elevacion-de-gemelos",
    "mainMuscle": "Piernas",
    "aliases": [
      "pantorrilla de pie",
      "calf raise"
    ],
    "technicalNotes": "Músculo principal: gastrocnemio. Desciende el talón de forma controlada, pausa en el estiramiento y sube sin rebotar.",
    "bundledAssetId": "elevacion-de-gemelos--piernas"
  },
  {
    "id": "sinful-shell-crunch-en-polea",
    "name": "Crunch en polea",
    "canonicalName": "crunch-en-polea",
    "mainMuscle": "Abdomen",
    "aliases": [
      "crunch con cuerda",
      "abdominal en polea"
    ],
    "technicalNotes": "Músculo principal: recto abdominal. Flexiona la columna acercando costillas y pelvis, mantén la cadera estable y evita tirar solo con los brazos.",
    "bundledAssetId": "crunch-en-polea--abdomen"
  },
  {
    "id": "sinful-shell-crunch-en-maquina",
    "name": "Crunch en máquina",
    "canonicalName": "crunch-en-maquina",
    "mainMuscle": "Abdomen",
    "aliases": [
      "abdominal en máquina",
      "machine crunch"
    ],
    "technicalNotes": "Músculo principal: recto abdominal. Ajusta el asiento, enrolla el torso con control y evita empujar únicamente con brazos o cadera.",
    "bundledAssetId": "crunch-en-maquina--abdomen"
  },
  {
    "id": "sinful-shell-press-declinado-con-barra",
    "name": "Press declinado con barra",
    "canonicalName": "press-declinado-con-barra",
    "mainMuscle": "Pecho",
    "aliases": [
      "press banca declinado",
      "decline bench press"
    ],
    "technicalNotes": "Músculo principal: pectoral inferior. Fija los pies, retrae los omóplatos y baja la barra hacia la parte baja del pecho sin perder control.",
    "bundledAssetId": "press-declinado-con-barra--pecho"
  },
  {
    "id": "sinful-shell-press-plano-con-mancuernas",
    "name": "Press plano con mancuernas",
    "canonicalName": "press-plano-con-mancuernas",
    "mainMuscle": "Pecho",
    "aliases": [
      "press de banca con mancuernas",
      "dumbbell bench press"
    ],
    "technicalNotes": "Músculo principal: pectoral mayor. Mantén los omóplatos retraídos, baja las mancuernas de forma simétrica y evita chocar las pesas arriba.",
    "bundledAssetId": "press-plano-con-mancuernas--pecho"
  },
  {
    "id": "sinful-shell-press-inclinado-con-mancuernas",
    "name": "Press inclinado con mancuernas",
    "canonicalName": "press-inclinado-con-mancuernas",
    "mainMuscle": "Pecho",
    "aliases": [
      "press inclinado mancuernas",
      "incline dumbbell press"
    ],
    "technicalNotes": "Músculo principal: pectoral superior. Usa un ángulo moderado, mantiene antebrazos verticales y controla el descenso sin encoger los hombros.",
    "bundledAssetId": "press-inclinado-con-mancuernas--pecho"
  },
  {
    "id": "sinful-shell-press-en-maquina-convergente",
    "name": "Press en máquina convergente",
    "canonicalName": "press-en-maquina-convergente",
    "mainMuscle": "Pecho",
    "aliases": [
      "press convergente",
      "chest press convergente"
    ],
    "technicalNotes": "Músculo principal: pectoral mayor. Ajusta el asiento para alinear las manos con el pecho, mantén la espalda apoyada y junta las empuñaduras con control.",
    "bundledAssetId": "press-en-maquina-convergente--pecho"
  },
  {
    "id": "sinful-shell-fondos-para-pecho",
    "name": "Fondos para pecho",
    "canonicalName": "fondos-para-pecho",
    "mainMuscle": "Pecho",
    "aliases": [
      "dips para pecho",
      "fondos inclinados"
    ],
    "technicalNotes": "Músculo principal: pectoral inferior. Inclina ligeramente el torso, lleva los codos hacia afuera de forma controlada y baja solo hasta una profundidad cómoda para el hombro.",
    "bundledAssetId": "fondos-para-pecho--pecho"
  },
  {
    "id": "sinful-shell-flexiones",
    "name": "Flexiones",
    "canonicalName": "flexiones",
    "mainMuscle": "Pecho",
    "aliases": [
      "lagartijas",
      "push-ups"
    ],
    "technicalNotes": "Músculo principal: pectoral mayor. Mantén el cuerpo en línea recta, baja el pecho entre las manos y evita hundir la cadera o adelantar los hombros.",
    "bundledAssetId": "flexiones--pecho"
  },
  {
    "id": "sinful-shell-cruce-de-polea-de-abajo-hacia-arriba",
    "name": "Cruce de polea de abajo hacia arriba",
    "canonicalName": "cruce-de-polea-de-abajo-hacia-arriba",
    "mainMuscle": "Pecho",
    "aliases": [
      "cruce bajo a alto",
      "low to high cable fly"
    ],
    "technicalNotes": "Músculo principal: pectoral superior. Lleva las manos desde abajo hacia el centro del pecho, conserva los codos suaves y no arquees la espalda.",
    "bundledAssetId": "cruce-de-polea-de-abajo-hacia-arriba--pecho"
  },
  {
    "id": "sinful-shell-remo-con-barra",
    "name": "Remo con barra",
    "canonicalName": "remo-con-barra",
    "mainMuscle": "Espalda",
    "aliases": [
      "barbell row",
      "remo inclinado con barra"
    ],
    "technicalNotes": "Músculo principal: dorsal ancho y espalda media. Mantén el torso estable y la columna neutra, lleva la barra hacia el abdomen y evita levantarte en cada repetición.",
    "bundledAssetId": "remo-con-barra--espalda"
  },
  {
    "id": "sinful-shell-remo-unilateral-con-mancuerna",
    "name": "Remo unilateral con mancuerna",
    "canonicalName": "remo-unilateral-con-mancuerna",
    "mainMuscle": "Espalda",
    "aliases": [
      "remo a una mano",
      "one arm dumbbell row"
    ],
    "technicalNotes": "Músculo principal: dorsal ancho. Estabiliza el tronco, dirige el codo hacia la cadera y evita girar el torso para completar el recorrido.",
    "bundledAssetId": "remo-unilateral-con-mancuerna--espalda"
  },
  {
    "id": "sinful-shell-remo-sentado-en-polea",
    "name": "Remo sentado en polea",
    "canonicalName": "remo-sentado-en-polea",
    "mainMuscle": "Espalda",
    "aliases": [
      "remo bajo",
      "seated cable row"
    ],
    "technicalNotes": "Músculo principal: espalda media y dorsal ancho. Mantén el pecho elevado, lleva los codos atrás y no conviertas el movimiento en un balanceo del torso.",
    "bundledAssetId": "remo-sentado-en-polea--espalda"
  },
  {
    "id": "sinful-shell-jalon-con-agarre-neutro",
    "name": "Jalón con agarre neutro",
    "canonicalName": "jalon-con-agarre-neutro",
    "mainMuscle": "Espalda",
    "aliases": [
      "jalón neutro",
      "neutral grip lat pulldown"
    ],
    "technicalNotes": "Músculo principal: dorsal ancho. Deprime los hombros antes de tirar, acerca el agarre al pecho y evita impulsar la carga con la espalda baja.",
    "bundledAssetId": "jalon-con-agarre-neutro--espalda"
  },
  {
    "id": "sinful-shell-dominadas-pronas",
    "name": "Dominadas pronas",
    "canonicalName": "dominadas-pronas",
    "mainMuscle": "Espalda",
    "aliases": [
      "pull-ups",
      "dominadas agarre prono"
    ],
    "technicalNotes": "Músculo principal: dorsal ancho. Inicia desde una posición escapular activa, lleva el pecho hacia la barra y evita balancear las piernas.",
    "bundledAssetId": "dominadas-pronas--espalda"
  },
  {
    "id": "sinful-shell-dominadas-supinas",
    "name": "Dominadas supinas",
    "canonicalName": "dominadas-supinas",
    "mainMuscle": "Espalda",
    "aliases": [
      "chin-ups",
      "dominadas agarre supino"
    ],
    "technicalNotes": "Músculo principal: dorsal ancho y bíceps. Mantén el cuerpo estable, lleva el pecho hacia la barra y baja con control hasta una extensión cómoda.",
    "bundledAssetId": "dominadas-supinas--espalda"
  },
  {
    "id": "sinful-shell-pullover-bilateral-en-polea",
    "name": "Pullover bilateral en polea",
    "canonicalName": "pullover-bilateral-en-polea",
    "mainMuscle": "Espalda",
    "aliases": [
      "jalón con brazos rectos",
      "straight arm pulldown"
    ],
    "technicalNotes": "Músculo principal: dorsal ancho. Mantén ambos brazos casi extendidos, costillas controladas y lleva la barra hacia los muslos sin flexionar los codos.",
    "bundledAssetId": "pullover-bilateral-en-polea--espalda"
  },
  {
    "id": "sinful-shell-peso-muerto-convencional",
    "name": "Peso muerto convencional",
    "canonicalName": "peso-muerto-convencional",
    "mainMuscle": "Espalda",
    "aliases": [
      "deadlift",
      "peso muerto con barra"
    ],
    "technicalNotes": "Músculo principal: cadena posterior. Mantén la barra sobre el mediopié, crea tensión antes de despegar y extiende cadera y rodillas sin redondear la espalda.",
    "bundledAssetId": "peso-muerto-convencional--espalda"
  },
  {
    "id": "sinful-shell-press-militar-con-barra",
    "name": "Press militar con barra",
    "canonicalName": "press-militar-con-barra",
    "mainMuscle": "Hombros",
    "aliases": [
      "press de hombro con barra",
      "overhead press"
    ],
    "technicalNotes": "Músculo principal: deltoide anterior. Aprieta abdomen y glúteos, desplaza la cabeza para dejar pasar la barra y evita hiperextender la zona lumbar.",
    "bundledAssetId": "press-militar-con-barra--hombros"
  },
  {
    "id": "sinful-shell-press-arnold",
    "name": "Press Arnold",
    "canonicalName": "press-arnold",
    "mainMuscle": "Hombros",
    "aliases": [
      "arnold press",
      "press Arnold con mancuernas"
    ],
    "technicalNotes": "Músculo principal: deltoide anterior y lateral. Rota los brazos de forma fluida, mantén las costillas controladas y evita usar impulso.",
    "bundledAssetId": "press-arnold--hombros"
  },
  {
    "id": "sinful-shell-elevacion-lateral-unilateral-en-polea",
    "name": "Elevación lateral unilateral en polea",
    "canonicalName": "elevacion-lateral-unilateral-en-polea",
    "mainMuscle": "Hombros",
    "aliases": [
      "lateral a una mano en polea",
      "cable lateral raise"
    ],
    "technicalNotes": "Músculo principal: deltoide lateral. Mantén tensión continua, eleva en el plano escapular y evita inclinar el torso para mover la carga.",
    "bundledAssetId": "elevacion-lateral-unilateral-en-polea--hombros"
  },
  {
    "id": "sinful-shell-elevacion-lateral-en-maquina",
    "name": "Elevación lateral en máquina",
    "canonicalName": "elevacion-lateral-en-maquina",
    "mainMuscle": "Hombros",
    "aliases": [
      "laterales en máquina",
      "machine lateral raise"
    ],
    "technicalNotes": "Músculo principal: deltoide lateral. Ajusta el asiento para alinear hombros y apoyos, eleva con control y evita encoger los trapecios.",
    "bundledAssetId": "elevacion-lateral-en-maquina--hombros"
  },
  {
    "id": "sinful-shell-reverse-pec-deck",
    "name": "Reverse pec deck",
    "canonicalName": "reverse-pec-deck",
    "mainMuscle": "Hombros",
    "aliases": [
      "pec deck inverso",
      "aperturas posteriores en máquina"
    ],
    "technicalNotes": "Músculo principal: deltoide posterior. Mantén el pecho apoyado, abre los brazos sin retraer de forma excesiva las escápulas y controla el regreso.",
    "bundledAssetId": "reverse-pec-deck--hombros"
  },
  {
    "id": "sinful-shell-pajaros-con-mancuernas",
    "name": "Pájaros con mancuernas",
    "canonicalName": "pajaros-con-mancuernas",
    "mainMuscle": "Hombros",
    "aliases": [
      "elevaciones posteriores",
      "reverse fly con mancuernas"
    ],
    "technicalNotes": "Músculo principal: deltoide posterior. Inclina el torso con columna neutra, abre los brazos con codos suaves y evita balancear las pesas.",
    "bundledAssetId": "pajaros-con-mancuernas--hombros"
  },
  {
    "id": "sinful-shell-elevacion-frontal",
    "name": "Elevación frontal",
    "canonicalName": "elevacion-frontal",
    "mainMuscle": "Hombros",
    "aliases": [
      "front raise",
      "elevación frontal con mancuerna"
    ],
    "technicalNotes": "Músculo principal: deltoide anterior. Eleva hasta la altura del hombro, mantén las costillas controladas y evita usar impulso de cadera.",
    "bundledAssetId": "elevacion-frontal--hombros"
  },
  {
    "id": "sinful-shell-curl-con-barra-recta",
    "name": "Curl con barra recta",
    "canonicalName": "curl-con-barra-recta",
    "mainMuscle": "Brazos",
    "aliases": [
      "curl de bíceps con barra",
      "barbell curl"
    ],
    "technicalNotes": "Músculo principal: bíceps braquial. Mantén los codos cerca del torso, conserva las muñecas neutrales y evita arquear la espalda.",
    "bundledAssetId": "curl-con-barra-recta--brazos"
  },
  {
    "id": "sinful-shell-curl-alterno-con-mancuernas",
    "name": "Curl alterno con mancuernas",
    "canonicalName": "curl-alterno-con-mancuernas",
    "mainMuscle": "Brazos",
    "aliases": [
      "curl alternado",
      "alternating dumbbell curl"
    ],
    "technicalNotes": "Músculo principal: bíceps braquial. Supina la mano durante la subida, mantén el codo quieto y alterna sin balancear el torso.",
    "bundledAssetId": "curl-alterno-con-mancuernas--brazos"
  },
  {
    "id": "sinful-shell-curl-inclinado-con-mancuernas",
    "name": "Curl inclinado con mancuernas",
    "canonicalName": "curl-inclinado-con-mancuernas",
    "mainMuscle": "Brazos",
    "aliases": [
      "curl en banco inclinado",
      "incline dumbbell curl"
    ],
    "technicalNotes": "Músculo principal: bíceps braquial, porción larga. Mantén los hombros atrás, deja el brazo detrás del torso y evita adelantar el codo.",
    "bundledAssetId": "curl-inclinado-con-mancuernas--brazos"
  },
  {
    "id": "sinful-shell-curl-concentrado",
    "name": "Curl concentrado",
    "canonicalName": "curl-concentrado",
    "mainMuscle": "Brazos",
    "aliases": [
      "concentration curl",
      "curl apoyado en muslo"
    ],
    "technicalNotes": "Músculo principal: bíceps braquial. Apoya el brazo contra el muslo, flexiona sin mover el hombro y controla completamente la bajada.",
    "bundledAssetId": "curl-concentrado--brazos"
  },
  {
    "id": "sinful-shell-extension-de-triceps-con-cuerda",
    "name": "Extensión de tríceps con cuerda",
    "canonicalName": "extension-de-triceps-con-cuerda",
    "mainMuscle": "Brazos",
    "aliases": [
      "pushdown con cuerda",
      "jalón de tríceps con cuerda"
    ],
    "technicalNotes": "Músculo principal: tríceps braquial. Mantén los codos fijos y separa las puntas de la cuerda al final sin inclinar el torso.",
    "bundledAssetId": "extension-de-triceps-con-cuerda--brazos"
  },
  {
    "id": "sinful-shell-extension-de-triceps-sobre-la-cabeza-con-cuerda",
    "name": "Extensión de tríceps sobre la cabeza con cuerda",
    "canonicalName": "extension-de-triceps-sobre-la-cabeza-con-cuerda",
    "mainMuscle": "Brazos",
    "aliases": [
      "extensión overhead con cuerda",
      "tríceps por encima de la cabeza"
    ],
    "technicalNotes": "Músculo principal: tríceps braquial, porción larga. Mantén los codos orientados al frente, estabiliza las costillas y extiende sin arquear la espalda.",
    "bundledAssetId": "extension-de-triceps-sobre-la-cabeza-con-cuerda--brazos"
  },
  {
    "id": "sinful-shell-press-frances",
    "name": "Press francés",
    "canonicalName": "press-frances",
    "mainMuscle": "Brazos",
    "aliases": [
      "french press",
      "extensión de tríceps con barra Z"
    ],
    "technicalNotes": "Músculo principal: tríceps braquial. Mantén los codos relativamente juntos, baja la barra detrás de la cabeza y evita abrirlos durante la extensión.",
    "bundledAssetId": "press-frances--brazos"
  },
  {
    "id": "sinful-shell-fondos-para-triceps",
    "name": "Fondos para tríceps",
    "canonicalName": "fondos-para-triceps",
    "mainMuscle": "Brazos",
    "aliases": [
      "dips de tríceps",
      "fondos verticales"
    ],
    "technicalNotes": "Músculo principal: tríceps braquial. Conserva el torso más vertical, lleva los codos hacia atrás y baja solo hasta una profundidad cómoda para el hombro.",
    "bundledAssetId": "fondos-para-triceps--brazos"
  },
  {
    "id": "sinful-shell-crunch-en-suelo",
    "name": "Crunch en suelo",
    "canonicalName": "crunch-en-suelo",
    "mainMuscle": "Abdomen",
    "aliases": [
      "abdominal corto",
      "floor crunch"
    ],
    "technicalNotes": "Músculo principal: recto abdominal. Acerca las costillas a la pelvis, mantén la zona lumbar controlada y evita tirar del cuello.",
    "bundledAssetId": "crunch-en-suelo--abdomen"
  },
  {
    "id": "sinful-shell-elevacion-de-piernas-colgado",
    "name": "Elevación de piernas colgado",
    "canonicalName": "elevacion-de-piernas-colgado",
    "mainMuscle": "Abdomen",
    "aliases": [
      "hanging leg raise",
      "elevación de rodillas colgado"
    ],
    "technicalNotes": "Músculo principal: recto abdominal. Inicia con la pelvis en retroversión, eleva las piernas sin balanceo y controla el descenso.",
    "bundledAssetId": "elevacion-de-piernas-colgado--abdomen"
  },
  {
    "id": "sinful-shell-rueda-abdominal",
    "name": "Rueda abdominal",
    "canonicalName": "rueda-abdominal",
    "mainMuscle": "Abdomen",
    "aliases": [
      "ab wheel rollout",
      "rollout abdominal"
    ],
    "technicalNotes": "Músculo principal: recto abdominal y transverso. Mantén glúteos y abdomen activos, extiende solo hasta conservar la zona lumbar neutra y regresa sin colapsar.",
    "bundledAssetId": "rueda-abdominal--abdomen"
  },
  {
    "id": "sinful-shell-plancha",
    "name": "Plancha",
    "canonicalName": "plancha",
    "mainMuscle": "Abdomen",
    "aliases": [
      "plank",
      "plancha frontal"
    ],
    "technicalNotes": "Músculo principal: transverso abdominal. Mantén cabeza, tronco y pelvis alineados, aprieta glúteos y evita hundir la zona lumbar.",
    "bundledAssetId": "plancha--abdomen"
  },
  {
    "id": "sinful-shell-plancha-lateral",
    "name": "Plancha lateral",
    "canonicalName": "plancha-lateral",
    "mainMuscle": "Abdomen",
    "aliases": [
      "side plank",
      "plancha de costado"
    ],
    "technicalNotes": "Músculo principal: oblicuos. Alinea hombro, cadera y tobillos, eleva la pelvis y evita girar el torso hacia el suelo.",
    "bundledAssetId": "plancha-lateral--abdomen"
  },
  {
    "id": "sinful-shell-pallof-press",
    "name": "Pallof press",
    "canonicalName": "pallof-press",
    "mainMuscle": "Abdomen",
    "aliases": [
      "press Pallof",
      "antirrotación en polea"
    ],
    "technicalNotes": "Músculo principal: oblicuos y transverso abdominal. Mantén la pelvis y las costillas alineadas, extiende los brazos sin permitir que el torso rote.",
    "bundledAssetId": "pallof-press--abdomen"
  },
  {
    "id": "sinful-shell-sentadilla-trasera",
    "name": "Sentadilla trasera",
    "canonicalName": "sentadilla-trasera",
    "mainMuscle": "Piernas",
    "aliases": [
      "back squat",
      "sentadilla con barra atrás"
    ],
    "technicalNotes": "Músculo principal: cuádriceps y glúteos. Mantén el pie completo apoyado, las rodillas alineadas y el tronco firme durante todo el recorrido.",
    "bundledAssetId": "sentadilla-trasera--piernas"
  },
  {
    "id": "sinful-shell-sentadilla-frontal",
    "name": "Sentadilla frontal",
    "canonicalName": "sentadilla-frontal",
    "mainMuscle": "Piernas",
    "aliases": [
      "front squat",
      "sentadilla con barra frontal"
    ],
    "technicalNotes": "Músculo principal: cuádriceps. Mantén los codos altos, el torso erguido y el pie completo apoyado sin perder la posición de la barra.",
    "bundledAssetId": "sentadilla-frontal--piernas"
  },
  {
    "id": "sinful-shell-sentadilla-goblet",
    "name": "Sentadilla goblet",
    "canonicalName": "sentadilla-goblet",
    "mainMuscle": "Piernas",
    "aliases": [
      "goblet squat",
      "sentadilla copa"
    ],
    "technicalNotes": "Músculo principal: cuádriceps y glúteos. Sostén la carga cerca del pecho, abre las rodillas siguiendo los pies y mantén el torso estable.",
    "bundledAssetId": "sentadilla-goblet--piernas"
  },
  {
    "id": "sinful-shell-sentadilla-bulgara",
    "name": "Sentadilla búlgara",
    "canonicalName": "sentadilla-bulgara",
    "mainMuscle": "Piernas",
    "aliases": [
      "split squat búlgaro",
      "bulgarian split squat"
    ],
    "technicalNotes": "Músculo principal: cuádriceps y glúteos. Mantén la pelvis estable, apoya el pie delantero por completo y baja verticalmente sin colapsar la rodilla.",
    "bundledAssetId": "sentadilla-bulgara--piernas"
  },
  {
    "id": "sinful-shell-zancadas",
    "name": "Zancadas",
    "canonicalName": "zancadas",
    "mainMuscle": "Piernas",
    "aliases": [
      "lunges",
      "desplantes"
    ],
    "technicalNotes": "Músculo principal: cuádriceps y glúteos. Da un paso estable, controla la rodilla delantera y empuja el suelo sin perder el equilibrio.",
    "bundledAssetId": "zancadas--piernas"
  },
  {
    "id": "sinful-shell-hip-thrust",
    "name": "Hip thrust",
    "canonicalName": "hip-thrust",
    "mainMuscle": "Piernas",
    "aliases": [
      "empuje de cadera",
      "hip thrust con barra"
    ],
    "technicalNotes": "Músculo principal: glúteo mayor. Mantén la barbilla recogida, termina con la pelvis en retroversión y evita hiperextender la espalda.",
    "bundledAssetId": "hip-thrust--piernas"
  },
  {
    "id": "sinful-shell-curl-femoral-sentado",
    "name": "Curl femoral sentado",
    "canonicalName": "curl-femoral-sentado",
    "mainMuscle": "Piernas",
    "aliases": [
      "seated leg curl",
      "curl de piernas sentado"
    ],
    "technicalNotes": "Músculo principal: isquiotibiales. Ajusta el respaldo y los rodillos, mantén la cadera pegada al asiento y controla la extensión de rodilla.",
    "bundledAssetId": "curl-femoral-sentado--piernas"
  },
  {
    "id": "sinful-shell-elevacion-de-gemelos-sentado",
    "name": "Elevación de gemelos sentado",
    "canonicalName": "elevacion-de-gemelos-sentado",
    "mainMuscle": "Piernas",
    "aliases": [
      "pantorrilla sentado",
      "seated calf raise"
    ],
    "technicalNotes": "Músculo principal: sóleo. Mantén las rodillas flexionadas, baja los talones con control y pausa arriba sin rebotar.",
    "bundledAssetId": "elevacion-de-gemelos-sentado--piernas"
  },
  {
    "id": "sinful-shell-patada-de-gluteo-en-polea",
    "name": "Patada de glúteo en polea",
    "canonicalName": "patada-de-gluteo-en-polea",
    "mainMuscle": "Piernas",
    "aliases": [
      "kickback en polea",
      "extensión de cadera en polea"
    ],
    "technicalNotes": "Músculo principal: glúteo mayor. Estabiliza el tronco y la pelvis, extiende la cadera sin arquear la espalda y controla el regreso.",
    "bundledAssetId": "patada-de-gluteo-en-polea--piernas"
  }
]

const sinfulShellById = new Map(sinfulShellCatalog.map((exercise) => [exercise.id, exercise]))
const requiredFields = ['id', 'name', 'canonicalName', 'mainMuscle', 'aliases', 'technicalNotes', 'bundledAssetId'] as const

export function getSinfulShellExerciseById(id: string) {
  return sinfulShellById.get(id) ?? null
}

export function isSinfulShellTechnicalNotes(value: string) {
  return value.startsWith('M\u00fasculo principal:')
}

export function searchSinfulShellExercises({
  muscle = 'Todos',
  query = '',
}: {
  muscle?: MuscleGroup | 'Todos' | null
  query?: string
} = {}) {
  const normalizedQuery = query.trim().toLocaleLowerCase('es-MX')

  return sinfulShellCatalog.filter((exercise) => {
    const matchesMuscle = !muscle || muscle === 'Todos' || exercise.mainMuscle === normalizeMuscleGroup(muscle)
    if (!matchesMuscle) return false
    if (!normalizedQuery) return true

    return [exercise.name, exercise.canonicalName, exercise.mainMuscle, exercise.bundledAssetId, ...exercise.aliases]
      .join(' ')
      .toLocaleLowerCase('es-MX')
      .includes(normalizedQuery)
  })
}

export function validateSinfulShellCatalog() {
  const errors: string[] = []
  const ids = new Set<string>()
  const canonicalNames = new Set<string>()
  const bundledAssetIds = new Set<string>()

  if (sinfulShellCatalog.length !== SINFUL_SHELL_EXPECTED_COUNT) {
    errors.push(`Sinful Shell debe contener ${SINFUL_SHELL_EXPECTED_COUNT} ejercicios; contiene ${sinfulShellCatalog.length}`)
  }

  for (const exercise of sinfulShellCatalog) {
    for (const field of requiredFields) {
      const value = exercise[field]
      if (Array.isArray(value) ? value.length === 0 : !String(value ?? '').trim()) {
        errors.push(`${exercise.id || 'sin-id'} no tiene ${field}`)
      }
    }

    if (ids.has(exercise.id)) errors.push(`id duplicado: ${exercise.id}`)
    ids.add(exercise.id)

    if (canonicalNames.has(exercise.canonicalName)) errors.push(`canonicalName duplicado: ${exercise.canonicalName}`)
    canonicalNames.add(exercise.canonicalName)

    if (bundledAssetIds.has(exercise.bundledAssetId)) errors.push(`bundledAssetId duplicado: ${exercise.bundledAssetId}`)
    bundledAssetIds.add(exercise.bundledAssetId)

    if (!muscleGroups.includes(exercise.mainMuscle)) errors.push(`musculo invalido en ${exercise.id}: ${exercise.mainMuscle}`)
    if (!isSinfulShellTechnicalNotes(exercise.technicalNotes)) errors.push(`technicalNotes sin prefijo obligatorio: ${exercise.id}`)
    if (!getBundledExerciseAsset(exercise.bundledAssetId)) errors.push(`asset faltante para ${exercise.id}: ${exercise.bundledAssetId}`)
  }

  return errors
}
