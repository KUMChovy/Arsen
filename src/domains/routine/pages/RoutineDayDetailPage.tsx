import { ArrowLeft, ChevronDown, Info, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { WeightIncreaseRecommendation } from '../../../shared/calculations/progression'
import { normalizeEquipment } from '../../../shared/calculations/equipmentLoad'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'
import { formatRepRange } from '../../../shared/utils/reps'
import { formatWeight } from '../../../shared/utils/weight'
import { normalizeWarmupProtocol, warmupProtocolLabel } from '../../../shared/calculations/warmups'
import { useWeightIncreaseRecommendations } from '../../workout/hooks'
import { WarmupProtocolInfoSheet } from '../components/WarmupProtocolInfoSheet'
import { useExerciseAssets, useRoutineDayDetail } from '../hooks'
import type { RoutineExercise } from '../types'
import { dominantMuscleForExercises } from '../utils/dominantMuscle'

export function RoutineDayDetailPage() {
  const { dayId } = useParams()
  const detail = useRoutineDayDetail(dayId ?? null)
  const exerciseAssets = useExerciseAssets() ?? []
  const imageSrcByAssetId = useMemo(() => new Map(exerciseAssets.map((asset) => [asset.id, asset.dataUrl])), [exerciseAssets])
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
        <div className="flex items-center gap-4">
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
            imageSrcByAssetId={imageSrcByAssetId}
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
  imageSrcByAssetId,
  onToggle,
  recommendation,
}: {
  expanded: boolean
  exercise: RoutineExercise
  imageSrcByAssetId: Map<string, string>
  onToggle: () => void
  recommendation: WeightIncreaseRecommendation | null
}) {
  const protocol = normalizeWarmupProtocol(exercise.warmupProtocol)
  const [warmupInfoOpen, setWarmupInfoOpen] = useState(false)

  return (
    <div className="block w-full text-left">
      <Card className="p-3">
        <button className="grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-4 text-left" onClick={onToggle} type="button">
          <ExerciseArt
            alt={exercise.name}
            assetKind={exercise.assetKind}
            className="size-[52px]"
            customImageSrc={exercise.customAssetId ? imageSrcByAssetId.get(exercise.customAssetId) : null}
            muscle={exercise.mainMuscle}
          />
          <div className="min-w-0">
            <strong className="block truncate text-sm">{exercise.name}</strong>
            <span className="mt-1 block truncate text-xs text-arsen-muted">
              {exercise.mainMuscle} - {normalizeEquipment(exercise.equipment)} - {exercise.targetSets}x{formatRepRange(exercise.repsMin, exercise.repsMax)} - RIR {exercise.recommendedRir}
            </span>
            {recommendation ? (
              <span className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-arsen-acid/15 px-2 py-1 text-xs font-extrabold text-arsen-acid">
                <TrendingUp aria-hidden="true" className="size-3 shrink-0" />
                <span className="truncate">Listo para subir peso: {recommendation.suggestedIncreaseLabel}</span>
              </span>
            ) : null}
          </div>
          <ChevronDown
            aria-hidden="true"
            className={['size-5 text-arsen-muted transition-transform', expanded ? 'rotate-180' : ''].join(' ')}
          />
        </button>

        {expanded ? (
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <DetailMetric label="Descanso" value={`${exercise.restSeconds} seg`} />
            <button
              aria-label="Ver descripcion del calentamiento"
              className="rounded-[10px] border border-white/10 bg-arsen-bg/55 p-2 text-left"
              onClick={() => setWarmupInfoOpen(true)}
              type="button"
            >
              <span className="block text-xs font-bold text-arsen-muted">Calentamiento</span>
              <span className="mt-1 flex items-center justify-between gap-2">
                <strong className="block min-w-0 truncate text-sm text-arsen-ink">{warmupProtocolLabel(protocol)}</strong>
                <Info aria-hidden="true" className="size-4 shrink-0 text-arsen-purple2" />
              </span>
            </button>
            <DetailMetric label="Ultimo peso" value={formatWeight(exercise.currentWeightKg, 'kg')} />
            <DetailMetric label="Orden" value={String(exercise.order + 1)} />
            {exercise.technicalNotes ? <DetailText label="Notas tecnicas" value={exercise.technicalNotes} /> : null}
          </div>
        ) : null}
      </Card>
      {warmupInfoOpen ? <WarmupProtocolInfoSheet onClose={() => setWarmupInfoOpen(false)} protocol={protocol} /> : null}
    </div>
  )
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-white/10 bg-arsen-bg/55 p-2">
      <span className="block text-xs font-bold text-arsen-muted">{label}</span>
      <strong className="mt-1 block text-sm text-arsen-ink">{value}</strong>
    </div>
  )
}

function DetailText({ label, value }: { label: string; value: string }) {
  return (
    <div className="col-span-2 rounded-[10px] border border-white/10 bg-arsen-bg/55 p-2">
      <span className="block text-xs font-bold text-arsen-muted">{label}</span>
      <p className="mt-1 text-xs font-semibold text-arsen-ink">{value}</p>
    </div>
  )
}
