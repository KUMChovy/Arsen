import { describe, expect, it } from 'vitest'
import { formatRestSeconds } from './time'

describe('time utils', () => {
  it('formats configured rest seconds for display', () => {
    expect(formatRestSeconds(45)).toBe('45 seg')
    expect(formatRestSeconds(60)).toBe('1:00 min')
    expect(formatRestSeconds(90)).toBe('1:30 min')
    expect(formatRestSeconds(125)).toBe('2:05 min')
  })

  it('shows a clear placeholder for missing or unset rest', () => {
    expect(formatRestSeconds(0)).toBe('—')
    expect(formatRestSeconds(undefined)).toBe('—')
    expect(formatRestSeconds(null)).toBe('—')
    expect(formatRestSeconds(Number.NaN)).toBe('—')
  })
})
