import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DELOAD_SERIES_PERCENT,
  DEFAULT_DELOAD_WEIGHT_PERCENT,
  addDays,
  daysRemainingInDeload,
  getDeloadSuggestedWeightKg,
  getDeloadTargetSets,
  isDeloadComplete,
  isDeloadSuggestionWindow,
  normalizeDeloadSeriesPercent,
  normalizeDeloadWeightPercent,
} from './deload'

describe('deload calculations', () => {
  it('normalizes reduction percentages into configured ranges', () => {
    expect(DEFAULT_DELOAD_SERIES_PERCENT).toBe(50)
    expect(DEFAULT_DELOAD_WEIGHT_PERCENT).toBe(80)
    expect(normalizeDeloadSeriesPercent(undefined)).toBe(50)
    expect(normalizeDeloadSeriesPercent(39)).toBe(40)
    expect(normalizeDeloadSeriesPercent(61)).toBe(60)
    expect(normalizeDeloadWeightPercent(undefined)).toBe(80)
    expect(normalizeDeloadWeightPercent(69)).toBe(70)
    expect(normalizeDeloadWeightPercent(91)).toBe(90)
  })

  it('reduces target sets with a minimum of one set', () => {
    expect(getDeloadTargetSets(5, 50)).toBe(3)
    expect(getDeloadTargetSets(3, 40)).toBe(1)
    expect(getDeloadTargetSets(1, 40)).toBe(1)
    expect(getDeloadTargetSets(0, 50)).toBe(1)
  })

  it('reduces suggested weight without inventing load', () => {
    expect(getDeloadSuggestedWeightKg(100, 80)).toBe(80)
    expect(getDeloadSuggestedWeightKg(62.5, 80)).toBe(50)
    expect(getDeloadSuggestedWeightKg(0, 80)).toBe(0)
    expect(getDeloadSuggestedWeightKg(-10, 80)).toBe(0)
  })

  it('detects suggestion window between weeks five and seven', () => {
    expect(isDeloadSuggestionWindow(null, '2026-02-12')).toBe(false)
    expect(isDeloadSuggestionWindow('2026-01-01', '2026-01-29')).toBe(false)
    expect(isDeloadSuggestionWindow('2026-01-01', '2026-02-05')).toBe(true)
    expect(isDeloadSuggestionWindow('2026-01-01', '2026-02-19')).toBe(true)
    expect(isDeloadSuggestionWindow('2026-01-01', '2026-02-26')).toBe(false)
  })

  it('handles seven-day active deload windows', () => {
    expect(addDays('2026-02-01', 7)).toBe('2026-02-08')
    expect(daysRemainingInDeload('2026-02-01', '2026-02-01')).toBe(7)
    expect(daysRemainingInDeload('2026-02-01', '2026-02-07')).toBe(1)
    expect(daysRemainingInDeload('2026-02-01', '2026-02-08')).toBe(0)
    expect(isDeloadComplete('2026-02-01', '2026-02-07')).toBe(false)
    expect(isDeloadComplete('2026-02-01', '2026-02-08')).toBe(true)
  })
})