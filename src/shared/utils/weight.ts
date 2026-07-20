import type { WeightUnit } from '../../domains/workout/types'

const KG_PER_LB = 0.45359237

export function unitToKg(value: number, unit: WeightUnit) {
  if (unit === 'kg') return roundWeight(value)

  return roundWeight(value * KG_PER_LB)
}

export function kgToUnit(valueKg: number, unit: WeightUnit) {
  if (unit === 'kg') return roundWeight(valueKg)

  return roundWeight(valueKg / KG_PER_LB)
}

export function formatWeight(valueKg: number, unit: WeightUnit) {
  return `${kgToUnit(valueKg, unit)} ${unit}`
}

function roundWeight(value: number) {
  return Math.round(value * 10) / 10
}
