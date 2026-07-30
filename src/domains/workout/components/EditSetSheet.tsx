import { useState, useTransition } from 'react'
import { Check, Trash2, X } from 'lucide-react'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { unitToKg, kgToUnit } from '../../../shared/utils/weight'
import type { SetLog, WeightUnit } from '../types'

type EditSetSheetProps = {
  disabled: boolean
  exerciseName: string
  onClose: () => void
  onDelete: () => Promise<boolean | void>
  onSave: (input: { reps: number; rir: number; weightKg: number }) => Promise<void>
  set: SetLog
  unit: WeightUnit
}

export function EditSetSheet({ disabled, exerciseName, onClose, onDelete, onSave, set, unit }: EditSetSheetProps) {
  const [weightValue, setWeightValue] = useState(String(kgToUnit(set.weightKg, unit)))
  const [reps, setReps] = useState(String(set.reps))
  const [rir, setRir] = useState(String(set.rir))
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const blocked = disabled || isPending

  function save() {
    const nextWeight = numberOrNull(weightValue)
    const nextReps = numberOrNull(reps)
    const nextRir = numberOrNull(rir)
    if (nextWeight === null || nextWeight <= 0 || nextReps === null || nextReps <= 0 || nextRir === null || nextRir < 0) {
      setMessage('Revisa peso, reps y RIR')
      return
    }

    startTransition(() => {
      onSave({ reps: nextReps, rir: nextRir, weightKg: unitToKg(nextWeight, unit) })
        .then(onClose)
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo guardar'))
    })
  }

  function remove() {
    startTransition(() => {
      onDelete()
        .then((deleted) => {
          if (deleted !== false) onClose()
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo eliminar'))
    })
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
      <button aria-label="Cerrar editor" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative w-full rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-black">Editar serie</h2>
            <p className="mt-1 truncate text-xs font-semibold text-arsen-muted">
              {exerciseName} - serie {set.order + 1}
            </p>
          </div>
          <button className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        <Card className="grid grid-cols-3 gap-2 p-3">
          <NumberField label={unit.toUpperCase()} onChange={setWeightValue} value={weightValue} />
          <NumberField label="Reps" onChange={setReps} value={reps} />
          <NumberField label="RIR" onChange={setRir} value={rir} />
        </Card>

        {message ? <p className="mt-3 text-xs text-arsen-purple2">{message}</p> : null}

        <div className="mt-4 grid grid-cols-[1fr_1.4fr] gap-2">
          <ActionButton disabled={blocked} onClick={remove} tone="danger">
            <Trash2 aria-hidden="true" className="size-5" />
            Eliminar
          </ActionButton>
          <ActionButton disabled={blocked} onClick={save} tone="acid">
            <Check aria-hidden="true" className="size-5" />
            Guardar
          </ActionButton>
        </div>
      </section>
    </div>
  )
}

function NumberField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-arsen-muted">{label}</span>
      <input
        className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-2 text-center text-sm font-extrabold text-arsen-ink"
        inputMode="decimal"
        onChange={(event) => onChange(event.target.value)}
        type="number"
        value={value}
      />
    </label>
  )
}

function numberOrNull(value: string) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : null
}
