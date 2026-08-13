export function formatRestSeconds(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return '—'

  const totalSeconds = Math.floor(seconds)
  if (totalSeconds < 60) return `${totalSeconds} seg`

  const minutes = Math.floor(totalSeconds / 60)
  const remainder = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${remainder} min`
}
