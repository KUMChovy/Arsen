import { describe, expect, it } from 'vitest'
import { formatWeight, kgToUnit, unitToKg } from './weight'

describe('weight utils', () => {
  it('keeps kg as the storage base unit', () => {
    expect(unitToKg(80, 'kg')).toBe(80)
    expect(kgToUnit(80, 'kg')).toBe(80)
  })

  it('converts lb display values to kg and back', () => {
    expect(unitToKg(220, 'lb')).toBe(99.8)
    expect(kgToUnit(100, 'lb')).toBe(220.5)
  })

  it('formats a stored kg value in the selected unit', () => {
    expect(formatWeight(100, 'kg')).toBe('100 kg')
    expect(formatWeight(100, 'lb')).toBe('220.5 lb')
  })
})
