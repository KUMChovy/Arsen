import { weeksSince } from './workout'

export const DELOAD_SUGGESTION_MIN_WEEKS = 5
export const DELOAD_SUGGESTION_MAX_WEEKS = 7
export const DELOAD_LENGTH_DAYS = 7
export const DELOAD_SKIP_COOLDOWN_DAYS = 14
export const DELOAD_SERIES_PERCENT_MIN = 40
export const DELOAD_SERIES_PERCENT_MAX = 60
export const DELOAD_WEIGHT_PERCENT_MIN = 70
export const DELOAD_WEIGHT_PERCENT_MAX = 90
export const DEFAULT_DELOAD_SERIES_PERCENT = 50
export const DEFAULT_DELOAD_WEIGHT_PERCENT = 80

export function normalizeDeloadSeriesPercent(value: unknown) {
  return clampPercent(value, DEFAULT_DELOAD_SERIES_PERCENT, DELOAD_SERIES_PERCENT_MIN, DELOAD_SERIES_PERCENT_MAX)
}

export function normalizeDeloadWeightPercent(value: unknown) {
  return clampPercent(value, DEFAULT_DELOAD_WEIGHT_PERCENT, DELOAD_WEIGHT_PERCENT_MIN, DELOAD_WEIGHT_PERCENT_MAX)
}

export function getDeloadTargetSets(targetSets: number, seriesPercent: number) {
  const normalizedTarget = Number.isFinite(targetSets) ? targetSets : 0

  return Math.max(1, Math.round((normalizedTarget * normalizeDeloadSeriesPercent(seriesPercent)) / 100))
}

export function getDeloadSuggestedWeightKg(currentWeightKg: number, weightPercent: number) {
  if (!Number.isFinite(currentWeightKg) || currentWeightKg <= 0) return 0

  return (currentWeightKg * normalizeDeloadWeightPercent(weightPercent)) / 100
}

export function isDeloadSuggestionWindow(anchorDate: string | null, currentDate: string) {
  if (!anchorDate) return false
  const weeks = weeksSince(anchorDate, currentDate)

  return weeks >= DELOAD_SUGGESTION_MIN_WEEKS && weeks <= DELOAD_SUGGESTION_MAX_WEEKS
}

export function addDays(date: string, days: number) {
  const parsed = new Date(`${date}T00:00:00`)
  parsed.setDate(parsed.getDate() + days)

  return parsed.toISOString().slice(0, 10)
}

export function isDeloadComplete(startedAt: string, currentDate: string) {
  return currentDate >= addDays(startedAt, DELOAD_LENGTH_DAYS)
}

export function daysRemainingInDeload(startedAt: string, currentDate: string) {
  const endDate = addDays(startedAt, DELOAD_LENGTH_DAYS)
  const end = new Date(`${endDate}T00:00:00`).getTime()
  const current = new Date(`${currentDate}T00:00:00`).getTime()
  if (Number.isNaN(end) || Number.isNaN(current) || current >= end) return 0

  return Math.ceil((end - current) / (24 * 60 * 60 * 1000))
}

function clampPercent(value: unknown, fallback: number, min: number, max: number) {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback

  return Math.min(max, Math.max(min, Math.round(numeric)))
}