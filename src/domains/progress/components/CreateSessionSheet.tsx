import { useEffect, useMemo, useState } from 'react'
import { Check, Flame, Plus, X } from 'lucide-react'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { formatWeight, kgToUnit, unitToKg } from '../../../shared/utils/weight'
import type { RoutineExercise } from '../../routine/types'
import type { WeightUnit } from '../../workout/types'
import type { ProgressEditOptions, RecentSessionSummary } from '../repository'

export type ManualSessionSetDraft = {
  dropSet: { reps: number; rir: number; weightKg: number } | null
  exercise: RoutineExercise
  reps: number
  rir: number
  weightKg: number
}

export type ManualSessionSaveInput = {
  date: string
  dayId: string
  routineId: string
  sets: ManualSessionSetDraft[]
}

type CreateSessionSheetProps = {
  date: string
  disabled: boolean
  displayUnit: WeightUnit
  existingSession: RecentSessionSummary | null | undefined
  exercisesForDay: RoutineExercise[]
  maxDate: string
  onClose: () => void
  onDateChange: (date: string) => void
  onDayChange: (dayId: string) => void
  onSave: (input: ManualSessionSaveInput) => Promise<void> | void
  options: ProgressEditOptions
}

export function CreateSessionSheet({
  date,
  disabled,
  displayUnit,
  existingSession,
  exercisesForDay,
  maxDate,
  onClose,
  onDateChange,
  onDayChange,
  onSave,
  options,
}: CreateSessionSheetProps) {
  const firstRoutineId = options.routines[0]?.id ?? ''
  const firstDayId = options.days.find((day) => day.routineId === firstRoutineId)?.id ?? ''
  const [form, setForm] = useState(() => ({
    date,
    dayId: firstDayId,
    exerciseId: '',
    routineId: firstRoutineId,
  }))
  const [weightValue, setWeightValue] = useState('60')
  const [reps, setReps] = useState('8')
  const [rir, setRir] = useState('2')
  const [dropEnabled, setDropEnabled] = useState(false)
  const [dropWeightValue, setDropWeightValue] = useState('48')
  const [dropReps, setDropReps] = useState('10')
  const [dropRir, setDropRir] = useState('2')
  const [draftSets, setDraftSets] = useState<ManualSessionSetDraft[]>([])
  const [message, setMessage] = useState<string | null>(null)

  const daysForRoutine = useMemo(
    () => options.days.filter((day) => day.routineId === form.routineId),
    [form.routineId, options.days],
  )
  const exerciseOptionsForDay = useMemo(
    () => options.exercises.filter((exercise) => exercise.dayId === form.dayId),
    [form.dayId, options.exercises],
  )
  const selectedExercise = exercisesForDay.find((exercise) => exercise.id === form.exerciseId) ?? exercisesForDay[0] ?? null

  useEffect(() => {
    if (date === form.date) return
    setForm((current) => ({ ...current, date }))
  }, [date, form.date])

  useEffect(() => {
    const nextDayId = daysForRoutine.find((day) => day.id === form.dayId)?.id ?? daysForRoutine[0]?.id ?? ''
    if (nextDayId && nextDayId !== form.dayId) {
      setForm((current) => ({ ...current, dayId: nextDayId, exerciseId: '' }))
      onDayChange(nextDayId)
    }
  }, [daysForRoutine, form.dayId, onDayChange])

  useEffect(() => {
    if (form.dayId) onDayChange(form.dayId)
  }, [form.dayId, onDayChange])

  useEffect(() => {
    const nextExerciseId = exercisesForDay.find((exercise) => exercise.id === form.exerciseId)?.id ?? exercisesForDay[0]?.id ?? ''
    if (nextExerciseId !== form.exerciseId) {
      setForm((current) => ({ ...current, exerciseId: nextExerciseId }))
    }
  }, [exercisesForDay, form.exerciseId])

  useEffect(() => {
    if (!selectedExercise) return
    const baseWeight = selectedExercise.currentWeightKg > 0 ? selectedExercise.currentWeightKg : 60
    setWeightValue(String(kgToUnit(baseWeight, displayUnit)))
    setDropWeightValue(String(kgToUnit(baseWeight * 0.8, displayUnit)))
  }, [displayUnit, selectedExercise])

  function changeDate(nextDate: string) {
    setForm((current) => ({ ...current, date: nextDate }))
    onDateChange(nextDate)
  }

  function addDraftSet() {
    if (form.date > maxDate) {
      setMessage('No puedes crear sesiones en fechas futuras.')
      return
    }
    if (!selectedExercise) {
      setMessage('Selecciona un ejercicio antes de agregar una serie.')
      return
    }

    setDraftSets((current) => [
      ...current,
      {
        dropSet: dropEnabled
          ? {
              reps: numberOrZero(dropReps),
              rir: numberOrZero(dropRir),
              weightKg: unitToKg(numberOrZero(dropWeightValue), displayUnit),
            }
          : null,
        exercise: selectedExercise,
        reps: numberOrZero(reps),
        rir: numberOrZero(rir),
        weightKg: unitToKg(numberOrZero(weightValue), displayUnit),
      },
    ])
    setMessage('Serie agregada al borrador')
  }

  function saveSession() {
    if (form.date > maxDate) {
      setMessage('No puedes crear sesiones en fechas futuras.')
      return
    }
    if (!form.dayId || !form.routineId || draftSets.length === 0) {
      setMessage('Agrega al menos una serie antes de guardar.')
      return
    }

    onSave({
      date: form.date,
      dayId: form.dayId,
      routineId: form.routineId,
      sets: draftSets,
    })
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
      <button aria-label="Cerrar creador" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative max-h-[88vh] w-full overflow-y-auto rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-black">Crear sesion</h2>
            <p className="mt-1 text-xs font-semibold text-arsen-muted">Registra series olvidadas desde progreso.</p>
          </div>
          <button className="grid size-9 shrink-0 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Fecha</span>
            <input
              className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink"
              max={maxDate}
              onChange={(event) => changeDate(event.target.value)}
              type="date"
              value={form.date}
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Rutina</span>
            <select
              className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink"
              disabled={disabled || options.routines.length === 0}
              onChange={(event) => setForm((current) => ({ ...current, routineId: event.target.value, dayId: '', exerciseId: '' }))}
              value={form.routineId}
            >
              {options.routines.length === 0 ? <option value="">Sin rutinas guardadas</option> : null}
              {options.routines.map((routine) => (
                <option key={routine.id} value={routine.id}>
                  {routine.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Dia</span>
            <select
              className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink"
              disabled={disabled || daysForRoutine.length === 0}
              onChange={(event) => setForm((current) => ({ ...current, dayId: event.target.value, exerciseId: '' }))}
              value={form.dayId}
            >
              {daysForRoutine.length === 0 ? <option value="">Sin dias</option> : null}
              {daysForRoutine.map((day) => (
                <option key={day.id} value={day.id}>
                  {day.name} - {day.routineName}
                </option>
              ))}
            </select>
          </label>

          {existingSession ? (
            <div className="rounded-[10px] border border-arsen-purple/40 bg-arsen-purple/15 p-3 text-xs font-semibold text-arsen-purple2">
              Ya existe una sesion ese dia, se agregara a ella
            </div>
          ) : null}

          <label className="block">
            <span className="mb-1 block text-xs font-bold text-arsen-muted">Ejercicio</span>
            <select
              className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-surface px-3 text-sm font-extrabold text-arsen-ink"
              disabled={disabled || exerciseOptionsForDay.length === 0}
              onChange={(event) => setForm((current) => ({ ...current, exerciseId: event.target.value }))}
              value={form.exerciseId}
            >
              {exerciseOptionsForDay.length === 0 ? <option value="">Sin ejercicios</option> : null}
              {exerciseOptionsForDay.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-3 gap-2">
            <NumberField label={displayUnit.toUpperCase()} onChange={setWeightValue} value={weightValue} />
            <NumberField label="Reps" onChange={setReps} value={reps} />
            <NumberField label="RIR" onChange={setRir} value={rir} />
          </div>

          <Card className="p-3">
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

          <ActionButton className="w-full" disabled={disabled || !selectedExercise} onClick={addDraftSet} tone="ghost" type="button">
            <Plus aria-hidden="true" className="size-5" />
            Agregar serie
          </ActionButton>

          {draftSets.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-extrabold text-arsen-muted">Borrador: {draftSets.length} series</div>
              {draftSets.map((set, index) => (
                <div className="rounded-[10px] border border-white/10 bg-arsen-bg/55 p-2 text-xs" key={`${set.exercise.id}-${index}`}>
                  <strong className="block truncate text-sm">{set.exercise.name}</strong>
                  <span className="mt-1 block text-arsen-muted">
                    {formatWeight(set.weightKg, displayUnit)} - {set.reps} reps - RIR {set.rir}
                    {set.dropSet ? ' - 1 drop' : ''}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {message ? <p className="mt-3 text-xs font-semibold text-arsen-purple2">{message}</p> : null}

        <div className="mt-4 grid grid-cols-[1fr_1.45fr] gap-2">
          <ActionButton disabled={disabled} onClick={onClose} tone="ghost" type="button">
            Cancelar
          </ActionButton>
          <ActionButton disabled={disabled || draftSets.length === 0} onClick={saveSession} tone="acid" type="button">
            <Check aria-hidden="true" className="size-5" />
            Guardar sesion
          </ActionButton>
        </div>
      </section>
    </div>
  )
}

function NumberField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block min-w-0">
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

function numberOrZero(value: string) {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : 0
}
