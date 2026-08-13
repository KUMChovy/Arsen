import { Check, ChevronLeft, ChevronRight, Dumbbell, Info, Pencil, Trash2, TrendingUp, X } from 'lucide-react'
import { useEffect, useMemo, useState, useTransition } from 'react'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'
import type { WeightIncreaseRecommendation } from '../../../shared/calculations/progression'
import { buildEquipmentLoadNote } from '../../../shared/calculations/equipmentLoad'
import { totalVolume } from '../../../shared/calculations/workout'
import { buildWarmupSets } from '../../../shared/calculations/warmups'
import { localDateKey } from '../../../shared/utils/date'
import { confirmDanger } from '../../../shared/utils/alerts'
import { formatRepRange } from '../../../shared/utils/reps'
import { formatRestSeconds } from '../../../shared/utils/time'
import { formatWeight } from '../../../shared/utils/weight'
import { useActiveRoutineBundle, useExerciseAssets, useRoutines, useWorkoutDayById } from '../../routine/hooks'
import type { Routine, RoutineDay, RoutineExercise } from '../../routine/types'
import { RegisterSetSheet } from '../components/RegisterSetSheet'
import { EditSetSheet } from '../components/EditSetSheet'
import { getDefaultWorkoutDayId } from '../calculations/trainingRotation'
import { useLastSessionReferencesForDay, useWeightIncreaseRecommendations, useWorkoutProgress, useWorkoutRotationStatus } from '../hooks'
import { addDropSet, completeSessionForDay, deleteDropSet, deleteMainSet, skipRoutineExerciseForDay, updateDropSet, updateMainSet } from '../services'
import { setActiveRoutine } from '../../routine/services'
import type { ExerciseState, LastSessionReference, SetLog, WeightUnit } from '../types'

type ExerciseFilter = 'all' | 'pending' | 'in_progress' | 'skipped' | 'done'
type SelectionSnapshot = {
  dayId: string | null
  dayName: string
  routineId: string
  routineName: string
}

export function WorkoutPage() {
  const today = useMemo(() => new Date(), [])
  const dateKey = useMemo(() => localDateKey(today), [today])
  const selectedDate = useMemo(() => new Date(`${dateKey}T12:00:00`), [dateKey])
  const bundle = useActiveRoutineBundle()
  const exerciseAssets = useExerciseAssets() ?? []
  const imageSrcByAssetId = useMemo(() => new Map(exerciseAssets.map((asset) => [asset.id, asset.dataUrl])), [exerciseAssets])
  const routines = useRoutines() ?? []
  const days = bundle?.days ?? []
  const activeRoutineId = bundle?.routine.id
  const defaultDayId = getDefaultWorkoutDayId(days, selectedDate.getDay())
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const workoutDay = useWorkoutDayById(selectedDayId)
  const dayExercises = workoutDay?.dayExercises ?? []
  const dailyProgress = useWorkoutProgress(dateKey, workoutDay?.day.id, dayExercises)
  const lastSessionReferences = useLastSessionReferencesForDay({
    date: dateKey,
    dayId: workoutDay?.day.id,
    exercises: dayExercises,
    routineId: workoutDay?.routine.id,
  })
  const rotationStatus = useWorkoutRotationStatus({
    activeRoutineId,
    dateKey,
    days,
    todayWeekday: selectedDate.getDay(),
  })
  const weightIncreaseRecommendations = useWeightIncreaseRecommendations(dayExercises)
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(null)
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null)
  const [exerciseFilter, setExerciseFilter] = useState<ExerciseFilter>('all')
  const [editingSet, setEditingSet] = useState<{ exercise: RoutineExercise; set: SetLog } | null>(null)
  const [noteSheetExercise, setNoteSheetExercise] = useState<RoutineExercise | null>(null)
  const [routineSheetOpen, setRoutineSheetOpen] = useState(false)
  const [lastSelectionChange, setLastSelectionChange] = useState<SelectionSnapshot | null>(null)
  const [missedNoticeDismissed, setMissedNoticeDismissed] = useState(() => isMissedNoticeDismissed(dateKey))
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const navigableExercises = useMemo(
    () => dayExercises.filter((exercise) => (dailyProgress.stateByExerciseId.get(exercise.id) ?? 'pending') !== 'done'),
    [dailyProgress.stateByExerciseId, dayExercises],
  )
  const currentExercise = navigableExercises.find((exercise) => exercise.id === currentExerciseId) ?? navigableExercises[0] ?? null
  const currentExerciseIndex = currentExercise ? navigableExercises.findIndex((exercise) => exercise.id === currentExercise.id) : -1
  const selectedExercise = selectedExerciseId ? dayExercises.find((exercise) => exercise.id === selectedExerciseId) : null
  const currentExerciseRecommendations = currentExercise
    ? weightIncreaseRecommendations.filter((recommendation) => recommendation.exerciseId === currentExercise.id)
    : []
  const completedCount = dailyProgress.completedCount
  const totalCount = dayExercises.length
  const preferredUnit = workoutDay?.settings.preferredUnit ?? 'kg'
  const selectedWeekday = workoutDay?.day.weekday
  const isOffCalendar = selectedWeekday !== undefined && selectedWeekday !== null && selectedWeekday !== selectedDate.getDay()
  const warmups = buildWarmupsForExercise(currentExercise, preferredUnit)
  const currentLoadNote = currentExercise
    ? buildEquipmentLoadNote({
        barWeightKg: currentExercise.barWeightKg,
        equipment: currentExercise.equipment,
        loadMode: currentExercise.loadMode,
        unit: preferredUnit,
        weightKg: currentExercise.currentWeightKg,
      })
    : null
  const currentLastSessionReference = currentExercise ? lastSessionReferences.get(currentExercise.id) : undefined
  const hasOpenRegisteredSetsToday = dailyProgress.setLogs.length > 0 && dailyProgress.progress?.session?.status !== 'completed'
  const mainSets = dailyProgress.setLogs.filter((set) => set.kind === 'main')
  const dailyVolume = Math.round(totalVolume(mainSets, dailyProgress.dropSets))
  const visibleExercises = useMemo(
    () =>
      dayExercises.filter((exercise) => {
        if (exerciseFilter === 'all') return true
        return (dailyProgress.stateByExerciseId.get(exercise.id) ?? 'pending') === exerciseFilter
      }),
    [dailyProgress.stateByExerciseId, dayExercises, exerciseFilter],
  )
  const editingDropSets = editingSet ? dailyProgress.dropSets.filter((dropSet) => dropSet.setLogId === editingSet.set.id) : []
  const statusSummary = [
    { label: 'Pendientes', value: dailyProgress.pendingCount },
    { label: 'En progreso', value: dailyProgress.inProgressCount, tone: 'text-arsen-purple2' },
    { label: 'Hechos', value: dailyProgress.completedCount, tone: 'text-arsen-acid' },
    { label: 'Saltados', value: dailyProgress.skippedCount, tone: 'text-arsen-dim' },
  ]

  useEffect(() => {
    if (selectedDayId && days.some((day) => day.id === selectedDayId)) return
    const storedDayId = readStoredDaySelection(dateKey, activeRoutineId)
    setSelectedDayId(storedDayId && days.some((day) => day.id === storedDayId) ? storedDayId : defaultDayId)
  }, [activeRoutineId, dateKey, days, defaultDayId, selectedDayId])

  useEffect(() => {
    if (currentExerciseId && navigableExercises.some((exercise) => exercise.id === currentExerciseId)) return
    setCurrentExerciseId(navigableExercises[0]?.id ?? null)
  }, [currentExerciseId, navigableExercises])

  useEffect(() => {
    if (activeExerciseId && dayExercises.some((exercise) => exercise.id === activeExerciseId)) return
    setActiveExerciseId(currentExercise?.id ?? dayExercises[0]?.id ?? null)
  }, [activeExerciseId, currentExercise?.id, dayExercises])

  useEffect(() => {
    setMissedNoticeDismissed(isMissedNoticeDismissed(dateKey))
  }, [dateKey])

  function runSetAction(action: () => Promise<void>, success: string) {
    startTransition(() => {
      action()
        .then(() => setMessage(success))
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Accion no completada'))
    })
  }

  function completeSession() {
    if (!workoutDay) return

    startTransition(() => {
      completeSessionForDay({
        date: dateKey,
        dayId: workoutDay.day.id,
        displayUnit: workoutDay.settings.preferredUnit,
        routineId: workoutDay.routine.id,
      })
        .then(() => setMessage('Sesion finalizada'))
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo finalizar'))
    })
  }

  async function deleteSet(set: SetLog) {
    if (!(await confirmDanger('Eliminar serie', 'Se borrara esta serie y sus drop sets.'))) return

    runSetAction(() => deleteMainSet(set.id), 'Serie eliminada')
  }

  async function changeRoutine(routineId: string) {
    if (routineId === activeRoutineId) return
    if (hasOpenRegisteredSetsToday) return
    const previousSelection = currentSelectionSnapshot()

    startTransition(() => {
      setActiveRoutine(routineId)
        .then(() => {
          setLastSelectionChange(previousSelection)
          setSelectedDayId(null)
          setSelectedExerciseId(null)
          setCurrentExerciseId(null)
          setActiveExerciseId(null)
          setMessage('Rutina activa cambiada')
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo cambiar rutina'))
    })
  }

  function changeDay(dayId: string) {
    if (hasOpenRegisteredSetsToday) return
    const previousSelection = currentSelectionSnapshot()
    if (previousSelection?.dayId !== dayId) setLastSelectionChange(previousSelection)
    setSelectedDayId(dayId)
    writeStoredDaySelection(dateKey, activeRoutineId, dayId)
    setSelectedExerciseId(null)
    setCurrentExerciseId(null)
    setActiveExerciseId(null)
  }

  function currentSelectionSnapshot(): SelectionSnapshot | null {
    if (!activeRoutineId) return null

    return {
      dayId: workoutDay?.day.id ?? selectedDayId,
      dayName: workoutDay?.day.name ?? 'Dia anterior',
      routineId: activeRoutineId,
      routineName: bundle?.routine.name ?? 'Rutina anterior',
    }
  }

  function undoSelectionChange() {
    if (!lastSelectionChange) return

    const previousSelection = lastSelectionChange
    setLastSelectionChange(null)
    setSelectedExerciseId(null)
    setCurrentExerciseId(null)
    setActiveExerciseId(null)

    if (previousSelection.routineId !== activeRoutineId) {
      startTransition(() => {
        setActiveRoutine(previousSelection.routineId)
          .then(() => {
            setSelectedDayId(previousSelection.dayId)
            if (previousSelection.dayId) writeStoredDaySelection(dateKey, previousSelection.routineId, previousSelection.dayId)
          })
          .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo deshacer'))
      })
    } else {
      setSelectedDayId(previousSelection.dayId)
      if (previousSelection.dayId) writeStoredDaySelection(dateKey, previousSelection.routineId, previousSelection.dayId)
    }
  }

  function dismissMissedTrainingNotice() {
    dismissMissedNotice(dateKey)
    setMissedNoticeDismissed(true)
  }

  function goToPreviousExercise() {
    if (currentExerciseIndex <= 0) return
    const previousExerciseId = navigableExercises[currentExerciseIndex - 1]?.id ?? null
    setCurrentExerciseId(previousExerciseId)
    setActiveExerciseId(previousExerciseId)
  }

  function skipCurrentExercise() {
    if (!currentExercise || !workoutDay) return
    const nextExerciseId = navigableExercises[currentExerciseIndex + 1]?.id ?? navigableExercises[currentExerciseIndex - 1]?.id ?? null
    startTransition(() => {
      skipRoutineExerciseForDay({
        date: dateKey,
        dayId: workoutDay.day.id,
        displayUnit: workoutDay.settings.preferredUnit,
        exercise: currentExercise,
        routineId: workoutDay.routine.id,
      })
        .then(() => {
          setCurrentExerciseId(nextExerciseId)
          setActiveExerciseId(nextExerciseId)
          setMessage('Ejercicio saltado')
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo saltar'))
    })
  }

  function activateExercise(exercise: RoutineExercise) {
    setActiveExerciseId(exercise.id)
    if ((dailyProgress.stateByExerciseId.get(exercise.id) ?? 'pending') !== 'done') {
      setCurrentExerciseId(exercise.id)
    }
  }

  function loggedRowsForExercise(exercise: RoutineExercise) {
    const log = dailyProgress.exerciseLogByExerciseId.get(exercise.id)
    if (!log) return []

    return dailyProgress.setLogs
      .filter((set) => set.kind === 'main' && set.exerciseLogId === log.id)
      .sort((a, b) => a.order - b.order)
      .map((set) => ({
        dropSets: dailyProgress.dropSets.filter((dropSet) => dropSet.setLogId === set.id).sort((a, b) => a.order - b.order),
        set,
      }))
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={`${weekdayLabel(selectedDate)} - ${workoutDay?.day.name ?? 'Cargando'} - sesion activa`} title="Entreno de hoy">
        <button
          aria-label="Cambiar rutina y dia"
          className="relative grid size-11 shrink-0 place-items-center rounded-[12px] border border-arsen-purple/45 bg-arsen-surface text-arsen-purple2 shadow-[0_10px_28px_rgb(0_0_0_/_0.22)] focus:outline-none focus:ring-2 focus:ring-arsen-purple2"
          disabled={isPending}
          onClick={() => setRoutineSheetOpen(true)}
          type="button"
        >
          <Dumbbell aria-hidden="true" className="size-5" />
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-arsen-acid" />
        </button>
      </PageHeader>

      {isOffCalendar ? (
        <div className="inline-flex min-h-8 items-center rounded-full border border-arsen-purple/40 bg-arsen-purple/15 px-3 text-xs font-extrabold text-arsen-purple2">
          Fuera de calendario
        </div>
      ) : null}

      {lastSelectionChange ? (
        <div className="flex items-center justify-between gap-3 rounded-[10px] border border-arsen-purple/40 bg-arsen-purple/15 px-3 py-2 text-xs">
          <span className="min-w-0 truncate text-arsen-purple2">
            Antes: {lastSelectionChange.routineName} - {lastSelectionChange.dayName}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            <button className="font-extrabold text-arsen-acid" onClick={undoSelectionChange} type="button">
              Deshacer
            </button>
            <button
              aria-label="Quitar aviso de cambio"
              className="grid size-8 place-items-center rounded-[9px] text-arsen-muted"
              onClick={() => setLastSelectionChange(null)}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      {rotationStatus.shouldShow && !missedNoticeDismissed ? (
        <MissedTrainingNotice
          daysWithoutTraining={rotationStatus.daysWithoutTraining}
          nextDay={rotationStatus.nextDay}
          onDismiss={dismissMissedTrainingNotice}
          onResume={() => {
            if (rotationStatus.nextDay) {
              changeDay(rotationStatus.nextDay.id)
              dismissMissedTrainingNotice()
            }
          }}
        />
      ) : null}

      <div>
        <div className="mb-2 text-xs font-extrabold text-arsen-purple2">Ejercicio actual</div>
        <Card className="min-w-0 p-3">
          <div className="grid grid-cols-[28px_72px_minmax(0,1fr)_28px] items-center gap-4 border-b border-white/10 pb-4">
            <button
              aria-label="Regresar al ejercicio anterior"
              className="grid size-8 place-items-center rounded-[10px] text-arsen-muted transition-colors enabled:hover:bg-white/5 enabled:hover:text-arsen-purple2 disabled:opacity-30"
              disabled={blockedNavigation(isPending, currentExerciseIndex <= 0)}
              onClick={goToPreviousExercise}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-6" />
            </button>
            <div className="grid size-[72px] place-items-center overflow-hidden rounded-[14px] border border-arsen-purple/45 bg-arsen-purple/10 p-1">
              <ExerciseArt
                alt={currentExercise?.name ?? 'Ejercicio'}
                bundledAssetId={currentExercise?.bundledAssetId}
                className="size-16"
                customImageSrc={currentExercise?.customAssetId ? imageSrcByAssetId.get(currentExercise.customAssetId) : null}
                muscle={currentExercise?.mainMuscle}
              />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[22px] font-black leading-tight">{currentExercise?.name ?? 'Sin ejercicio pendiente'}</h2>
              <div className="mt-1 flex items-center gap-2">
                <span className="inline-flex rounded-full bg-arsen-purple/30 px-2 py-1 text-xs font-bold text-arsen-purple2">
                  {currentExercise?.mainMuscle ?? 'Descanso'}
                </span>
                {currentExercise?.technicalNotes.trim() ? (
                  <button
                    aria-label={`Ver indicaciones de ${currentExercise.name}`}
                    className="grid size-8 shrink-0 place-items-center rounded-[9px] border border-white/10 text-arsen-purple2"
                    onClick={() => setNoteSheetExercise(currentExercise)}
                    type="button"
                  >
                    <Info aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
              </div>
            </div>
            <button
              aria-label="Saltar ejercicio actual"
              className="grid size-8 place-items-center rounded-[10px] text-arsen-ink transition-colors enabled:hover:bg-white/5 enabled:hover:text-arsen-purple2 disabled:opacity-30"
              disabled={blockedNavigation(isPending, !currentExercise)}
              onClick={skipCurrentExercise}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-6" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-0 py-3 text-center">
            {[
              ['Peso anterior', formatWeight(currentExercise?.currentWeightKg ?? 0, preferredUnit), 'text-arsen-acid'],
              ['Series', String(currentExercise?.targetSets ?? 0), 'text-arsen-ink'],
              ['Reps', currentExercise ? formatRepRange(currentExercise.repsMin, currentExercise.repsMax) : '-', 'text-arsen-ink'],
              ['RIR', currentExercise?.recommendedRir ?? '-', 'text-arsen-ink'],
            ].map(([label, value, tone]) => (
              <div className="min-w-0 border-r border-white/10 px-1 last:border-r-0" key={label}>
                <span className="block truncate text-xs text-arsen-muted">{label}</span>
                <strong className={['mt-1 block truncate text-lg', tone].join(' ')}>{value}</strong>
              </div>
            ))}
          </div>

          <div aria-label="Descanso recomendado" className="border-t border-white/10 py-3 text-center text-xs">
            <span className="text-arsen-muted">Descanso</span>
            <strong className="ml-2 text-sm text-arsen-ink">{formatRestSeconds(currentExercise?.restSeconds)}</strong>
          </div>

          {currentLoadNote ? (
            <div className="mb-3 border-t border-white/10 pt-3 text-center text-xs font-extrabold text-arsen-ink">
              {currentLoadNote}
            </div>
          ) : null}

          {currentExercise ? <LastSessionReferenceBlock reference={currentLastSessionReference} unit={preferredUnit} /> : null}

          <ActionButton className="w-full" disabled={!currentExercise} onClick={() => setSelectedExerciseId(currentExercise?.id ?? null)}>
            Registrar
            <ChevronRight aria-hidden="true" className="size-5" />
          </ActionButton>
        </Card>
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between text-xs font-extrabold">
          <span className="text-arsen-muted">Calentamiento</span>
          <span className="text-arsen-purple2">{warmups.length} series</span>
        </div>
        <div className="space-y-2">
          {warmups.map((set, index) => (
            <Card className="grid grid-cols-[28px_1fr_1fr_1fr] items-center gap-2 p-3 text-sm" key={`${set.weight}-${index}`}>
              <span className="grid size-6 place-items-center rounded-full border border-white/15 text-xs text-arsen-muted">
                {index + 1}
              </span>
              <strong className="text-arsen-acid">{set.weight}</strong>
              <span>{set.reps} reps</span>
              <span>RIR {set.rir}</span>
            </Card>
          ))}
        </div>
      </section>

      <WeightIncreaseCard recommendations={currentExerciseRecommendations} unit={preferredUnit} />

      {message ? (
        <div className="rounded-[10px] border border-arsen-purple/40 bg-arsen-purple/15 px-3 py-2 text-xs text-arsen-purple2">
          {message}
        </div>
      ) : null}

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <strong>{workoutDay ? `${workoutDay.routine.name} - ${workoutDay.day.name}` : 'Cargando rutina'}</strong>
          <span className="text-sm text-arsen-ink">{totalCount ? Math.round((completedCount / totalCount) * 100) : 0}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-arsen-acid to-arsen-acid2"
            style={{ width: `${totalCount ? (completedCount / totalCount) * 100 : 0}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-sm text-arsen-muted">
          <span>
            {completedCount} / {totalCount} ejercicios
          </span>
          <span>{dailyProgress.progress?.session?.status === 'completed' ? 'Finalizada' : workoutDay?.day.description ?? 'Sin rutina activa'}</span>
        </div>
        <ActionButton className="mt-3 w-full" disabled={isPending || !workoutDay} onClick={completeSession} tone="ghost">
          <Check aria-hidden="true" className="size-5" />
          Finalizar sesion
        </ActionButton>
      </Card>

      <section className="grid grid-cols-4 gap-2">
        {statusSummary.map((item) => (
          <Card className="p-2 text-center" key={item.label}>
            <strong className={['block text-base', item.tone ?? 'text-arsen-ink'].join(' ')}>{item.value}</strong>
            <span className="mt-1 block text-xs text-arsen-muted">{item.label}</span>
          </Card>
        ))}
      </section>

      <section>
        <div className="mb-2 text-xs font-extrabold text-arsen-muted">Resumen diario</div>
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-2 text-center">
            <strong className="block text-base text-arsen-acid">{mainSets.length}</strong>
            <span className="mt-1 block text-xs text-arsen-muted">Series</span>
          </Card>
          <Card className="p-2 text-center">
            <strong className="block text-base text-arsen-acid">{dailyProgress.dropSets.length}</strong>
            <span className="mt-1 block text-xs text-arsen-muted">Drops</span>
          </Card>
          <Card className="p-2 text-center">
            <strong className="block text-base text-arsen-acid">{dailyVolume}</strong>
            <span className="mt-1 block text-xs text-arsen-muted">Volumen kg</span>
          </Card>
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between text-xs font-extrabold">
          <span className="text-arsen-muted">Ejercicios y series del dia</span>
          <span className="text-arsen-purple2">{visibleExercises.length}</span>
        </div>
        <div className="mb-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {exerciseFilters.map((filter) => (
            <button
              className={[
                'shrink-0 rounded-[10px] border px-3 py-2 text-xs font-extrabold',
                exerciseFilter === filter.value
                  ? 'border-arsen-purple2 bg-arsen-purple/40 text-white'
                  : 'border-white/10 bg-arsen-surface text-arsen-muted',
              ].join(' ')}
              key={filter.value}
              onClick={() => setExerciseFilter(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {visibleExercises.map((exercise) => {
            const state = dailyProgress.stateByExerciseId.get(exercise.id) ?? 'pending'
            const note = exercise.technicalNotes.trim()
            const isActive = activeExerciseId === exercise.id
            const loggedRows = isActive ? loggedRowsForExercise(exercise) : []

            return (
              <Card className={['content-auto p-2', isActive ? 'border-arsen-purple/45' : ''].join(' ')} key={exercise.id}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2">
                  <button
                    aria-expanded={isActive}
                    aria-label={`Ver series de ${exercise.name}`}
                    className="grid min-w-0 grid-cols-[52px_minmax(0,1fr)] items-center gap-4 text-left"
                    onClick={() => activateExercise(exercise)}
                    type="button"
                  >
                    <ExerciseArt
                      alt={exercise.name}
                      bundledAssetId={exercise.bundledAssetId}
                      className="size-[52px]"
                      customImageSrc={exercise.customAssetId ? imageSrcByAssetId.get(exercise.customAssetId) : null}
                      muscle={exercise.mainMuscle}
                    />
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-extrabold">{exercise.name}</h3>
                      <span className="mt-1 block truncate text-xs text-arsen-muted">
                        {exercise.mainMuscle} - {exercise.targetSets}x{formatRepRange(exercise.repsMin, exercise.repsMax)} - RIR {exercise.recommendedRir}
                      </span>
                    </div>
                  </button>
                  <span className={['rounded-full px-2 py-1 text-xs font-bold', stateClassName(state)].join(' ')}>
                    {stateLabel(state)}
                  </span>
                  {note ? (
                    <button
                      aria-label={`Ver indicaciones de ${exercise.name}`}
                      className="grid size-9 place-items-center rounded-[10px] border border-white/10 text-arsen-purple2"
                      onClick={() => setNoteSheetExercise(exercise)}
                      type="button"
                    >
                      <Info aria-hidden="true" className="size-4" />
                    </button>
                  ) : null}
                </div>

                {isActive ? (
                  <div className="mt-3 border-t border-white/10 pt-3">
                    <div className="mb-2 flex items-center justify-between text-xs font-extrabold">
                      <span className="text-arsen-muted">Series registradas</span>
                      <span className="text-arsen-purple2">{loggedRows.length}</span>
                    </div>
                    <div className="space-y-2">
                      {loggedRows.length > 0 ? (
                        loggedRows.map(({ dropSets, set }) => (
                          <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-[10px] border border-white/10 bg-arsen-bg/45 p-3" key={set.id}>
                            <div className="min-w-0">
                              <strong className="block truncate text-sm">Serie {set.order + 1}</strong>
                              <span className="mt-1 block text-xs text-arsen-muted">
                                Serie {set.order + 1} - {formatWeight(set.weightKg, preferredUnit)} - {set.reps} reps - RIR {set.rir}
                                {dropSets.length > 0 ? ` - ${dropSets.length} drop${dropSets.length === 1 ? '' : 's'}` : ''}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                aria-label={`Editar serie ${set.order + 1} de ${exercise.name}`}
                                className="grid size-9 place-items-center rounded-[10px] border border-white/10 text-arsen-purple2 disabled:opacity-40"
                                disabled={isPending}
                                onClick={() => setEditingSet({ exercise, set })}
                                type="button"
                              >
                                <Pencil aria-hidden="true" className="size-4" />
                              </button>
                              <button
                                aria-label={`Eliminar serie ${set.order + 1} de ${exercise.name}`}
                                className="grid size-9 place-items-center rounded-[10px] border border-red-300/30 text-red-300 disabled:opacity-40"
                                disabled={isPending}
                                onClick={() => deleteSet(set)}
                                type="button"
                              >
                                <Trash2 aria-hidden="true" className="size-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[10px] border border-white/10 bg-arsen-bg/45 p-3 text-sm text-arsen-muted">
                          Sin series registradas para este ejercicio.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </Card>
            )
          })}
          {visibleExercises.length === 0 ? <Card className="p-4 text-sm text-arsen-muted">Sin ejercicios para este filtro.</Card> : null}
        </div>
      </section>

      {selectedExercise && workoutDay ? (
        <RegisterSetSheet
          date={dateKey}
          dayId={workoutDay.day.id}
          displayUnit={workoutDay.settings.preferredUnit}
          exercise={selectedExercise}
          onClose={() => setSelectedExerciseId(null)}
          routineId={workoutDay.routine.id}
        />
      ) : null}

      {editingSet ? (
        <EditSetSheet
          disabled={isPending}
          dropSets={editingDropSets}
          onClose={() => setEditingSet(null)}
          onDelete={async () => {
            if (!(await confirmDanger('Eliminar serie', 'Se borrara esta serie y sus drop sets.'))) return false
            await deleteMainSet(editingSet.set.id)
            return true
          }}
          onSave={async (input) => {
            await updateMainSet(editingSet.set.id, input.main)
            await Promise.all(input.deletedDropSetIds.map((dropSetId) => deleteDropSet(dropSetId)))
            await Promise.all(
              input.drops.map((dropSet) =>
                dropSet.id
                  ? updateDropSet(dropSet.id, {
                      reps: dropSet.reps,
                      rir: dropSet.rir,
                      weightKg: dropSet.weightKg,
                    })
                  : addDropSet({
                      displayUnit: preferredUnit,
                      reps: dropSet.reps,
                      rir: dropSet.rir,
                      setLogId: editingSet.set.id,
                      weightKg: dropSet.weightKg,
                    }),
              ),
            )
          }}
          set={editingSet.set}
          unit={preferredUnit}
        />
      ) : null}

      {routineSheetOpen ? (
        <RoutineDaySheet
          activeDayId={workoutDay?.day.id ?? selectedDayId ?? ''}
          activeRoutineId={bundle?.routine.id ?? ''}
          days={days}
          disabled={isPending}
          onChangeDay={changeDay}
          onChangeRoutine={changeRoutine}
          onClose={() => setRoutineSheetOpen(false)}
          onContinueWithNextDay={() => {
            if (rotationStatus.nextDay) changeDay(rotationStatus.nextDay.id)
          }}
          nextDay={rotationStatus.nextDay}
          selectionChangeBlocked={hasOpenRegisteredSetsToday}
          routines={routines}
        />
      ) : null}

      {noteSheetExercise ? <ExerciseNotesSheet exercise={noteSheetExercise} onClose={() => setNoteSheetExercise(null)} /> : null}
    </div>
  )
}

const exerciseFilters: Array<{ label: string; value: ExerciseFilter }> = [
  { label: 'Todos', value: 'all' },
  { label: 'Pendientes', value: 'pending' },
  { label: 'En progreso', value: 'in_progress' },
  { label: 'Saltados', value: 'skipped' },
  { label: 'Hechos', value: 'done' },
]

const daySelectionStorageKey = 'arsen.workoutDaySelection.v1'
const missedNoticeDismissedStorageKey = 'arsen.missedTrainingNoticeDismissedDate.v1'

function readStoredDaySelection(date: string, routineId: string | undefined) {
  if (!routineId || typeof window === 'undefined') return null
  try {
    const parsed = JSON.parse(window.localStorage.getItem(daySelectionStorageKey) ?? 'null') as {
      date?: string
      selectionsByRoutineId?: Record<string, string>
    } | null
    if (parsed?.date !== date) return null
    return parsed.selectionsByRoutineId?.[routineId] ?? null
  } catch {
    return null
  }
}

function writeStoredDaySelection(date: string, routineId: string | undefined, dayId: string) {
  if (!routineId || typeof window === 'undefined') return
  const existing = (() => {
    try {
      return JSON.parse(window.localStorage.getItem(daySelectionStorageKey) ?? 'null') as {
        date?: string
        selectionsByRoutineId?: Record<string, string>
      } | null
    } catch {
      return null
    }
  })()
  const selectionsByRoutineId = existing?.date === date ? existing.selectionsByRoutineId ?? {} : {}
  window.localStorage.setItem(
    daySelectionStorageKey,
    JSON.stringify({ date, selectionsByRoutineId: { ...selectionsByRoutineId, [routineId]: dayId } }),
  )
}

function isMissedNoticeDismissed(date: string) {
  return typeof window !== 'undefined' && window.localStorage.getItem(missedNoticeDismissedStorageKey) === date
}

function dismissMissedNotice(date: string) {
  if (typeof window !== 'undefined') window.localStorage.setItem(missedNoticeDismissedStorageKey, date)
}

function buildWarmupsForExercise(exercise: RoutineExercise | null | undefined, unit: WeightUnit) {
  if (!exercise) return []

  return buildWarmupSets(exercise.currentWeightKg, exercise.warmupProtocol).map((set) => ({
    reps: set.reps,
    rir: set.rir,
    weight: formatWeight(set.weightKg, unit),
  }))
}

function blockedNavigation(isPending: boolean, isBlocked: boolean) {
  return isPending || isBlocked
}

function weekdayLabel(date: Date) {
  return new Intl.DateTimeFormat('es-MX', { weekday: 'long' }).format(date)
}

function formatShortWorkoutDate(date: string) {
  return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))
}
function stateLabel(state: ExerciseState) {
  const labels: Record<ExerciseState, string> = {
    done: 'Hecho',
    in_progress: 'En progreso',
    pending: 'Pendiente',
    skipped: 'Saltado',
  }

  return labels[state]
}

function stateClassName(state: ExerciseState) {
  const classes: Record<ExerciseState, string> = {
    done: 'bg-arsen-acid/20 text-arsen-acid',
    in_progress: 'bg-arsen-purple/25 text-arsen-purple2',
    pending: 'bg-white/10 text-arsen-muted',
    skipped: 'bg-white/5 text-arsen-dim',
  }

  return classes[state]
}

function SelectField({
  disabled,
  label,
  onChange,
  options,
  value,
}: {
  disabled?: boolean
  label: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-bold text-arsen-muted">{label}</span>
      <select
        className="min-h-11 w-full rounded-[10px] border border-white/10 bg-arsen-bg px-2 text-sm font-extrabold text-arsen-ink"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function RoutineDaySheet({
  activeDayId,
  activeRoutineId,
  days,
  disabled,
  nextDay,
  onChangeDay,
  onChangeRoutine,
  onClose,
  onContinueWithNextDay,
  selectionChangeBlocked,
  routines,
}: {
  activeDayId: string
  activeRoutineId: string
  days: RoutineDay[]
  disabled: boolean
  nextDay: RoutineDay | null
  onChangeDay: (dayId: string) => void
  onChangeRoutine: (routineId: string) => void
  onClose: () => void
  onContinueWithNextDay: () => void
  selectionChangeBlocked: boolean
  routines: Routine[]
}) {
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
      <button aria-label="Cerrar cambio de rutina" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative w-full rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black">Cambiar entreno</h2>
            <p className="mt-1 text-xs font-semibold text-arsen-muted">Rutina y dia para esta sesion.</p>
          </div>
          <button className="grid size-9 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>

        <Card className="space-y-3 p-3">
          <SelectField
            disabled={disabled || selectionChangeBlocked}
            label="Rutina activa"
            onChange={onChangeRoutine}
            options={routines.map((routine) => ({ label: routine.name, value: routine.id }))}
            value={activeRoutineId}
          />
          {selectionChangeBlocked ? (
            <div className="rounded-[10px] border border-arsen-acid/35 bg-arsen-acid/10 p-3 text-xs font-semibold text-arsen-ink">
              <strong className="block text-arsen-acid">No puedes cambiar este entreno.</strong>
              <span className="mt-1 block text-arsen-muted">
                La sesion de hoy ya tiene series registradas. Finaliza o elimina esas series antes de cambiar la rutina o el dia.
              </span>
            </div>
          ) : null}
          <SelectField
            disabled={disabled || days.length === 0 || selectionChangeBlocked}
            label="Dia de entrenamiento"
            onChange={onChangeDay}
            options={days.map((day) => ({ label: day.name, value: day.id }))}
            value={activeDayId}
          />
          <ActionButton className="w-full" disabled={disabled || !nextDay || selectionChangeBlocked} onClick={onContinueWithNextDay} tone="ghost" type="button">
            Continuar con el siguiente dia
          </ActionButton>
        </Card>
      </section>
    </div>
  )
}

function ExerciseNotesSheet({ exercise, onClose }: { exercise: RoutineExercise; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
      <button aria-label="Cerrar indicaciones" className="absolute inset-0 cursor-default" onClick={onClose} type="button" />
      <section className="relative max-h-[65vh] w-full overflow-y-auto rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 p-4 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]">
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black">Indicaciones</h2>
            <p className="mt-1 truncate text-xs font-semibold text-arsen-muted">{exercise.name}</p>
          </div>
          <button className="grid size-9 shrink-0 place-items-center rounded-[10px] text-arsen-muted" onClick={onClose} type="button">
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Cerrar</span>
          </button>
        </div>
        <Card className="p-3 text-sm leading-relaxed text-arsen-ink">
          <p className="whitespace-pre-wrap">{exercise.technicalNotes}</p>
        </Card>
      </section>
    </div>
  )
}

function LastSessionReferenceBlock({
  reference,
  unit,
}: {
  reference: LastSessionReference | undefined
  unit: WeightUnit
}) {
  return (
    <section className="mb-3 rounded-[10px] border border-dashed border-arsen-purple/35 bg-arsen-bg/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <strong className="block text-xs font-extrabold text-arsen-purple2">Ultima sesion</strong>
          <span className="mt-0.5 block text-xs text-arsen-muted">
            {reference ? formatShortWorkoutDate(reference.date) : 'Sin historial previo'}
          </span>
        </div>
        <span className="shrink-0 rounded-full border border-arsen-purple/35 bg-arsen-purple/15 px-2 py-1 text-xs font-extrabold text-arsen-purple2">
          Referencia
        </span>
      </div>
      {reference ? (
        <div className="space-y-2">
          {reference.sets.length > 0 ? (
            reference.sets.map(({ dropSets, set }) => (
              <div className="rounded-[9px] border border-white/10 bg-arsen-surface/55 p-2" key={set.id}>
                <div className="text-xs font-semibold text-arsen-ink">
                  Serie {set.order + 1} - {formatWeight(set.weightKg, unit)} - {set.reps} reps - RIR {set.rir}
                </div>
                {dropSets.length > 0 ? (
                  <div className="mt-2 space-y-1 border-l border-arsen-purple/30 pl-2">
                    {dropSets.map((dropSet) => (
                      <div className="text-xs text-arsen-muted" key={dropSet.id}>
                        Drop {dropSet.order + 1} - {formatWeight(dropSet.weightKg, unit)} - {dropSet.reps} reps - RIR {dropSet.rir}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-[9px] border border-white/10 bg-arsen-surface/55 p-2 text-xs text-arsen-muted">
              Sin series principales registradas esa vez.
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-[9px] border border-white/10 bg-arsen-surface/55 p-2 text-xs text-arsen-muted">
          Primera vez con este ejercicio en este dia
        </div>
      )}
    </section>
  )
}
function WeightIncreaseCard({
  recommendations,
  unit,
}: {
  recommendations: WeightIncreaseRecommendation[]
  unit: WeightUnit
}) {
  if (recommendations.length === 0) return null

  return (
    <Card className="border-arsen-acid/35 p-3">
      <div className="flex items-center gap-2">
        <TrendingUp aria-hidden="true" className="size-5 text-arsen-acid" />
        <div>
          <strong className="block text-sm text-arsen-acid">Listo para subir peso</strong>
          <span className="text-xs text-arsen-muted">{recommendations.length} recomendacion activa</span>
        </div>
      </div>
      <div className="mt-3 space-y-2">
        {recommendations.slice(0, 3).map((recommendation) => (
          <div className="rounded-[10px] border border-white/10 bg-arsen-bg/55 p-2" key={recommendation.exerciseId}>
            <div className="flex items-center justify-between gap-2">
              <strong className="truncate text-sm">{recommendation.exerciseName}</strong>
              <span className="shrink-0 text-xs font-extrabold text-arsen-acid">{recommendation.suggestedIncreaseLabel}</span>
            </div>
            <p className="mt-1 text-xs text-arsen-muted">
              Actual {formatWeight(recommendation.currentWeightKg, unit)} - {recommendation.reason}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

function MissedTrainingNotice({
  daysWithoutTraining,
  nextDay,
  onDismiss,
  onResume,
}: {
  daysWithoutTraining: number
  nextDay: RoutineDay | null
  onDismiss: () => void
  onResume: () => void
}) {
  return (
    <Card className="border-arsen-acid/35 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <strong className="block text-sm text-arsen-acid">
            {daysWithoutTraining > 0 ? `Llevas ${daysWithoutTraining} dias sin entrenar` : 'Tienes un dia programado pendiente'}
          </strong>
          <span className="mt-1 block text-xs text-arsen-muted">Retoma tu rotacion sin perseguir el calendario.</span>
        </div>
        <button
          aria-label="Descartar aviso de dias faltantes"
          className="grid size-8 shrink-0 place-items-center rounded-[9px] text-arsen-muted"
          onClick={onDismiss}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <ActionButton className="mt-3 w-full" disabled={!nextDay} onClick={onResume} tone="acid" type="button">
        Retomar {nextDay?.name ?? 'siguiente dia'}
      </ActionButton>
    </Card>
  )
}
