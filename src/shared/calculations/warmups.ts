export type WarmupProtocol = 'none' | 'hypertrophy' | 'strength' | 'progressive' | 'heavy_low_volume'

export type WarmupSet = {
  percentage: number
  reps: number
  rir: number
  weightKg: number
}

const protocols: Record<WarmupProtocol, Array<Omit<WarmupSet, 'weightKg'>>> = {
  none: [],
  hypertrophy: [
    { percentage: 0.5, reps: 10, rir: 4 },
    { percentage: 0.7, reps: 5, rir: 3 },
  ],
  strength: [
    { percentage: 0.5, reps: 8, rir: 4 },
    { percentage: 0.7, reps: 3, rir: 3 },
    { percentage: 0.85, reps: 1, rir: 2 },
  ],
  progressive: [
    { percentage: 0.4, reps: 6, rir: 4 },
    { percentage: 0.8, reps: 6, rir: 2 },
  ],
  heavy_low_volume: [{ percentage: 0.8, reps: 5, rir: 2 }],
}

export function normalizeWarmupProtocol(value: string | null | undefined): WarmupProtocol {
  const normalized = (value ?? '').trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_')
  if (!normalized || normalized === 'ninguno' || normalized === 'none') return 'none'
  if (normalized === 'hypertrophy' || normalized.includes('hipertrofia')) return 'hypertrophy'
  if (normalized === 'strength' || normalized.includes('fuerza')) return 'strength'
  if (normalized === 'progressive' || normalized.includes('progres')) return 'progressive'
  if (normalized === 'heavy_low_volume' || normalized.includes('pesado')) return 'heavy_low_volume'

  return 'none'
}

export function warmupProtocolLabel(protocol: WarmupProtocol) {
  const labels: Record<WarmupProtocol, string> = {
    heavy_low_volume: 'Pesado bajo volumen',
    hypertrophy: 'Hipertrofia',
    none: 'Ninguno',
    progressive: 'Progresivo',
    strength: 'Fuerza',
  }

  return labels[protocol]
}

export function buildWarmupSets(workingWeightKg: number, protocolValue: string | null | undefined): WarmupSet[] {
  if (workingWeightKg <= 0) return []

  const protocol = normalizeWarmupProtocol(protocolValue)

  return protocols[protocol].map((set) => ({
    ...set,
    weightKg: roundToHalf(workingWeightKg * set.percentage),
  }))
}

function roundToHalf(value: number) {
  return Math.round(value * 2) / 2
}
