import { describe, expect, it } from 'vitest'
import {
  buildEquipmentLoadNote,
  calculatePlateBreakdown,
  DEFAULT_AVAILABLE_PLATES_KG,
  defaultLoadSettingsForEquipment,
  loadSettingsForEquipment,
  normalizeAvailablePlateWeightsKg,
  normalizeEquipment,
} from './equipmentLoad'

describe('equipment load calculations', () => {
  it('normalizes legacy pulley equipment', () => {
    expect(normalizeEquipment('Polea')).toBe('Maquina de polea')
    expect(normalizeEquipment('Maquina de polea')).toBe('Maquina de polea')
    expect(normalizeEquipment('Cuerda rara')).toBe('Otro')
  })

  it('defaults load settings by equipment', () => {
    expect(defaultLoadSettingsForEquipment('Barra')).toEqual({ barWeightKg: 20, loadMode: 'split' })
    expect(defaultLoadSettingsForEquipment('Mancuerna')).toEqual({ barWeightKg: 0, loadMode: 'single' })
    expect(defaultLoadSettingsForEquipment('Maquina')).toEqual({ barWeightKg: 0, loadMode: 'single' })
    expect(defaultLoadSettingsForEquipment('Maquina de polea')).toEqual({ barWeightKg: 0, loadMode: 'single' })
  })

  it('fills missing settings while preserving explicit split mode', () => {
    expect(loadSettingsForEquipment({ equipment: 'Maquina', loadMode: 'split' })).toEqual({
      barWeightKg: 0,
      equipment: 'Maquina',
      loadMode: 'split',
    })
  })

  it('calculates exact barbell plates greedily without passing the target', () => {
    expect(calculatePlateBreakdown({ targetWeightKg: 30, availablePlateWeightsKg: [25, 20, 10, 5, 2.5] })).toEqual({
      isExact: true,
      matchedWeightKg: 30,
      platesKg: [25, 5],
      remainingWeightKg: 0,
    })
  })

  it('rejects a non-finite target', () => {
    expect(() => calculatePlateBreakdown({ targetWeightKg: Number.NaN })).toThrow(RangeError)
    expect(() => calculatePlateBreakdown({ targetWeightKg: Number.MAX_VALUE })).toThrow(RangeError)
    expect(() => calculatePlateBreakdown({ targetWeightKg: 1e9, availablePlateWeightsKg: [0.01] })).toThrow(RangeError)
    expect(buildEquipmentLoadNote({ equipment: 'Barra', unit: 'kg', weightKg: 1e100 })).toBeNull()
  })

  it('calculates the closest plate breakdown below a non-exact target', () => {
    expect(calculatePlateBreakdown({ targetWeightKg: 28.2, availablePlateWeightsKg: [25, 10, 5, 2.5] })).toEqual({
      isExact: false,
      matchedWeightKg: 27.5,
      platesKg: [25, 2.5],
      remainingWeightKg: 0.7,
    })
  })

  it('normalizes configurable plate inventory', () => {
    expect(normalizeAvailablePlateWeightsKg([2.5, 20, 0, Number.NaN, 2.5, -1, 10])).toEqual([20, 10, 2.5])
    expect(normalizeAvailablePlateWeightsKg([])).toEqual(DEFAULT_AVAILABLE_PLATES_KG)
  })

  it('does not keep a plate that rounds to zero', () => {
    expect(normalizeAvailablePlateWeightsKg([0.001, 20])).toEqual([20])
    expect(normalizeAvailablePlateWeightsKg([Number.MAX_VALUE, 20])).toEqual([20])
  })

  it('builds a barbell note from disk weight', () => {
    expect(
      buildEquipmentLoadNote({
        barWeightKg: 20,
        equipment: 'Barra',
        loadMode: 'split',
        unit: 'kg',
        weightKg: 40,
      }),
    ).toBe('Discos: 20 kg por lado - Total con barra: 60 kg')
  })

  it('preserves small plate decimals in barbell notes', () => {
    expect(
      buildEquipmentLoadNote({
        barWeightKg: 20,
        equipment: 'Barra',
        loadMode: 'split',
        unit: 'kg',
        weightKg: 57.5,
      }),
    ).toBe('Discos: 25 + 2.5 + 1.25 kg por lado - Total con barra: 77.5 kg')
  })

  it('builds a barbell note with concrete plates and remaining weight', () => {
    expect(
      buildEquipmentLoadNote({
        availablePlateWeightsKg: [25, 10, 5, 2.5],
        barWeightKg: 20,
        equipment: 'Barra',
        loadMode: 'split',
        unit: 'kg',
        weightKg: 56.4,
      }),
    ).toBe('Discos: 25 + 2.5 kg por lado - Faltan 0.7 kg por lado - Total con barra: 76.4 kg')
  })

  it('builds a split machine note', () => {
    expect(
      buildEquipmentLoadNote({
        barWeightKg: 0,
        equipment: 'Maquina',
        loadMode: 'split',
        unit: 'kg',
        weightKg: 80,
      }),
    ).toBe('Carga por lado: 40 kg')
  })

  it('does not build a note for single-point dumbbells', () => {
    expect(
      buildEquipmentLoadNote({
        barWeightKg: 0,
        equipment: 'Mancuerna',
        loadMode: 'single',
        unit: 'kg',
        weightKg: 20,
      }),
    ).toBeNull()
  })

  it('formats notes in the preferred unit', () => {
    expect(
      buildEquipmentLoadNote({
        barWeightKg: 20,
        equipment: 'Barra',
        loadMode: 'split',
        unit: 'lb',
        weightKg: 40,
      }),
    ).toBe('Discos: 44.1 lb por lado - Total con barra: 132.3 lb')
  })
})
