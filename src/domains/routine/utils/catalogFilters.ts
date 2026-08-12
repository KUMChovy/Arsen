import { canonicalName } from '../../../shared/utils/normalize'
import type { ExerciseCatalogItem, MuscleGroup } from '../types'
import { muscleGroups, normalizeMuscleGroup } from './muscles'

export type CatalogMuscleFilter = MuscleGroup | 'Todos'

export const catalogMuscleFilters = ['Todos', ...muscleGroups] as const

export function filterCatalogByQueryAndMuscle(
  catalog: readonly ExerciseCatalogItem[],
  query: string,
  muscle: CatalogMuscleFilter,
): ExerciseCatalogItem[] {
  const normalizedQuery = canonicalName(query)
  const selectedMuscle = muscle === 'Todos' ? null : normalizeMuscleGroup(muscle)

  return catalog.filter((item) => {
    if (selectedMuscle && normalizeMuscleGroup(item.mainMuscle) !== selectedMuscle) return false
    if (!normalizedQuery) return true

    return catalogSearchText(item).includes(normalizedQuery)
  })
}

function catalogSearchText(item: ExerciseCatalogItem) {
  return [item.name, ...item.aliases, normalizeMuscleGroup(item.mainMuscle), item.equipment].map(canonicalName).join(' ')
}
