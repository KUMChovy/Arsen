import { ArrowLeft, ChevronDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { WeightIncreaseRecommendation } from '../../../shared/calculations/progression'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'
import { formatRepRange } from '../../../shared/utils/reps'
import { formatWeight } from '../../../shared/utils/weight'
import { normalizeWarmupProtocol, warmupProtocolLabel } from '../../../shared/calculations/warmups'
import { useWeightIncreaseRecommendations } from '../../workout/hooks'
import { useRoutineDayDetail } from '../hooks'
import type { RoutineExercise } from '../types'
import { dominantMuscleForExercises } from '../utils/dominantMuscle'

export function RoutineDayDetailPage() {
  const { dayId } = useParams()
  const detail = useRoutineDayDetail(dayId ?? null)
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null)
  const exercises = detail?.exercises ?? []
  const recommendationByExerciseId = new Map(useWeightIncreaseRecommendations(exercises).map((recommendation) => [recommendation.exerciseId, recommendation]))
  const dominantMuscle = dominantMuscleForExercises(exercises)

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={detail?.routine?.name ?? 'Rutina'} title={detail?.day.name ?? 'Detalle del dia'}>
        <Link className="grid size-10 place-items-center rounded-[10px] text-arsen-purple2" to="/rutina">
          <ArrowLeft aria-hidden="true" className="size-5" />
          <span className="sr-only">Volver a rutina</span>
        </Link>
      </PageHeader>

      <Card className="p-3">
        <div className="flex items-center gap-3">
          <ExerciseArt alt={dominantMuscle} className="size-16" muscle={dominantMuscle} />
          <div className="min-w-0">
            <h2 className="text-xl font-black">{detail?.day.name ?? 'Cargando dia'}</h2>
            <p className="mt-1 text-sm font-semibold text-arsen-muted">{detail?.day.description || 'Sin descripcion'}</p>
            <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-arsen-purple/30 px-2 py-1 text-arsen-purple2">Dominante: {dominantMuscle}</span>
              <span className="rounded-full bg-white/10 px-2 py-1 text-arsen-muted">{exercises.length} ejercicios</span>
            </div>
          </div>
        </div>
      </Card>

      <section className="space-y-2">
        <div className="text-xs font-extrabold text-arsen-muted">Ejercicios</div>
        {exercises.map((exercise) => (
          <ExerciseDetailCard
            expanded={expandedExerciseId === exercise.id}
            exercise={exercise}
            key={exercise.id}
            onToggle={() => setExpandedExerciseId((current) => (current === exercise.id ? null : exercise.id))}
            recommendation={recommendationByExerciseId.get(exercise.id) ?? null}
          />
        ))}
        {detail && exercises.length === 0 ? <Card className="p-4 text-sm text-arsen-muted">Este dia aun no tiene ejercicios.</Card> : null}
      </section>
    </div>
  )
}

function ExerciseDetailCard({
  expanded,
  exercise,
  onToggle,
  recommendation,
}: {
  expanded: boolean
  exercise: RoutineExercise
  onToggle: () => void
  recommendation: WeightIncreaseRecommendation | null
}) {
  const protocol = normalizeWarmupProtocol(exercise.warmupProtocol)

  return (
    <button className="block w-full text-left" onClick={onToggle} type="button">
      <Card className="p-3">
        <div className="grid grid-cols-[52px_1fr_auto] items-center gap-3">
          <ExerciseArt alt={exercise.name} className="size-[52px]" muscle={exercise.mainMuscle} />
          <div className="min-w-0">
            <strong className="block truncate text-sm">{exercise.name}</strong>
            <span className="mt-1 block truncate text-xs text-arsen-muted">
              {exercise.mainMuscle} - {exercise.equipment} - {exercise.targetSets}x{formatRepRange(exercise.repsMin, exercise.repsMax)} - RIR {exercise.recommendedRir}
            </span>
            {recommendation ? (
              <span className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-arsen-acid/15 px-2 py-1 text-[10px] font-extrabold text-arsen-acid">
                <TrendingUp aria-hidden="true" className="size-3 shrink-0" />
                <span className="truncate">Listo para subir peso: {recommendation.suggestedIncreaseLabel}</span>
              </span>
            ) : null}
          </div>
          <ChevronDown
            aria-hidden="true"
            className={['size-5 text-arsen-muted transition-transform', expanded ? 'rotate-180' : ''].join(' ')}
          />
        </div>

        {expanded ? (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <DetailMetric label="Descanso" value={`${exercise.restSeconds} seg`} />
            <DetailMetric label="Calentamiento" value={warmupProtocolLabel(protocol)} />
            <DetailMetric label="Ultimo peso" value={formatWeight(exercise.currentWeightKg, 'kg')} />
            <DetailMetric label="Orden" value={String(exercise.order + 1)} />
            {exercise.progression ? <DetailText label="Progresion" value={exercise.progression} /> : null}
            {exercise.technicalNotes ? <DetailText label="Notas tecnicas" value={exercise.technicalNotes} /> : null}
          </div>
        ) : null}
      </Card>
    </button>
  )
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-white/10 bg-arsen-bg/55 p-2">
      <span className="block text-[10px] font-bold text-arsen-muted">{label}</span>
      <strong className="mt-1 block text-sm text-arsen-ink">{value}</strong>
    </div>
  )
}

function DetailText({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-span-2 rounded-[10px] border border-white/10 bg-arsen-bg/55 p-2">
      <span className="block text-[10px] font-bold text-arsen-muted">{label}</span>
      <p className="mt-1 text-xs font-semibold text-arsen-ink">{value}</p>
    </div>
  )
}
