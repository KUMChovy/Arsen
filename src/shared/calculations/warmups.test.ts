import { describe, expect, it } from 'vitest'
import { buildWarmupSets, normalizeWarmupProtocol, warmupProtocolLabel } from './warmups'

describe('warmups', () => {
  it('normalizes known and legacy protocol values', () => {
    expect(normalizeWarmupProtocol('')).toBe('none')
    expect(normalizeWarmupProtocol('Hipertrofia')).toBe('hypertrophy')
    expect(normalizeWarmupProtocol('fuerza maxima')).toBe('strength')
    expect(normalizeWarmupProtocol('Progresivo')).toBe('progressive')
    expect(normalizeWarmupProtocol('Pesado bajo volumen')).toBe('heavy_low_volume')
    expect(normalizeWarmupProtocol('custom')).toBe('none')
  })

  it('builds hypertrophy warmups from working weight', () => {
    expect(buildWarmupSets(100, 'hypertrophy')).toEqual([
      { percentage: 0.5, reps: 10, rir: 4, weightKg: 50 },
      { percentage: 0.7, reps: 5, rir: 3, weightKg: 70 },
    ])
  })

  it('builds every approved protocol', () => {
    expect(buildWarmupSets(80, 'none')).toHaveLength(0)
    expect(buildWarmupSets(80, 'strength').map((set) => set.weightKg)).toEqual([40, 56, 68])
    expect(buildWarmupSets(80, 'progressive').map((set) => set.weightKg)).toEqual([32, 64])
    expect(buildWarmupSets(80, 'heavy_low_volume').map((set) => set.weightKg)).toEqual([64])
    expect(warmupProtocolLabel('heavy_low_volume')).toBe('Pesado bajo volumen')
  })
})
