import type { Equipment, RoutineExercise } from '../../domains/routine/types'
import type { SetLog } from '../../domains/workout/types'

export type ProgressionSession = {
  date: string
  sets: Pick<SetLog, 'kind' | 'order' | 'reps' | 'rir' | 'weightKg'>[]
}

export type WeightIncreaseRecommendation = {
  currentWeightKg: number
  evidence: Array<{
    date: string
    topSetLabel: string
  }>
  exerciseId: string
  exerciseName: string
  reason: string
  suggestedIncreaseLabel: string
}

export function getWeightIncreaseRecommendation(
  exercise: RoutineExercise,
  sessions: ProgressionSession[],
): WeightIncreaseRecommendation | null {
  const repTarget = exercise.repsMax
  const rirTarget = parseRirTarget(exercise.recommendedRir)
  if (!Number.isFinite(repTarget) || repTarget <= 0 || rirTarget === null || exercise.targetSets <= 0) return null

  const recent = sessions
    .map((session) => ({
      date: session.date,
      sets: session.sets
        .filter((set) => set.kind === 'main')
        .sort((a, b) => a.order - b.order)
        .slice(0, exercise.targetSets),
    }))
    .filter((session) => session.sets.length >= exercise.targetSets)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 2)

  if (recent.length < 2) return null
  if (!recent.every((session) => session.sets.every((set) => set.reps >= repTarget && set.rir >= rirTarget))) return null

  const latestWeight = Math.max(...recent[0]!.sets.map((set) => set.weightKg))

  return {
    currentWeightKg: latestWeight,
    evidence: recent.map((session) => ({
      date: session.date,
      topSetLabel: bestProgressionSetLabel(session.sets),
    })),
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    reason: `Ultimas 2 sesiones con ${repTarget}+ reps y RIR ${rirTarget}+`,
    suggestedIncreaseLabel: suggestedIncreaseLabel(exercise.equipment),
  }
}

function parseRirTarget(recommendedRir: string) {
  const numbers = recommendedRir.match(/\d+/g)?.map(Number).filter(Number.isFinite) ?? []
  if (numbers.length === 0) return null

  return Math.max(...numbers)
}

function bestProgressionSetLabel(sets: ProgressionSession['sets']) {
  const best = sets.reduce((current, candidate) => {
    const currentScore = current.weightKg * (1 + current.reps / 30)
    const candidateScore = candidate.weightKg * (1 + candidate.reps / 30)

    return candidateScore > currentScore ? candidate : current
  }, sets[0]!)

  return `${best.weightKg} kg x ${best.reps} reps, RIR ${best.rir}`
}

function suggestedIncreaseLabel(equipment: Equipment) {
  if (equipment === 'Barra' || equipment === 'Maquina') return '+2.5 kg'
  if (equipment === 'Mancuerna' || equipment === 'Polea') return '+1 a +2 kg'
  if (equipment === 'Peso corporal') return 'mas reps, control o carga externa'

  return 'subida pequena controlada'
}
