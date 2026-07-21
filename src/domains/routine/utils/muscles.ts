import type { MuscleGroup } from '../types'

export const muscleGroups: MuscleGroup[] = ['Pecho', 'Espalda', 'Hombros', 'Brazos', 'Abdomen', 'Piernas']

const aliases: Array<[RegExp, MuscleGroup]> = [
  [/pecho|pectoral/i, 'Pecho'],
  [/espalda|dorsal|lat|trapecio|remo/i, 'Espalda'],
  [/hombro|deltoide/i, 'Hombros'],
  [/brazo|biceps|triceps|antebrazo/i, 'Brazos'],
  [/abdomen|abdominal|core/i, 'Abdomen'],
  [/pierna|cuadri|femoral|gluteo|pantorrilla|gemelo/i, 'Piernas'],
]

export function normalizeMuscleGroup(value: string | null | undefined): MuscleGroup {
  const rawValue = value?.trim()
  if (!rawValue) return 'Pecho'

  const exact = muscleGroups.find((group) => group.toLocaleLowerCase('es-MX') === rawValue.toLocaleLowerCase('es-MX'))
  if (exact) return exact

  return aliases.find(([pattern]) => pattern.test(rawValue))?.[1] ?? 'Pecho'
}
