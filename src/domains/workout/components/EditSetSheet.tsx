import { useRef, useState, useTransition } from 'react'
import { Check, Flame, Trash2, X } from 'lucide-react'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { useDialogFocus } from '../../../shared/components/useDialogFocus'
import { confirmDanger } from '../../../shared/utils/alerts'
import { unitToKg, kgToUnit } from '../../../shared/utils/weight'
import type { DropSetLog, SetLog, WeightUnit } from '../types'
import { NumberField } from './NumberField'

type EditableDropSet = {
  enabled: boolean
  id: string | null
  localId: string
  reps: string
  rir: string
  weightValue: string
}

export type EditSetValue = Pick<SetLog, 'id' | 'order' | 'weightKg' | 'reps' | 'rir'>
export type EditDropSetValue = Pick<DropSetLog, 'id' | 'order' | 'weightKg' | 'reps' | 'rir'>

type EditSetSheetProps = {
  disabled: boolean
  dropSets: EditDropSetValue[]
  onClose: () => void
  onDelete: () => Promise<boolean | void>
  onSave: (input: {
    deletedDropSetIds: string[]
    drops: Array<{ id: string | null; reps: number; rir: number; weightKg: number }>
    main: { reps: number; rir: number; weightKg: number }
  }) => Promise<void>
  set: EditSetValue
  unit: WeightUnit
}

export function EditSetSheet({ disabled, dropSets, onClose, onDelete, onSave, set, unit }: EditSetSheetProps) {
  const [weightValue, setWeightValue] = useState(String(kgToUnit(set.weightKg, unit)))
  const [reps, setReps] = useState(String(set.reps))
  const [rir, setRir] = useState(String(set.rir))
  const [drops, setDrops] = useState<EditableDropSet[]>(
    dropSets
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((dropSet) => ({
        id: dropSet.id,
        enabled: true,
        localId: dropSet.id,
        reps: String(dropSet.reps),
        rir: String(dropSet.rir),
        weightValue: String(kgToUnit(dropSet.weightKg, unit)),
      })),
  )
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const blocked = disabled || isPending || saving
  const dialogRef = useDialogFocus(() => { void requestClose() })

  async function requestClose() {
    if (blocked) return
    const dirty = weightValue !== String(kgToUnit(set.weightKg, unit)) || reps !== String(set.reps) || rir !== String(set.rir) ||
      drops.some((drop) => {
        const original = dropSets.find((item) => item.id === drop.id)
        return !original || !drop.enabled || drop.weightValue !== String(kgToUnit(original.weightKg, unit)) || drop.reps !== String(original.reps) || drop.rir !== String(original.rir)
      })
    if (dirty && !(await confirmDanger('Descartar cambios', 'Los cambios de esta serie no se han guardado.'))) return
    onClose()
  }

  function save() {
    if (savingRef.current) return
    const nextWeight = numberOrNull(weightValue)
    const nextReps = numberOrNull(reps)
    const nextRir = numberOrNull(rir)
    if (nextWeight === null || nextWeight < 0 || nextReps === null || !Number.isInteger(nextReps) || nextReps <= 0 || nextRir === null || nextRir < 0) {
      setMessage('Revisa peso, reps y RIR')
      return
    }
    const parsedDrops = drops.filter((drop) => drop.enabled).map((drop) => ({
      id: drop.id,
      reps: numberOrNull(drop.reps),
      rir: numberOrNull(drop.rir),
      weight: numberOrNull(drop.weightValue),
    }))
    if (
      parsedDrops.some((drop) => drop.weight === null || drop.weight < 0 || drop.reps === null || !Number.isInteger(drop.reps) || drop.reps <= 0 || drop.rir === null || drop.rir < 0)
    ) {
      setMessage('Revisa los drop sets')
      return
    }

    savingRef.current = true
    setSaving(true)
    startTransition(() => {
      onSave({
        deletedDropSetIds: drops.flatMap((drop) => (!drop.enabled && drop.id ? [drop.id] : [])),
        drops: parsedDrops.map((drop) => ({
          id: drop.id,
          reps: drop.reps ?? 0,
          rir: drop.rir ?? 0,
          weightKg: unitToKg(drop.weight ?? 0, unit),
        })),
        main: { reps: nextReps, rir: nextRir, weightKg: unitToKg(nextWeight, unit) },
      })
        .then(onClose)
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo guardar'))
        .finally(() => { savingRef.current = false; setSaving(false) })
    })
  }

  function remove() {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    startTransition(() => {
      onDelete()
        .then((deleted) => {
          if (deleted !== false) onClose()
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo eliminar'))
        .finally(() => { savingRef.current = false; setSaving(false) })
    })
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
      <button aria-label="Cerrar editor" className="absolute inset-0 cursor-default" onClick={() => void requestClose()} type="button" />
      <section aria-labelledby="edit-set-title" aria-modal="true" className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]" ref={dialogRef} role="dialog" tabIndex={-1}>
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-black" id="edit-set-title">Editar serie</h2>
            <p className="mt-1 truncate text-xs text-arsen-muted">Serie {set.order + 1} - modifica peso, reps y RIR</p>
          </div>
          <button className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={() => void requestClose()} type="button">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <NumberField errorId={message ? 'edit-set-error' : undefined} label={unit.toUpperCase()} onChange={setWeightValue} step={unit === 'kg' ? 2.5 : 5} value={weightValue} />
          <NumberField errorId={message ? 'edit-set-error' : undefined} label="Reps" onChange={setReps} step={1} value={reps} />
          <NumberField errorId={message ? 'edit-set-error' : undefined} label="RIR" onChange={setRir} value={rir} />
        </div>

        <div className="mt-3 space-y-2">
          {drops.length > 0 ? (
            drops.map((drop, index) => (
              <Card className={['p-3 transition-opacity', drop.enabled ? 'opacity-100' : 'opacity-55'].join(' ')} key={drop.localId}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-extrabold">
                    <Flame aria-hidden="true" className="size-5 text-arsen-acid" />
                    Editar drop set{drops.length > 1 ? ` ${index + 1}` : ''}
                  </span>
                  <button
                    aria-label={drop.enabled ? `Quitar drop set ${index + 1}` : `Conservar drop set ${index + 1}`}
                    className={[
                      'grid size-5 place-items-center rounded-[5px] border text-sm disabled:opacity-40',
                      drop.enabled ? 'border-arsen-acid bg-arsen-acid text-arsen-bg' : 'border-white/15 bg-transparent text-arsen-dim',
                    ].join(' ')}
                    disabled={blocked}
                    onClick={() =>
                      setDrops((current) =>
                        current.map((candidate) => (candidate.localId === drop.localId ? { ...candidate, enabled: !candidate.enabled } : candidate)),
                      )
                    }
                    type="button"
                  >
                    {drop.enabled ? <Check aria-hidden="true" className="size-4" /> : null}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <NumberField
                    label={`${unit.toUpperCase()} drop`}
                    errorId={message ? 'edit-set-error' : undefined}
                    disabled={!drop.enabled}
                    onChange={(value) => updateDropField(drop.localId, 'weightValue', value, setDrops)}
                    value={drop.weightValue}
                  />
                  <NumberField disabled={!drop.enabled} errorId={message ? 'edit-set-error' : undefined} label="Reps" onChange={(value) => updateDropField(drop.localId, 'reps', value, setDrops)} value={drop.reps} />
                  <NumberField disabled={!drop.enabled} errorId={message ? 'edit-set-error' : undefined} label="RIR" onChange={(value) => updateDropField(drop.localId, 'rir', value, setDrops)} value={drop.rir} />
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-4 text-sm text-arsen-muted">Esta serie no tiene drop set.</Card>
          )}
        </div>

        {message ? <p className="mt-3 text-xs text-arsen-purple2" id="edit-set-error" role="alert">{message}</p> : null}

        <div className="mt-4 grid grid-cols-[1fr_1.5fr] gap-2">
          <ActionButton disabled={blocked} onClick={remove} tone="danger">
            <Trash2 aria-hidden="true" className="size-5" />
            Eliminar
          </ActionButton>
          <ActionButton disabled={blocked} onClick={save} tone="acid">
            <Check aria-hidden="true" className="size-5" />
            Guardar cambios
          </ActionButton>
        </div>
      </section>
    </div>
  )
}

function updateDropField(
  localId: string,
  field: keyof Pick<EditableDropSet, 'reps' | 'rir' | 'weightValue'>,
  value: string,
  setDrops: (updater: (current: EditableDropSet[]) => EditableDropSet[]) => void,
) {
  setDrops((current) => current.map((drop) => (drop.localId === localId ? { ...drop, [field]: value } : drop)))
}

function numberOrNull(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}
