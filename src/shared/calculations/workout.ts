import type { DropSetLog, ExerciseState, SetLog } from '../../domains/workout/types'

type VolumeSet = Pick<SetLog | DropSetLog, 'reps' | 'weightKg'>

export function volumeForSet(set: VolumeSet) {
  return set.weightKg * set.reps
}

export function performanceScore(set: VolumeSet) {
  return set.weightKg * (1 + set.reps / 30)
}

export function totalVolume(mainSets: VolumeSet[], dropSets: VolumeSet[] = []) {
  return [...mainSets, ...dropSets].reduce((total, set) => total + volumeForSet(set), 0)
}

export function bestSet<TSet extends VolumeSet>(sets: TSet[]) {
  if (sets.length === 0) return null

  let best = sets[0]!
  let bestScore = performanceScore(best)
  for (let index = 1; index < sets.length; index += 1) {
    const candidate = sets[index]!
    const candidateScore = performanceScore(candidate)
    if (candidateScore > bestScore) {
      best = candidate
      bestScore = candidateScore
    }
  }

  return best
}

export function exerciseStateFromSets(mainSetCount: number, targetSets: number, skipped: boolean): ExerciseState {
  if (skipped) return 'skipped'
  if (mainSetCount <= 0) return 'pending'
  if (mainSetCount >= targetSets) return 'done'

  return 'in_progress'
}

export function average(values: number[]) {
  if (values.length === 0) return 0

  return values.reduce((total, value) => total + value, 0) / values.length
}

export function weeksSince(firstDate: string, currentDate: string) {
  const first = new Date(`${firstDate}T00:00:00`).getTime()
  const current = new Date(`${currentDate}T00:00:00`).getTime()
  if (Number.isNaN(first) || Number.isNaN(current) || current < first) return 0

  return Math.floor((current - first) / (7 * 24 * 60 * 60 * 1000))
}

export function shouldNotifyDeload(firstLogDate: string | null, currentDate: string) {
  if (!firstLogDate) return false
  const weeks = weeksSince(firstLogDate, currentDate)

  return weeks >= 5 && weeks <= 7
}
