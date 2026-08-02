import { describe, expect, it } from 'vitest'
import {
  buildEquipmentLoadNote,
  defaultLoadSettingsForEquipment,
  loadSettingsForEquipment,
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

  it('builds a barbell note from disk weight', () => {
    expect(
      buildEquipmentLoadNote({
        barWeightKg: 20,
        equipment: 'Barra',
        loadMode: 'split',
        unit: 'kg',
        weightKg: 40,
      }),
    ).toBe('Discos por lado: 20 kg · Total con barra: 60 kg')
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
    ).toBe('Discos por lado: 44.1 lb · Total con barra: 132.3 lb')
  })
})
