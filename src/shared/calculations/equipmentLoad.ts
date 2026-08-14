import type { Equipment, LoadMode } from '../../domains/routine/types'
import type { WeightUnit } from '../../domains/workout/types'
import { formatWeight, kgToUnit } from '../utils/weight'

const equipmentValues: Equipment[] = ['Barra', 'Mancuerna', 'Maquina', 'Maquina de polea', 'Peso corporal', 'Otro']
export const DEFAULT_AVAILABLE_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]
const WEIGHT_EPSILON = 0.0001

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

export function normalizeAvailablePlateWeightsKg(value?: number[] | null) {
  const normalized = [...new Set((value ?? []).filter((weight) => Number.isFinite(weight) && weight > 0).map(roundGymWeight))].sort((a, b) => b - a)

  return normalized.length > 0 ? normalized : DEFAULT_AVAILABLE_PLATES_KG
}

export function calculatePlateBreakdown(input: { availablePlateWeightsKg?: number[] | null; targetWeightKg: number }) {
  const targetWeightKg = Math.max(roundGymWeight(input.targetWeightKg), 0)
  let remainingWeightKg = targetWeightKg
  const platesKg: number[] = []

  for (const plateKg of normalizeAvailablePlateWeightsKg(input.availablePlateWeightsKg)) {
    while (remainingWeightKg + WEIGHT_EPSILON >= plateKg) {
      platesKg.push(plateKg)
      remainingWeightKg = roundGymWeight(remainingWeightKg - plateKg)
    }
  }

  remainingWeightKg = remainingWeightKg <= WEIGHT_EPSILON ? 0 : roundGymWeight(remainingWeightKg)

  return {
    isExact: remainingWeightKg === 0,
    matchedWeightKg: roundGymWeight(targetWeightKg - remainingWeightKg),
    platesKg,
    remainingWeightKg,
  }
}

export function buildEquipmentLoadNote(input: {
  availablePlateWeightsKg?: number[] | null
  barWeightKg?: number | null
  equipment: unknown
  loadMode?: LoadMode | null
  unit: WeightUnit
  weightKg: number
}) {
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0) return null

  const settings = loadSettingsForEquipment(input)
  if (settings.equipment === 'Barra') {
    const breakdown = calculatePlateBreakdown({
      availablePlateWeightsKg: input.availablePlateWeightsKg,
      targetWeightKg: input.weightKg / 2,
    })
    const platesLabel = breakdown.platesKg.length > 0 ? formatPlateList(breakdown.platesKg, input.unit) : 'sin discos'
    const parts = [`Discos: ${platesLabel} por lado`]
    if (!breakdown.isExact) parts.push(`Faltan ${formatWeight(breakdown.remainingWeightKg, input.unit)} por lado`)
    parts.push(`Total con barra: ${formatWeight(input.weightKg + settings.barWeightKg, input.unit)}`)

    return parts.join(' - ')
  }

  if (settings.loadMode === 'split') return `Carga por lado: ${formatWeight(input.weightKg / 2, input.unit)}`

  return null
}

function formatPlateList(platesKg: number[], unit: WeightUnit) {
  return `${platesKg.map((plateKg) => formatPlateWeight(plateKg, unit)).join(' + ')} ${unit}`
}

function formatPlateWeight(valueKg: number, unit: WeightUnit) {
  const value = unit === 'kg' ? valueKg : kgToUnit(valueKg, unit)
  return String(roundGymWeight(value))
}

function roundGymWeight(value: number) {
  return Math.round(value * 100) / 100
}
