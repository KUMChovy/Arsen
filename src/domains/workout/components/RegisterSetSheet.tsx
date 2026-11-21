import { useRef, useState, useTransition } from 'react'
import { Check, Dumbbell, Flame, X } from 'lucide-react'
import type { RoutineExercise } from '../../routine/types'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { useDialogFocus } from '../../../shared/components/useDialogFocus'
import { buildEquipmentLoadNote } from '../../../shared/calculations/equipmentLoad'
import { formatRepRange } from '../../../shared/utils/reps'
import { confirmDanger } from '../../../shared/utils/alerts'
import { kgToUnit, unitToKg } from '../../../shared/utils/weight'
import { registerMainSetForExercise } from '../services'
import { NumberField } from './NumberField'
import type { SetLog, WeightUnit } from '../types'

type RegisterSetSheetProps = {
  availablePlateWeightsKg?: number[] | null
  date: string
  dayId: string
  displayUnit: WeightUnit
  exercise: RoutineExercise | null
  onClose: () => void
  onSaved?: () => void
  referenceSet?: Pick<SetLog, 'weightKg' | 'reps' | 'rir'>
  routineId: string
}

export function RegisterSetSheet({
  availablePlateWeightsKg,
  date,
  dayId,
  displayUnit,
  exercise,
  onClose,
  onSaved,
  referenceSet,
  routineId,
}: RegisterSetSheetProps) {
  const initialWeight = referenceSet?.weightKg ?? exercise?.currentWeightKg ?? 0
  const [weightValue, setWeightValue] = useState(() => String(kgToUnit(initialWeight, displayUnit)))
  const [reps, setReps] = useState(() => String(referenceSet?.reps ?? exercise?.repsMin ?? 8))
  const [rir, setRir] = useState(() => String(referenceSet?.rir ?? exercise?.recommendedRir ?? 2))
  const [dropEnabled, setDropEnabled] = useState(false)
  const [dropWeightValue, setDropWeightValue] = useState(() => String(kgToUnit(initialWeight * 0.8, displayUnit)))
  const [dropReps, setDropReps] = useState('10')
  const [dropRir, setDropRir] = useState('2')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const initialRef = useRef({ weight: weightValue, reps, rir })
  const dialogRef = useDialogFocus(() => { void requestClose() })

  if (!exercise) return null
  const activeExercise = exercise
  async function requestClose() {
    if (savingRef.current) return
    const dirty = dropEnabled || weightValue !== initialRef.current.weight || reps !== initialRef.current.reps || rir !== initialRef.current.rir
    if (dirty && !(await confirmDanger('Descartar cambios', 'Los datos de esta serie no se han guardado.'))) return
    onClose()
  }
  const equipmentLoadNote = buildEquipmentLoadNote({
    availablePlateWeightsKg,
    barWeightKg: activeExercise.barWeightKg,
    equipment: activeExercise.equipment,
    loadMode: activeExercise.loadMode,
    unit: displayUnit,
    weightKg: unitToKg(numberOrZero(weightValue), displayUnit),
  })

  function saveSet() {
    if (savingRef.current) return
    const valid = (weight: string, count: string, effort: string) => weight.trim() !== '' && count.trim() !== '' && effort.trim() !== '' && Number.isFinite(Number(weight)) && Number(weight) >= 0 && Number.isInteger(Number(count)) && Number(count) > 0 && Number.isFinite(Number(effort)) && Number(effort) >= 0
    if (!valid(weightValue, reps, rir) || (dropEnabled && !valid(dropWeightValue, dropReps, dropRir))) {
      setMessage('Revisa el peso, las repeticiones y el RIR.')
      return
    }
    savingRef.current = true
    setSaving(true)
    startTransition(() => {
      registerMainSetForExercise({
        date,
        dayId,
        displayUnit,
        dropSet: dropEnabled
          ? {
              reps: numberOrZero(dropReps),
              rir: numberOrZero(dropRir),
              weightKg: unitToKg(numberOrZero(dropWeightValue), displayUnit),
            }
          : null,
        exercise: activeExercise,
        reps: numberOrZero(reps),
        rir: numberOrZero(rir),
        routineId,
        weightKg: unitToKg(numberOrZero(weightValue), displayUnit),
      })
        .then(() => {
          onSaved?.()
          onClose()
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se guardo la serie'))
        .finally(() => { savingRef.current = false; setSaving(false) })
    })
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
      <button aria-label="Cerrar registro" className="absolute inset-0 cursor-default" onClick={() => void requestClose()} />
      <section aria-labelledby="register-set-title" aria-modal="true" className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]" ref={dialogRef} role="dialog" tabIndex={-1}>
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black" id="register-set-title">
              <Dumbbell aria-hidden="true" className="size-5 text-arsen-purple2" />
              Registrar {activeExercise.name}
            </h2>
            <p className="mt-1 text-xs text-arsen-muted">
              {activeExercise.targetSets} series - {formatRepRange(activeExercise.repsMin, activeExercise.repsMax)} reps - RIR {activeExercise.recommendedRir}
            </p>
          </div>
          <button className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={() => void requestClose()}>
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <NumberField errorId={message ? 'register-set-error' : undefined} label={displayUnit.toUpperCase()} onChange={setWeightValue} step={displayUnit === 'kg' ? 2.5 : 5} value={weightValue} />
          <NumberField errorId={message ? 'register-set-error' : undefined} label="Reps" onChange={setReps} step={1} value={reps} />
          <NumberField errorId={message ? 'register-set-error' : undefined} label="RIR" onChange={setRir} value={rir} />
        </div>

        {equipmentLoadNote ? (
          <div className="mt-3 border-t border-white/10 pt-3 text-center text-xs font-extrabold text-arsen-ink">
            {equipmentLoadNote}
          </div>
        ) : null}

        <Card className="mt-3 p-3">
          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-extrabold">
              <Flame aria-hidden="true" className="size-5 text-arsen-acid" />
              Agregar drop set
            </span>
            <input
              checked={dropEnabled}
              className="size-5 accent-[oklch(0.86_0.20_125)]"
              onChange={(event) => setDropEnabled(event.target.checked)}
              type="checkbox"
            />
          </label>
          {dropEnabled ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              <NumberField errorId={message ? 'register-set-error' : undefined} label={`${displayUnit.toUpperCase()} drop`} onChange={setDropWeightValue} value={dropWeightValue} />
              <NumberField errorId={message ? 'register-set-error' : undefined} label="Reps" onChange={setDropReps} value={dropReps} />
              <NumberField errorId={message ? 'register-set-error' : undefined} label="RIR" onChange={setDropRir} value={dropRir} />
            </div>
          ) : null}
        </Card>

        {message ? <p className="mt-3 text-xs text-arsen-purple2" id="register-set-error" role="alert">{message}</p> : null}

        <div className="mt-4 grid grid-cols-[1fr_1.5fr] gap-2">
          <ActionButton disabled={isPending || saving} onClick={() => void requestClose()} tone="ghost">
            Cancelar
          </ActionButton>
          <ActionButton disabled={isPending || saving} onClick={saveSet} tone="acid">
            <Check aria-hidden="true" className="size-5" />
            Guardar serie
          </ActionButton>
        </div>
      </section>
    </div>
  )
}

function numberOrZero(value: string) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}
