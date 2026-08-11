import { describe, expect, it } from 'vitest'
import {
  bundledAssetIdForExercise,
  bundledExerciseAssets,
  bundledMuscleAssets,
  getBundledExerciseAsset,
  getMuscleAsset,
  validateBundledAssetRegistry,
} from './exerciseImages'

describe('bundled exercise image registry', () => {
  it('contains valid exercise files and all muscle fallbacks', () => {
    expect(validateBundledAssetRegistry()).toEqual([])
    expect(Object.keys(bundledMuscleAssets).sort()).toEqual(['Abdomen', 'Brazos', 'Espalda', 'Hombros', 'Pecho', 'Piernas'])
    expect(bundledExerciseAssets.length).toBeGreaterThan(0)
  })

  it('uses the full filename slug as stable bundledAssetId', () => {
    expect(getBundledExerciseAsset('press-inclinado--pecho')).toMatchObject({
      id: 'press-inclinado--pecho',
      muscle: 'Pecho',
      name: 'Press inclinado',
    })
  })

  it('resolves exercise names and muscles to bundled IDs without using the old sprite kinds', () => {
    expect(bundledAssetIdForExercise('Press inclinado', 'Pecho')).toBe('press-inclinado--pecho')
    expect(bundledAssetIdForExercise('Ejercicio sin imagen', 'Pecho')).toBeNull()
  })

  it('resolves muscle fallback assets from local PNGs', () => {
    expect(getMuscleAsset('Piernas')).toContain('/src/assets/musculos/piernas.png')
    expect(getMuscleAsset('musculo raro')).toContain('/src/assets/musculos/pecho.png')
    expect(getMuscleAsset(null)).toBeNull()
  })
})
