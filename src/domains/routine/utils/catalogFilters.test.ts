import { describe, expect, it } from 'vitest'
import type { ExerciseCatalogItem } from '../types'
import { filterCatalogByQueryAndMuscle } from './catalogFilters'

describe('filterCatalogByQueryAndMuscle', () => {
  it('returns all catalog items in stable order for Todos and empty query', () => {
    const catalog = [item('press', 'Press plano', 'Pecho'), item('remo', 'Remo T', 'Espalda')]

    expect(filterCatalogByQueryAndMuscle(catalog, '', 'Todos').map((exercise) => exercise.id)).toEqual(['press', 'remo'])
  })

  it('filters by normalized muscle', () => {
    const catalog = [item('pectoral', 'Aperturas', 'Pectoral mayor'), item('remo', 'Remo T', 'Espalda')]

    expect(filterCatalogByQueryAndMuscle(catalog, '', 'Pecho').map((exercise) => exercise.id)).toEqual(['pectoral'])
  })

  it('matches name and aliases without accent or case sensitivity', () => {
    const catalog = [
      item('lateral', 'Elevaci\u00f3n lateral', 'Hombros', ['laterales con mancuerna']),
      item('remo', 'Remo T', 'Espalda'),
    ]

    expect(filterCatalogByQueryAndMuscle(catalog, 'ELEVACION', 'Todos').map((exercise) => exercise.id)).toEqual(['lateral'])
    expect(filterCatalogByQueryAndMuscle(catalog, 'mancuerna', 'Todos').map((exercise) => exercise.id)).toEqual(['lateral'])
  })

  it('preserves existing matches by muscle and equipment', () => {
    const catalog = [item('press', 'Press plano', 'Pecho'), item('sentadilla', 'Sentadilla', 'Piernas')]

    expect(filterCatalogByQueryAndMuscle(catalog, 'pecho', 'Todos').map((exercise) => exercise.id)).toEqual(['press'])
    expect(filterCatalogByQueryAndMuscle(catalog, 'barra', 'Todos').map((exercise) => exercise.id)).toEqual(['press', 'sentadilla'])
  })

  it('combines query with selected muscle', () => {
    const catalog = [
      item('press', 'Press plano', 'Pecho', ['banca']),
      item('fondos', 'Fondos', 'Brazos', ['banca']),
      item('remo', 'Remo T', 'Espalda'),
    ]

    expect(filterCatalogByQueryAndMuscle(catalog, 'banca', 'Pecho').map((exercise) => exercise.id)).toEqual(['press'])
  })
})

function item(id: string, name: string, mainMuscle: string, aliases: string[] = []): ExerciseCatalogItem {
  return {
    aliases,
    assetKind: null,
    barWeightKg: 20,
    bundledAssetId: null,
    canonicalName: id,
    createdAt: '2026-08-11T00:00:00.000Z',
    customAssetId: null,
    defaultRecommendedRir: 2,
    defaultRepsMax: 10,
    defaultRepsMin: 8,
    defaultRestSeconds: 90,
    defaultTargetSets: 3,
    equipment: 'Barra',
    id,
    loadMode: 'single',
    mainMuscle,
    name,
    technicalNotes: '',
    updatedAt: '2026-08-11T00:00:00.000Z',
    warmupProtocol: 'none',
  }
}
