import { describe, expect, it } from 'vitest'
import { getBundledExerciseAsset } from '../../../shared/assets/exerciseImages'
import {
  SINFUL_SHELL_SCHEMA_VERSION,
  getSinfulShellExerciseById,
  isSinfulShellTechnicalNotes,
  searchSinfulShellExercises,
  sinfulShellCatalog,
  validateSinfulShellCatalog,
} from './sinfulShellCatalog'

describe('sinfulShellCatalog', () => {
  it('contains the approved V1 manifest shape', () => {
    expect(SINFUL_SHELL_SCHEMA_VERSION).toBe(1)
    expect(sinfulShellCatalog).toHaveLength(74)

    for (const exercise of sinfulShellCatalog) {
      expect(Object.keys(exercise).sort()).toEqual([
        'aliases',
        'bundledAssetId',
        'canonicalName',
        'id',
        'mainMuscle',
        'name',
        'technicalNotes',
      ])
      expect(exercise.id).toMatch(/^sinful-shell-/)
      expect(exercise.name.trim()).toBe(exercise.name)
      expect(exercise.canonicalName.trim()).toBe(exercise.canonicalName)
      expect(exercise.aliases.every((alias) => alias.trim().length > 0)).toBe(true)
      expect(isSinfulShellTechnicalNotes(exercise.technicalNotes)).toBe(true)
      expect(getBundledExerciseAsset(exercise.bundledAssetId)).not.toBeNull()
    }
  })

  it('has no manifest validation errors', () => {
    expect(validateSinfulShellCatalog()).toEqual([])
  })

  it('finds an exercise by id', () => {
    expect(getSinfulShellExerciseById('sinful-shell-press-inclinado')?.name).toBe('Press inclinado')
    expect(getSinfulShellExerciseById('missing')).toBeNull()
  })

  it('searches by aliases and filters by muscle', () => {
    expect(searchSinfulShellExercises({ query: 'lat pulldown' }).map((exercise) => exercise.id)).toContain(
      'sinful-shell-jalon-al-pecho',
    )
    expect(searchSinfulShellExercises({ query: 'curl', muscle: 'Brazos' }).every((exercise) => exercise.mainMuscle === 'Brazos')).toBe(
      true,
    )
    expect(searchSinfulShellExercises({ query: 'curl', muscle: 'Pecho' })).toEqual([])
  })
})
