import { ArrowRightLeft, ChevronDown, Flame, Layers3, Pencil, Plus, Trash2, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt } from '../../../shared/components/ExerciseArt'
import { formatWeight } from '../../../shared/utils/weight'
import { canonicalName } from '../../../shared/utils/normalize'
import type { SessionExerciseDetail } from '../repository'

type SessionSet = SessionExerciseDetail['sets'][number]
type SessionDrop = SessionSet['dropSets'][number]

export function SessionExerciseCard({
  exercise,
  expanded,
  saving,
  unit,
  onAddDrop,
  onEditDrop,
  onEditSet,
  onMoveSet,
  onRemove,
  onRemoveDrop,
  onRemoveSet,
  onToggle,
}: {
  exercise: SessionExerciseDetail
  expanded: boolean
  saving: boolean
  unit: 'kg' | 'lb'
  onAddDrop: (setId: string) => void
  onEditDrop: (drop: SessionDrop) => void
  onEditSet: (set: SessionSet) => void
  onMoveSet: (set: SessionSet) => void
  onRemove: () => void
  onRemoveDrop: (dropId: string) => void
  onRemoveSet: (setId: string) => void
  onToggle: () => void
}) {
  const exerciseVolumeKg = exercise.sets.reduce((total, set) => total + set.weightKg * set.reps + set.dropSets.reduce((dropTotal, drop) => dropTotal + drop.weightKg * drop.reps, 0), 0)
  const bestSet = exercise.sets.reduce<SessionSet | null>((best, set) => !best || set.weightKg > best.weightKg ? set : best, null)
  const exerciseCanonicalName = exercise.canonicalName ?? canonicalName(exercise.exerciseName)

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-arsen-purple/10 p-3">
        <div className="flex items-center gap-3">
          <ExerciseArt alt={exercise.exerciseName} assetKind={exercise.assetKind} bundledAssetId={exercise.bundledAssetId} className="size-14" muscle={exercise.mainMuscle} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-black">{exercise.exerciseName}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-arsen-muted">
              <span className="inline-flex items-center gap-1"><Layers3 aria-hidden="true" className="size-3.5 text-arsen-purple2" />{exercise.sets.length} series</span>
              <span className="truncate">{exercise.mainMuscle || 'Músculo no disponible'}</span>
            </div>
          </div>
          <button aria-expanded={expanded} aria-label={(expanded ? 'Contraer ' : 'Expandir ') + exercise.exerciseName} className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-white/10 bg-arsen-surface text-arsen-purple2" onClick={onToggle} type="button">
            <ChevronDown aria-hidden="true" className={['size-4 transition-transform', expanded ? 'rotate-180' : ''].join(' ')} />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-white/10 bg-arsen-bg/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-arsen-muted"><TrendingUp aria-hidden="true" className="size-4 text-arsen-acid" />Resumen del ejercicio</p>
              <p className="mt-1 text-xs text-arsen-dim">Trabajo registrado en esta sesión</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Link aria-label={'Ver progreso de ' + exercise.exerciseName} className="grid size-10 place-items-center rounded-[10px] border border-white/10 bg-arsen-surface text-arsen-purple2" title="Ver progreso" to={'/progreso/ejercicio/' + encodeURIComponent(exerciseCanonicalName)}>
                <TrendingUp aria-hidden="true" className="size-4" />
              </Link>
              <button aria-label={'Eliminar ' + exercise.exerciseName} className="grid size-10 place-items-center rounded-[10px] border border-red-300/25 bg-red-300/5 text-red-300" disabled={saving} onClick={onRemove} title="Eliminar ejercicio" type="button">
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Metric label={'Volumen (' + unit + ')'} value={formatWeight(exerciseVolumeKg, unit)} />
            <Metric label="Mejor serie" value={bestSet ? formatWeight(bestSet.weightKg, unit) + ' x ' + bestSet.reps : 'Sin datos'} />
          </div>

          {exercise.notes ? <p className="text-sm text-arsen-muted">{exercise.notes}</p> : null}

          {(exercise.warmupSets ?? []).length > 0 ? <div className="space-y-2">
            <h4 className="text-sm font-black">Calentamientos</h4>
            {exercise.warmupSets?.map((set) => <div className="flex items-center gap-2 rounded-[10px] border border-white/10 p-2" key={set.id}>
              <span className="min-w-0 flex-1 text-sm">Calentamiento {set.order + 1} · {formatWeight(set.weightKg, unit)} × {set.reps} · RIR {set.rir}</span>
              <button aria-label={`Editar calentamiento ${set.order + 1}`} className="min-h-12 min-w-12 text-arsen-purple2" disabled={saving} onClick={() => onEditSet({ ...set, dropSets: [] })} type="button"><Pencil aria-hidden="true" className="mx-auto size-4" /></button>
              <button aria-label={`Eliminar calentamiento ${set.order + 1}`} className="min-h-12 min-w-12 text-red-300" disabled={saving} onClick={() => onRemoveSet(set.id)} type="button"><Trash2 aria-hidden="true" className="mx-auto size-4" /></button>
            </div>)}
          </div> : null}

          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-black">Series principales</h4>
            <span className="text-xs font-bold text-arsen-dim">{exercise.sets.length} registradas</span>
          </div>

          <div className="space-y-2">
            {exercise.sets.map((set) => <SetRow key={set.id} saving={saving} set={set} unit={unit} onAddDrop={() => onAddDrop(set.id)} onEditDrop={onEditDrop} onEditSet={() => onEditSet(set)} onMoveSet={() => onMoveSet(set)} onRemoveDrop={onRemoveDrop} onRemoveSet={() => onRemoveSet(set.id)} />)}
          </div>
        </div>
      ) : null}
    </Card>
  )
}

function SetRow({
  saving,
  set,
  unit,
  onAddDrop,
  onEditDrop,
  onEditSet,
  onMoveSet,
  onRemoveDrop,
  onRemoveSet,
}: {
  saving: boolean
  set: SessionSet
  unit: 'kg' | 'lb'
  onAddDrop: () => void
  onEditDrop: (drop: SessionDrop) => void
  onEditSet: () => void
  onMoveSet: () => void
  onRemoveDrop: (dropId: string) => void
  onRemoveSet: () => void
}) {
  return (
    <div className="rounded-[12px] border border-white/10 bg-arsen-surface p-3">
      <div className="flex items-center gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-arsen-purple/35 text-xs font-black text-arsen-purple2">{set.order + 1}</span>
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-sm">{formatWeight(set.weightKg, unit)} × {set.reps} reps</strong>
          <span className="mt-0.5 block text-xs font-bold text-arsen-muted">RIR {set.rir}</span>
        </div>
        <div className="flex gap-1">
          <button aria-label={'Editar serie ' + (set.order + 1)} className="grid size-10 place-items-center rounded-[9px] border border-white/10 text-arsen-purple2" disabled={saving} onClick={onEditSet} title="Editar serie" type="button"><Pencil aria-hidden="true" className="size-4" /></button>
          <button aria-label={'Mover serie ' + (set.order + 1)} className="grid size-10 place-items-center rounded-[9px] border border-white/10 text-arsen-purple2" disabled={saving} onClick={onMoveSet} title="Mover serie" type="button"><ArrowRightLeft aria-hidden="true" className="size-4" /></button>
          <button aria-label={'Eliminar serie ' + (set.order + 1)} className="grid size-10 place-items-center rounded-[9px] border border-red-300/25 text-red-300" disabled={saving} onClick={onRemoveSet} title="Eliminar serie" type="button"><Trash2 aria-hidden="true" className="size-4" /></button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-bold text-arsen-muted"><Flame aria-hidden="true" className="size-4 shrink-0 text-arsen-acid" />{set.dropSets.length ? set.dropSets.length + ' drop set' + (set.dropSets.length > 1 ? 's' : '') : 'Sin drop set'}</span>
        <button aria-label={'Agregar drop a serie ' + (set.order + 1)} className="grid size-10 shrink-0 place-items-center rounded-[9px] border border-arsen-acid/30 bg-arsen-acid/5 text-arsen-acid" disabled={saving} onClick={onAddDrop} title="Agregar drop" type="button"><Plus aria-hidden="true" className="size-4" /></button>
      </div>

      {set.dropSets.length > 0 ? <div className="mt-2 space-y-1.5">{set.dropSets.map((drop) => <DropRow drop={drop} key={drop.id} saving={saving} unit={unit} onEdit={() => onEditDrop(drop)} onRemove={() => onRemoveDrop(drop.id)} />)}</div> : null}
    </div>
  )
}

function DropRow({ drop, saving, unit, onEdit, onRemove }: { drop: SessionDrop; saving: boolean; unit: 'kg' | 'lb'; onEdit: () => void; onRemove: () => void }) {
  return <div className="flex items-center gap-2 rounded-[9px] border border-arsen-acid/15 bg-arsen-acid/5 px-2 py-1.5"><span className="min-w-0 flex-1 truncate text-xs text-arsen-muted">Drop {drop.order + 1} · {formatWeight(drop.weightKg, unit)} × {drop.reps} · RIR {drop.rir}</span><button aria-label={'Editar drop ' + (drop.order + 1)} className="grid size-9 shrink-0 place-items-center rounded-[8px] text-arsen-purple2" disabled={saving} onClick={onEdit} title="Editar drop" type="button"><Pencil aria-hidden="true" className="size-3.5" /></button><button aria-label={'Eliminar drop ' + (drop.order + 1)} className="grid size-9 shrink-0 place-items-center rounded-[8px] text-red-300" disabled={saving} onClick={onRemove} title="Eliminar drop" type="button"><Trash2 aria-hidden="true" className="size-3.5" /></button></div>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[10px] border border-white/10 bg-arsen-surface2/60 px-3 py-2"><span className="block text-xs font-bold text-arsen-muted">{label}</span><strong className="mt-1 block truncate text-sm text-arsen-acid">{value}</strong></div>
}
