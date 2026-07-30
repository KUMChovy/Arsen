import { useEffect, useState, useTransition } from 'react'
import { Check, Dumbbell, Flame, X } from 'lucide-react'
import type { RoutineExercise } from '../../routine/types'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { kgToUnit, unitToKg } from '../../../shared/utils/weight'
import { registerMainSetForExercise, skipRoutineExerciseForDay } from '../services'
import type { WeightUnit } from '../types'

type RegisterSetSheetProps = {
  date: string
  dayId: string
  displayUnit: WeightUnit
  exercise: RoutineExercise | null
  isSkipped?: boolean
  onClose: () => void
  onRetake?: () => void
  routineId: string
}

export function RegisterSetSheet({
  date,
  dayId,
  displayUnit,
  exercise,
  isSkipped = false,
  onClose,
  onRetake,
  routineId,
}: RegisterSetSheetProps) {
  const [weightValue, setWeightValue] = useState('60')
  const [reps, setReps] = useState('8')
  const [rir, setRir] = useState('2')
  const [dropEnabled, setDropEnabled] = useState(false)
  const [dropWeightValue, setDropWeightValue] = useState('48')
  const [dropReps, setDropReps] = useState('10')
  const [dropRir, setDropRir] = useState('2')
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!exercise) return
    const baseWeight = exercise.currentWeightKg > 0 ? exercise.currentWeightKg : 60
    setWeightValue(String(kgToUnit(baseWeight, displayUnit)))
    setDropWeightValue(String(kgToUnit(baseWeight * 0.8, displayUnit)))
  }, [displayUnit, exercise])

  if (!exercise) return null
  const activeExercise = exercise

  function saveSet() {
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
          setMessage('Serie guardada')
          onClose()
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se guardó la serie'))
    })
  }

  function skipCurrentExercise() {
    startTransition(() => {
      skipRoutineExerciseForDay({
        date,
        dayId,
        displayUnit,
        exercise: activeExercise,
        routineId,
      })
        .then(() => {
          setMessage('Ejercicio saltado')
          onClose()
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo saltar'))
    })
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
      <button aria-label="Cerrar registro" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section className="relative w-full rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black">
              <Dumbbell aria-hidden="true" className="size-5 text-arsen-purple2" />
              Registrar {activeExercise.name}
            </h2>
            <p className="mt-1 text-xs text-arsen-muted">
              {activeExercise.targetSets} series · {activeExercise.repRange} reps · RIR {activeExercise.recommendedRir}
            </p>
          </div>
          <button className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose}>
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <NumberField label={displayUnit.toUpperCase()} onChange={setWeightValue} value={weightValue} />
          <NumberField label="Reps" onChange={setReps} value={reps} />
          <NumberField label="RIR" onChange={setRir} value={rir} />
        </div>

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
              <NumberField label={`${displayUnit.toUpperCase()} drop`} onChange={setDropWeightValue} value={dropWeightValue} />
              <NumberField label="Reps" onChange={setDropReps} value={dropReps} />
              <NumberField label="RIR" onChange={setDropRir} value={dropRir} />
            </div>
          ) : null}
        </Card>

        {message ? <p className="mt-3 text-xs text-arsen-purple2">{message}</p> : null}

        <div className="mt-4 grid grid-cols-[1fr_1.5fr] gap-2">
          <ActionButton disabled={isPending} onClick={isSkipped ? onRetake : skipCurrentExercise} tone="ghost">
            {isSkipped ? 'Retomar' : 'Saltar'}
          </ActionButton>
          <ActionButton disabled={isPending} onClick={saveSet} tone="acid">
            <Check aria-hidden="true" className="size-5" />
            Guardar serie
          </ActionButton>
        </div>
      </section>
    </div>
  )
}

type NumberFieldProps = {
  label: string
  onChange: (value: string) => void
  value: string
}

function NumberField({ label, onChange, value }: NumberFieldProps) {
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

function numberOrZero(value: string) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}
