import type { Equipment, LoadMode } from '../../domains/routine/types'
import type { WeightUnit } from '../../domains/workout/types'
import { formatWeight } from '../utils/weight'

const equipmentValues: Equipment[] = ['Barra', 'Mancuerna', 'Maquina', 'Maquina de polea', 'Peso corporal', 'Otro']

export function normalizeEquipment(value: unknown): Equipment {
  if (value === 'Polea') return 'Maquina de polea'
  if (typeof value === 'string' && equipmentValues.includes(value as Equipment)) return value as Equipment

  return 'Otro'
}

export function defaultLoadSettingsForEquipment(equipment: Equipment): { loadMode: LoadMode; barWeightKg: number } {
  return equipment === 'Barra' ? { barWeightKg: 20, loadMode: 'split' } : { barWeightKg: 0, loadMode: 'single' }
}

export function loadSettingsForEquipment(input: {
  barWeightKg?: number | null
  equipment: unknown
  loadMode?: LoadMode | null
}) {
  const equipment = normalizeEquipment(input.equipment)
  const defaults = defaultLoadSettingsForEquipment(equipment)
  const loadMode = input.loadMode === 'split' || input.loadMode === 'single' ? input.loadMode : defaults.loadMode
  const barWeightKg = equipment === 'Barra' && Number.isFinite(input.barWeightKg) ? Math.max(Number(input.barWeightKg), 0) : defaults.barWeightKg

  return { barWeightKg, equipment, loadMode }
}

export function buildEquipmentLoadNote(input: {
  barWeightKg?: number | null
  equipment: unknown
  loadMode?: LoadMode | null
  unit: WeightUnit
  weightKg: number
}) {
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) return null

  const settings = loadSettingsForEquipment(input)
  if (settings.equipment === 'Barra') {
    return [
      `Discos por lado: ${formatWeight(input.weightKg / 2, input.unit)}`,
      `Total con barra: ${formatWeight(input.weightKg + settings.barWeightKg, input.unit)}`,
    ].join(' · ')
  }

  if (settings.loadMode === 'split') return `Carga por lado: ${formatWeight(input.weightKg / 2, input.unit)}`

  return null
}
