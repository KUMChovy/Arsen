import { useState, useTransition } from 'react'
import { Check, Flame, X } from 'lucide-react'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { kgToUnit, unitToKg } from '../../../shared/utils/weight'
import type { WeightUnit } from '../../workout/types'
import type { SessionExerciseDetail } from '../repository'

type HistoricalSet = SessionExerciseDetail['sets'][number]

export type HistoricalSetEditInput = Pick<HistoricalSet, 'reps' | 'rir' | 'weightKg'>

export function EditHistoricalSetSheet({
  description = 'El drop permanece ligado a esta serie principal.',
  initial,
  title = 'Editar drop',
  disabled = false,
  onClose,
  onSave,
  unit,
}: {
  description?: string
  initial: HistoricalSetEditInput
  title?: string
  disabled?: boolean
  onClose: () => void
  onSave: (input: HistoricalSetEditInput) => Promise<void> | void
  unit: WeightUnit
}) {
  const [weightValue, setWeightValue] = useState(String(kgToUnit(initial.weightKg, unit)))
  const [reps, setReps] = useState(String(initial.reps))
  const [rir, setRir] = useState(String(initial.rir))
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

    setMessage(null)
    startTransition(() => {
      Promise.resolve(onSave({
        reps: nextReps,
        rir: nextRir,
        weightKg: unitToKg(nextWeight, unit),
      }))
        .then(onClose)
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo guardar el drop'))
    })
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
      <button aria-label="Cerrar editor de drop" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section aria-labelledby="historical-set-heading" aria-modal="true" className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]" role="dialog">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-xl font-black" id="historical-set-heading">
              <Flame aria-hidden="true" className="size-5 text-arsen-acid" />
              {title}
            </h2>
            <p className="mt-1 text-xs text-arsen-muted">{description}</p>
          </div>
          <button aria-label="Cerrar" className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <Card className="p-3">
          <div className="grid grid-cols-3 gap-2">
            <NumberField label={unit.toUpperCase()} onChange={setWeightValue} value={weightValue} />
            <NumberField label="Reps" onChange={setReps} value={reps} />
            <NumberField label="RIR" onChange={setRir} value={rir} />
          </div>
        </Card>

        {message ? <p className="mt-3 text-xs text-red-200" role="alert">{message}</p> : null}

        <div className="mt-4 grid grid-cols-[1fr_1.5fr] gap-2">
          <ActionButton disabled={blocked} onClick={onClose} tone="ghost">
            Cancelar
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

function NumberField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-arsen-muted">{label}</span>
      <input
        className="min-h-12 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-center text-base font-extrabold text-arsen-ink"
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
