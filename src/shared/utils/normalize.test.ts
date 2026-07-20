import { describe, expect, it } from 'vitest'
import { canonicalName } from './normalize'

describe('canonicalName', () => {
  it('normaliza acentos, mayúsculas y espacios', () => {
    expect(canonicalName('Press inclinado')).toBe('press-inclinado')
    expect(canonicalName('Jalón al pecho')).toBe('jalon-al-pecho')
  })

  it('mantiene estable el mismo ejercicio entre rutinas', () => {
    expect(canonicalName('Pec deck o cruces de polea')).toBe('pec-deck-o-cruces-de-polea')
    expect(canonicalName('Pec deck  o   cruces de polea')).toBe('pec-deck-o-cruces-de-polea')
  })
})
