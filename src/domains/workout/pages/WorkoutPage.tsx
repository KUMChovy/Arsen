import { ArrowDownUp, Check, ChevronDown, ChevronLeft, ChevronRight, Dumbbell, Info, Moon, MoreVertical, Pencil, Repeat2, RotateCcw, SkipForward, Trash2, TrendingUp, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { ActionButton } from '../../../shared/components/ActionButton'
import { Card } from '../../../shared/components/Card'
import { ExerciseArt } from '../../../shared/components/ExerciseArt'
import { PageHeader } from '../../../shared/components/PageHeader'
import { useDialogFocus } from '../../../shared/components/useDialogFocus'
import type { WeightIncreaseRecommendation } from '../../../shared/calculations/progression'
import { buildEquipmentLoadNote } from '../../../shared/calculations/equipmentLoad'
import { totalVolume } from '../../../shared/calculations/workout'
import { buildWarmupSets } from '../../../shared/calculations/warmups'
import { getDeloadSuggestedWeightKg, getDeloadTargetSets } from '../../../shared/calculations/deload'
import { localDateKey } from '../../../shared/utils/date'
import { confirmDanger } from '../../../shared/utils/alerts'
import { formatRepRange } from '../../../shared/utils/reps'
import { formatRestSeconds } from '../../../shared/utils/time'
import { formatWeight } from '../../../shared/utils/weight'
import { createId } from '../../../shared/utils/id'
import { useActiveRoutineBundle, useExerciseAssets, useExerciseCatalog, useRoutines, useWorkoutDayById } from '../../routine/hooks'
import type { Routine, RoutineDay, RoutineExercise } from '../../routine/types'
import { RegisterSetSheet } from '../components/RegisterSetSheet'
import { EditSetSheet } from '../components/EditSetSheet'
import { getDefaultWorkoutDayId } from '../calculations/trainingRotation'
import { useDeloadOverview, useLastSessionReferencesForDay, usePendingWorkoutSessions, useWeightIncreaseRecommendations, useWorkoutProgress, useWorkoutRotationStatus } from '../hooks'
import { completeSessionForDay, deleteMainSet, reactivateExercise, registerWarmupForExercise, skipRoutineExerciseForDay, updateExerciseNotesForDay, updateSessionExercisePlan, updateSessionNotesForDay, updateSetWithDrops } from '../services'
import { setActiveRoutine } from '../../routine/services'
import { completeActiveDeload } from '../../settings/services'
import { getAppSettings } from '../../settings/services'
import type { DeloadOverview } from '../../settings/types'
import { HealthSummaryCard } from '../../health/components/HealthSummaryCard'
import { syncAllWorkoutHealth } from '../../health/services'
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
  const todayKey = useMemo(() => localDateKey(today), [today])
  const [dateKey, setDateKey] = useState(todayKey)
  const selectedDate = useMemo(() => new Date(`${dateKey}T12:00:00`), [dateKey])
  const bundle = useActiveRoutineBundle()
  const exerciseAssets = useExerciseAssets() ?? []
  const exerciseCatalog = useExerciseCatalog() ?? []
  const imageSrcByAssetId = useMemo(() => new Map(exerciseAssets.map((asset) => [asset.id, asset.dataUrl])), [exerciseAssets])
  const routines = useRoutines() ?? []
  const pendingSessions = usePendingWorkoutSessions()
  const days = bundle?.days ?? []
  const activeRoutineId = bundle?.routine.id
  const defaultDayId = getDefaultWorkoutDayId(days, selectedDate.getDay())
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const workoutDay = useWorkoutDayById(selectedDayId)
  const routineExercises = workoutDay?.dayExercises ?? []
  const dailyProgress = useWorkoutProgress(dateKey, workoutDay?.day.id, routineExercises)
  const dayExercises = dailyProgress.progress?.session?.sessionExercises ?? routineExercises
  const appSettings = useLiveQuery(() => getAppSettings(), [], undefined)
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
  const deload = useDeloadOverview()
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null)
  const [duplicateSet, setDuplicateSet] = useState<SetLog | null>(null)
  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(null)
  const [activeExerciseId, setActiveExerciseId] = useState<string | null | undefined>(undefined)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const optionsRef = useDialogFocus(() => setOptionsOpen(false), optionsOpen)
  const [exerciseFilter, setExerciseFilter] = useState<ExerciseFilter>('all')
  const [editingSet, setEditingSet] = useState<{ exercise: RoutineExercise; set: SetLog } | null>(null)
  const [noteSheetExercise, setNoteSheetExercise] = useState<RoutineExercise | null>(null)
  const [routineSheetOpen, setRoutineSheetOpen] = useState(false)
  const [resumeTarget, setResumeTarget] = useState<{ routineId: string; dayId: string; date: string } | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const reviewRef = useDialogFocus(() => setReviewOpen(false), reviewOpen)
  const [catalogExerciseId, setCatalogExerciseId] = useState('')
  const [lastSelectionChange, setLastSelectionChange] = useState<SelectionSnapshot | null>(null)
  const [missedNoticeDismissed, setMissedNoticeDismissed] = useState(() => isMissedNoticeDismissed(dateKey))
  const [isPending, startTransition] = useTransition()
  const [actionBusy, setActionBusy] = useState(false)
  const actionPending = useRef(false)
  const [message, setMessage] = useState<string | null>(null)
  const healthEnabled = appSettings?.healthIntegrationEnabled === true
  const navigableExercises = dayExercises
  const currentExercise = navigableExercises.find((exercise) => exercise.id === currentExerciseId) ?? navigableExercises[0] ?? null
  const currentExerciseIndex = currentExercise ? navigableExercises.findIndex((exercise) => exercise.id === currentExercise.id) : -1
  const selectedExercise = selectedExerciseId ? dayExercises.find((exercise) => exercise.id === selectedExerciseId) : null
  const currentExerciseRecommendations = currentExercise
    ? weightIncreaseRecommendations.filter((recommendation) => recommendation.exerciseId === currentExercise.id)
    : []
  const completedCount = dailyProgress.completedCount
  const totalCount = dayExercises.length
  const preferredUnit = workoutDay?.settings.preferredUnit ?? 'kg'
  const deloadActive = deload?.phase === 'active'
  const currentDeloadWeightKg = currentExercise
    ? getDeloadSuggestedWeightKg(currentExercise.currentWeightKg, deload?.weightReductionPercent ?? 80)
    : 0
  const currentDeloadTargetSets = currentExercise
    ? getDeloadTargetSets(currentExercise.targetSets, deload?.seriesReductionPercent ?? 50)
    : 0
  const currentTargetWeightKg = deloadActive ? currentDeloadWeightKg : currentExercise?.currentWeightKg ?? 0
  const currentTargetSets = deloadActive ? currentDeloadTargetSets : currentExercise?.targetSets ?? 0
  const availablePlateWeightsKg = workoutDay?.settings.availablePlateWeightsKg
  const selectedWeekday = workoutDay?.day.weekday
  const isOffCalendar = selectedWeekday !== undefined && selectedWeekday !== null && selectedWeekday !== selectedDate.getDay()
  const warmups = buildWarmupsForExercise(currentExercise, preferredUnit, currentTargetWeightKg)
  const currentLoadNote = currentExercise
    ? buildEquipmentLoadNote({
        availablePlateWeightsKg,
        barWeightKg: currentExercise.barWeightKg,
        equipment: currentExercise.equipment,
        loadMode: currentExercise.loadMode,
        unit: preferredUnit,
        weightKg: currentTargetWeightKg,
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
    if (resumeTarget) return
    if (selectedDayId && days.some((day) => day.id === selectedDayId)) return
    const storedDayId = readStoredDaySelection(dateKey, activeRoutineId)
    setSelectedDayId(storedDayId && days.some((day) => day.id === storedDayId) ? storedDayId : defaultDayId)
  }, [activeRoutineId, dateKey, days, defaultDayId, selectedDayId, resumeTarget])

  useEffect(() => {
    if (!resumeTarget || activeRoutineId !== resumeTarget.routineId || !days.some((day) => day.id === resumeTarget.dayId)) return
    setDateKey(resumeTarget.date)
    setSelectedDayId(resumeTarget.dayId)
    setCurrentExerciseId(null)
    setActiveExerciseId(null)
    writeStoredDaySelection(resumeTarget.date, resumeTarget.routineId, resumeTarget.dayId)
    setResumeTarget(null)
  }, [activeRoutineId, days, resumeTarget])

  useEffect(() => {
    if (currentExerciseId && navigableExercises.some((exercise) => exercise.id === currentExerciseId)) return
    setCurrentExerciseId(navigableExercises[0]?.id ?? null)
  }, [currentExerciseId, navigableExercises])

  useEffect(() => {
    if (activeExerciseId === null) return
    if (activeExerciseId && dayExercises.some((exercise) => exercise.id === activeExerciseId)) return
    setActiveExerciseId(currentExercise?.id ?? dayExercises[0]?.id ?? null)
  }, [activeExerciseId, currentExercise?.id, dayExercises])

  useEffect(() => {
    setOptionsOpen(false)
  }, [currentExercise?.id])

  useEffect(() => {
    setMissedNoticeDismissed(isMissedNoticeDismissed(dateKey))
  }, [dateKey])

  function runSetAction(action: () => Promise<void>, success: string) {
    if (actionPending.current) return
    actionPending.current = true
    setActionBusy(true)
    startTransition(() => {
      action()
        .then(() => setMessage(success))
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'Accion no completada'))
        .finally(() => { actionPending.current = false; setActionBusy(false) })
    })
  }

  function finishDeload() {
    startTransition(() => {
      completeActiveDeload()
        .then(() => setMessage('Deload finalizado'))
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo finalizar deload'))
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
        .then(() => { setReviewOpen(false); setMessage('Sesion finalizada') })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo finalizar'))
    })
  }

  function syncHealth() {
    // Entreno dispara la sincronización manual de todas las sesiones que Health Connect pueda leer.
    startTransition(() => {
      syncAllWorkoutHealth()
        .then(({ syncedSessions }) => {
          setMessage(syncedSessions > 0 ? `Salud sincronizada en ${syncedSessions} ${syncedSessions === 1 ? 'sesión' : 'sesiones'}` : 'No hay sesiones para sincronizar')
        })
        .catch((error: unknown) => setMessage(error instanceof Error ? error.message : 'No se pudo sincronizar salud'))
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

  function goToNextExercise() {
    const nextExerciseId = navigableExercises[currentExerciseIndex + 1]?.id
    if (!nextExerciseId) return
    setCurrentExerciseId(nextExerciseId)
    setActiveExerciseId(nextExerciseId)
  }

  function continueSession(session: { routineId: string; dayId: string; date: string }) {
    if (hasOpenRegisteredSetsToday || isPending) return
    setResumeTarget(session)
    if (session.routineId !== activeRoutineId) startTransition(() => { setActiveRoutine(session.routineId).catch((error: unknown) => { setResumeTarget(null); setMessage(error instanceof Error ? error.message : 'No se pudo continuar la sesión') }) })
  }

  function moveCurrentExercise(offset: number) {
    if (!workoutDay || currentExerciseIndex < 0) return
    const nextIndex = currentExerciseIndex + offset
    if (nextIndex < 0 || nextIndex >= dayExercises.length) return
    const reordered = [...dayExercises]
    const [moving] = reordered.splice(currentExerciseIndex, 1)
    if (!moving) return
    reordered.splice(nextIndex, 0, moving)
    runSetAction(async () => { await updateSessionExercisePlan({ date: dateKey, dayId: workoutDay.day.id, displayUnit: preferredUnit, exercises: reordered, routineId: workoutDay.routine.id }) }, 'Orden de sesión actualizado')
  }

  async function addSessionExercise(replace: boolean) {
    if (!workoutDay) return
    const item = exerciseCatalog.find((candidate) => candidate.id === catalogExerciseId)
    if (!item || (replace && !currentExercise)) return
    const hasExistingLog = !!currentExercise && dailyProgress.exerciseLogByExerciseId.has(currentExercise.id)
    if (replace && hasExistingLog && !(await confirmDanger('Sustituir ejercicio', 'El ejercicio original y sus registros seguirán disponibles en la sesión.'))) return
    const now = new Date().toISOString()
    const added: RoutineExercise = {
      id: createId('session-exercise'), routineId: workoutDay.routine.id, dayId: workoutDay.day.id,
      sourceExerciseId: item.id, name: item.name, canonicalName: item.canonicalName, mainMuscle: item.mainMuscle,
      equipment: item.equipment, loadMode: item.loadMode, barWeightKg: item.barWeightKg,
      assetKind: item.assetKind, bundledAssetId: item.bundledAssetId, customAssetId: item.customAssetId,
      targetSets: item.defaultTargetSets, repsMin: item.defaultRepsMin, repsMax: item.defaultRepsMax,
      recommendedRir: item.defaultRecommendedRir, restSeconds: item.defaultRestSeconds, rest: formatRestSeconds(item.defaultRestSeconds),
      warmupProtocol: item.warmupProtocol, warmupSets: 0, technicalNotes: item.technicalNotes,
      currentWeightKg: 0, order: dayExercises.length, createdAt: now, updatedAt: now,
    }
    const next = [...dayExercises]
    if (replace) next.splice(currentExerciseIndex, hasExistingLog ? 0 : 1, added)
    else next.push(added)
    runSetAction(async () => { await updateSessionExercisePlan({ date: dateKey, dayId: workoutDay.day.id, displayUnit: preferredUnit, exercises: next, routineId: workoutDay.routine.id }) }, replace ? 'Ejercicio sustituido en la sesión' : 'Ejercicio agregado a la sesión')
  }

  function skipCurrentExercise() {
    if (!currentExercise || !workoutDay) return
    const nextExerciseId = navigableExercises[currentExerciseIndex + 1]?.id ?? navigableExercises[currentExerciseIndex - 1]?.id ?? null
    runSetAction(async () => {
      await skipRoutineExerciseForDay({
        date: dateKey,
        dayId: workoutDay.day.id,
        displayUnit: workoutDay.settings.preferredUnit,
        exercise: currentExercise,
        routineId: workoutDay.routine.id,
      })
      setCurrentExerciseId(nextExerciseId)
      setActiveExerciseId(nextExerciseId)
    }, 'Ejercicio saltado')
  }

  function activateExercise(exercise: RoutineExercise) {
    setActiveExerciseId((activeId) => activeId === exercise.id ? null : exercise.id)
    setCurrentExerciseId(exercise.id)
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
      <PageHeader eyebrow={`${weekdayLabel(selectedDate)} - ${workoutDay?.day.name ?? 'Cargando'} - ${dailyProgress.progress?.session ? dailyProgress.progress.session.status === 'completed' ? 'sesión finalizada' : 'sesión en curso' : 'preparación'}`} title="Entreno de hoy">
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

      {dateKey !== todayKey ? <div className="rounded-[10px] border border-arsen-purple/40 p-3 text-sm">Sesión del {dateKey}<button className="ml-3 min-h-12 font-bold text-arsen-purple2 disabled:opacity-40" disabled={hasOpenRegisteredSetsToday || isPending} onClick={() => setDateKey(todayKey)} type="button">Volver a hoy</button></div> : null}
      {pendingSessions.filter((session) => session.date !== dateKey).map((session) => <button className="min-h-12 w-full rounded-[10px] border border-arsen-purple/40 p-3 text-left text-sm font-bold text-arsen-purple2 disabled:opacity-40" disabled={hasOpenRegisteredSetsToday || isPending} key={session.id} onClick={() => continueSession(session)} type="button">Continuar sesión del {session.date}</button>)}

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

      {deloadActive ? (
        <DeloadStatusCard deload={deload} disabled={isPending} onComplete={finishDeload} />
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
          <div className="grid grid-cols-[48px_56px_minmax(0,1fr)_48px] items-center gap-2 border-b border-white/10 pb-4">
            <button
              aria-label="Regresar al ejercicio anterior"
              className="grid size-12 place-items-center rounded-[10px] text-arsen-muted transition-colors enabled:hover:bg-white/5 enabled:hover:text-arsen-purple2 disabled:opacity-30"
              disabled={blockedNavigation(isPending, currentExerciseIndex <= 0)}
              onClick={goToPreviousExercise}
              type="button"
            >
              <ChevronLeft aria-hidden="true" className="size-6" />
            </button>
            <div className="grid size-14 place-items-center overflow-hidden rounded-[14px] border border-arsen-purple/45 bg-arsen-purple/10 p-1">
              <ExerciseArt
                alt={currentExercise?.name ?? 'Ejercicio'}
                bundledAssetId={currentExercise?.bundledAssetId}
                className="size-12"
                customImageSrc={currentExercise?.customAssetId ? imageSrcByAssetId.get(currentExercise.customAssetId) : null}
                muscle={currentExercise?.mainMuscle}
              />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[22px] font-black leading-tight">{currentExercise?.name ?? 'Sin ejercicio pendiente'}</h2>
            </div>
            <button
              aria-label="Ir al siguiente ejercicio"
              className="grid size-12 place-items-center rounded-[10px] text-arsen-ink transition-colors enabled:hover:bg-white/5 enabled:hover:text-arsen-purple2 disabled:opacity-30"
              disabled={blockedNavigation(isPending, currentExerciseIndex < 0 || currentExerciseIndex >= navigableExercises.length - 1)}
              onClick={goToNextExercise}
              type="button"
            >
              <ChevronRight aria-hidden="true" className="size-6" />
            </button>
            <div className="col-span-full flex flex-wrap items-center justify-end gap-2">
              <span className="mr-auto inline-flex rounded-full bg-arsen-purple/30 px-2 py-1 text-xs font-bold text-arsen-purple2">
                {currentExercise?.mainMuscle ?? 'Descanso'}
              </span>
              {currentExercise?.technicalNotes.trim() ? (
                <button
                  aria-label={`Ver indicaciones de ${currentExercise.name}`}
                  className="grid size-12 shrink-0 place-items-center rounded-[9px] border border-white/10 text-arsen-purple2"
                  onClick={() => setNoteSheetExercise(currentExercise)}
                  type="button"
                >
                  <Info aria-hidden="true" className="size-4" />
                </button>
              ) : null}
              {currentExercise ? (
                <button
                  aria-controls="current-exercise-options"
                  aria-expanded={optionsOpen}
                  aria-haspopup="dialog"
                  aria-label={`Opciones de ${currentExercise.name}`}
                  className="grid size-12 shrink-0 place-items-center rounded-[9px] border border-white/10 text-arsen-purple2"
                  onClick={(event) => { event.currentTarget.focus(); setOptionsOpen((open) => !open) }}
                  type="button"
                >
                  <MoreVertical aria-hidden="true" className="size-5" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-0 py-3 text-center">
            {[
              [deloadActive ? 'Peso deload' : 'Peso anterior', formatWeight(currentTargetWeightKg, preferredUnit), 'text-arsen-acid'],
              [deloadActive ? 'Series deload' : 'Series', `${currentExercise ? loggedRowsForExercise(currentExercise).length : 0} / ${currentTargetSets}`, 'text-arsen-ink'],
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

          {currentExercise ? <div className="mb-3 space-y-1" aria-label="Series del ejercicio actual">
            {loggedRowsForExercise(currentExercise).map(({ set, dropSets }) => <p className="rounded-[10px] bg-arsen-surface2 p-2 text-sm" key={set.id}>Serie {set.order + 1} - {formatWeight(set.weightKg, preferredUnit)} - {set.reps} reps - RIR {set.rir}{dropSets.length ? ` - ${dropSets.length} drop${dropSets.length === 1 ? '' : 's'}` : ''}</p>)}
          </div> : null}

          {currentExercise && workoutDay ? <details className="my-3" key={`${currentExercise.id}:${dailyProgress.exerciseLogByExerciseId.get(currentExercise.id)?.id ?? ''}`}>
            <summary className="cursor-pointer py-2 text-sm font-bold text-arsen-muted">Nota del ejercicio</summary>
            <form onSubmit={(event) => {
              event.preventDefault()
              const notes = String(new FormData(event.currentTarget).get('notes') ?? '')
              runSetAction(async () => { await updateExerciseNotesForDay({ date: dateKey, dayId: workoutDay.day.id, displayUnit: preferredUnit, exercise: currentExercise, notes, routineId: workoutDay.routine.id }) }, 'Nota guardada')
            }}>
              <label className="block text-sm text-arsen-muted">Nota del ejercicio
                <textarea className="mt-1 min-h-20 w-full rounded-[10px] border border-white/10 bg-arsen-surface2 p-3 text-arsen-ink" defaultValue={dailyProgress.exerciseLogByExerciseId.get(currentExercise.id)?.notes ?? ''} name="notes" />
              </label>
              <button className="min-h-12 text-sm font-bold text-arsen-purple2" disabled={isPending} type="submit">Guardar nota del ejercicio</button>
            </form>
          </details> : null}

          <ActionButton className="w-full" disabled={!currentExercise} onClick={() => setSelectedExerciseId(currentExercise?.id ?? null)}>
            Registrar
            <ChevronRight aria-hidden="true" className="size-5" />
          </ActionButton>
          {currentExercise && loggedRowsForExercise(currentExercise).length > 0 ? <button className="mt-2 min-h-12 w-full rounded-[10px] border border-white/10 text-sm font-bold text-arsen-purple2" onClick={() => setSelectedExerciseId(currentExercise.id)} type="button">Repetir última serie</button> : null}
        </Card>
      </div>

      {optionsOpen && currentExercise ? (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/65">
          <button aria-label="Cerrar panel de opciones" className="absolute inset-0 cursor-default" onClick={() => setOptionsOpen(false)} type="button" />
          <section aria-labelledby="exercise-options-title" aria-modal="true" className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-[22px] border-t border-white/10 bg-arsen-bg2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_40px_rgb(0_0_0_/_0.35)]" id="current-exercise-options" ref={optionsRef} role="dialog" tabIndex={-1}>
            <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/25" />
            <div className="mb-5 flex items-start gap-3">
              <div className="grid size-12 shrink-0 place-items-center rounded-[12px] bg-arsen-purple/20 text-arsen-purple2"><Dumbbell aria-hidden="true" className="size-5" /></div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black" id="exercise-options-title">Opciones del ejercicio</h2>
                <p className="mt-1 break-words text-sm text-arsen-muted">{currentExercise.name}</p>
              </div>
              <button aria-label="Cerrar opciones del ejercicio" className="grid size-12 shrink-0 place-items-center rounded-[10px] border border-white/10 text-arsen-muted" onClick={() => setOptionsOpen(false)} type="button"><X aria-hidden="true" className="size-5" /></button>
            </div>
            <div className="space-y-3">
              {dailyProgress.stateByExerciseId.get(currentExercise.id) === 'skipped' && dailyProgress.progress?.session ? (
                <button aria-label="Restaurar ejercicio" className="flex min-h-16 w-full items-center gap-3 rounded-[12px] border border-arsen-acid/30 bg-arsen-acid/10 p-3 text-left disabled:opacity-40" disabled={isPending || actionBusy} onClick={() => runSetAction(() => reactivateExercise(dailyProgress.progress!.session!.id, currentExercise.id), 'Ejercicio restaurado')} type="button">
                  <RotateCcw aria-hidden="true" className="size-5 shrink-0 text-arsen-acid" /><span><strong className="block text-sm text-arsen-ink">Restaurar ejercicio</strong><span className="block text-xs text-arsen-muted">Volver a incluirlo en tu entreno</span></span>
                </button>
              ) : (
                <button aria-label="Omitir ejercicio" className="flex min-h-16 w-full items-center gap-3 rounded-[12px] border border-white/10 bg-arsen-surface p-3 text-left disabled:opacity-40" disabled={isPending || actionBusy} onClick={skipCurrentExercise} type="button">
                  <SkipForward aria-hidden="true" className="size-5 shrink-0 text-arsen-purple2" /><span><strong className="block text-sm text-arsen-ink">Omitir ejercicio</strong><span className="block text-xs text-arsen-muted">Puedes restaurarlo después</span></span>
                </button>
              )}
              <details className="group rounded-[12px] border border-white/10 bg-arsen-surface">
                <summary className="flex min-h-16 cursor-pointer items-center gap-3 p-3"><ArrowDownUp aria-hidden="true" className="size-5 shrink-0 text-arsen-purple2" /><span className="min-w-0 flex-1"><strong className="block text-sm text-arsen-ink">Orden de esta sesión</strong><span className="block text-xs text-arsen-muted">Cambia cuándo lo entrenas</span></span><ChevronDown aria-hidden="true" className="size-5 shrink-0 text-arsen-muted group-open:rotate-180" /></summary>
                <div className="flex gap-2 px-3 pb-3">
                  <button className="min-h-12 flex-1 rounded-[10px] border border-white/10 px-2 text-sm font-bold text-arsen-ink disabled:opacity-40" disabled={isPending || actionBusy || currentExerciseIndex <= 0} onClick={() => moveCurrentExercise(-1)} type="button">Mover ejercicio antes</button>
                  <button className="min-h-12 flex-1 rounded-[10px] border border-white/10 px-2 text-sm font-bold text-arsen-ink disabled:opacity-40" disabled={isPending || actionBusy || currentExerciseIndex < 0 || currentExerciseIndex >= dayExercises.length - 1} onClick={() => moveCurrentExercise(1)} type="button">Mover ejercicio después</button>
                </div>
              </details>
              <details className="group rounded-[12px] border border-white/10 bg-arsen-surface">
                <summary className="flex min-h-16 cursor-pointer items-center gap-3 p-3"><Repeat2 aria-hidden="true" className="size-5 shrink-0 text-arsen-purple2" /><span className="min-w-0 flex-1"><strong className="block text-sm text-arsen-ink">Adaptar esta sesión</strong><span className="block text-xs text-arsen-muted">Agrega o sustituye un ejercicio</span></span><ChevronDown aria-hidden="true" className="size-5 shrink-0 text-arsen-muted group-open:rotate-180" /></summary>
                <div className="space-y-3 px-3 pb-3">
                  <label className="block text-xs font-bold text-arsen-muted">Ejercicio del catálogo
                    <select className="mt-1 min-h-12 w-full rounded-[10px] border border-white/10 bg-arsen-surface2 px-3 text-base text-arsen-ink" value={catalogExerciseId} onChange={(event) => setCatalogExerciseId(event.target.value)}>
                      <option value="">Selecciona un ejercicio</option>
                      {exerciseCatalog.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
                    <button className="min-h-12 rounded-[10px] bg-arsen-purple px-2 text-sm font-bold text-arsen-ink disabled:opacity-40" disabled={!catalogExerciseId || isPending || actionBusy} onClick={() => void addSessionExercise(false)} type="button">Agregar a esta sesión</button>
                    <button className="min-h-12 rounded-[10px] border border-white/10 px-2 text-sm font-bold text-arsen-ink disabled:opacity-40" disabled={!catalogExerciseId || isPending || actionBusy} onClick={() => void addSessionExercise(true)} type="button">Sustituir ejercicio</button>
                  </div>
                </div>
              </details>
            </div>
          </section>
        </div>
      ) : null}

      <details>
        <summary className="mb-2 flex min-h-12 cursor-pointer items-center justify-between text-xs font-extrabold">
          <span className="text-arsen-muted">Calentamiento</span>
          <span className="text-arsen-purple2">{warmups.length} series</span>
        </summary>
        <div className="space-y-2">
          {warmups.map((set, index) => (
            <Card className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 p-3 text-sm" key={`${set.weight}-${index}`}>
              <span className="grid size-6 place-items-center rounded-full border border-white/15 text-xs text-arsen-muted">
                {index + 1}
              </span>
              <span className="min-w-0"><strong className="text-arsen-acid">{set.weight}</strong> · {set.reps} reps · RIR {set.rir}</span>
              <button aria-label={`Registrar calentamiento ${index + 1}`} className="min-h-12 px-2 text-xs font-bold text-arsen-purple2 disabled:opacity-40" disabled={isPending || actionBusy || !currentExercise || !workoutDay} onClick={() => {
                if (!currentExercise || !workoutDay) return
                runSetAction(async () => { await registerWarmupForExercise({ date: dateKey, dayId: workoutDay.day.id, displayUnit: preferredUnit, exercise: currentExercise, reps: set.reps, rir: set.rir, routineId: workoutDay.routine.id, weightKg: set.weightKg }) }, 'Calentamiento registrado')
              }} type="button">Registrar</button>
            </Card>
          ))}
          {currentExercise ? dailyProgress.setLogs.filter((set) => set.kind === 'warmup' && set.exerciseLogId === dailyProgress.exerciseLogByExerciseId.get(currentExercise.id)?.id).sort((a, b) => a.order - b.order).map((set) => (
            <div className="flex items-center justify-between gap-2 rounded-[10px] border border-white/10 p-3 text-sm" key={set.id}>
              <span>Calentamiento {set.order + 1}: {formatWeight(set.weightKg, preferredUnit)} · {set.reps} reps · RIR {set.rir}</span>
              <button aria-label={`Editar calentamiento ${set.order + 1}`} className="min-h-12 min-w-12 text-arsen-purple2" onClick={() => setEditingSet({ exercise: currentExercise, set })} type="button"><Pencil aria-hidden="true" className="mx-auto size-4" /></button>
            </div>
          )) : null}
        </div>
      </details>

      {healthEnabled ? (
        // La tarjeta consume el resumen persistido de la sesión actual y ofrece el botón de lectura.
        <HealthSummaryCard
          currentExerciseId={currentExercise ? dailyProgress.exerciseLogByExerciseId.get(currentExercise.id)?.id : null}
          currentExerciseName={currentExercise?.name}
          disabled={isPending}
          onSync={syncHealth}
          summary={dailyProgress.progress?.session?.health}
        />
      ) : null}

      <WeightIncreaseCard recommendations={currentExerciseRecommendations} unit={preferredUnit} />

      {message ? (
        <div className="rounded-[10px] border border-arsen-purple/40 bg-arsen-purple/15 px-3 py-2 text-xs text-arsen-purple2" role="status">
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
        <ActionButton className="mt-3 w-full" disabled={isPending || !workoutDay} onClick={() => setReviewOpen(true)} tone="ghost">
          <Check aria-hidden="true" className="size-5" />
          Finalizar sesion
        </ActionButton>
      </Card>

      {reviewOpen && workoutDay ? <div className="fixed inset-0 z-50 mx-auto flex max-w-[430px] items-end bg-black/55">
        <section aria-labelledby="workout-review-title" aria-modal="true" className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-[22px] bg-arsen-bg2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" ref={reviewRef} role="dialog" tabIndex={-1}>
          <h2 className="text-xl font-black" id="workout-review-title">Revisar entrenamiento</h2>
          <p className="mt-2 text-sm text-arsen-muted">{workoutDay.routine.name} · {workoutDay.day.name}</p>
          <p className="mt-2 text-sm">{mainSets.length} series principales · {dailyProgress.dropSets.length} drop sets · {dailyVolume} kg de volumen</p>
          <ul className="my-3 space-y-1 text-sm">
            {dayExercises.map((exercise) => <li key={exercise.id}>{exercise.name} · {stateLabel(dailyProgress.stateByExerciseId.get(exercise.id) ?? 'pending')}{dailyProgress.exerciseLogByExerciseId.get(exercise.id)?.notes ? ` · ${dailyProgress.exerciseLogByExerciseId.get(exercise.id)?.notes}` : ''}</li>)}
            {[...dailyProgress.exerciseLogByExerciseId.values()].filter((log) => !dayExercises.some((exercise) => exercise.id === log.routineExerciseId)).map((log) => <li key={log.id}>{log.snapshot.name} · {stateLabel(log.state)}{log.notes ? ` · ${log.notes}` : ''}</li>)}
          </ul>
          {dailyProgress.progress?.session?.notes ? <p className="text-sm text-arsen-muted">{dailyProgress.progress.session.notes}</p> : null}
          {dailyProgress.progress?.session?.health ? <HealthSummaryCard onSync={() => undefined} showSync={false} summary={dailyProgress.progress.session.health} /> : null}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <ActionButton disabled={isPending} onClick={() => setReviewOpen(false)} tone="ghost">Volver a editar</ActionButton>
            <ActionButton disabled={isPending} onClick={completeSession} tone="acid">Confirmar finalización</ActionButton>
          </div>
        </section>
      </div> : null}

      <details>
        <summary className="min-h-12 cursor-pointer py-3 text-sm font-bold text-arsen-muted">Estados del entrenamiento</summary>
      <div className="grid grid-cols-4 gap-2">
        {statusSummary.map((item) => (
          <Card className="p-2 text-center" key={item.label}>
            <strong className={['block text-base', item.tone ?? 'text-arsen-ink'].join(' ')}>{item.value}</strong>
            <span className="mt-1 block text-xs text-arsen-muted">{item.label}</span>
          </Card>
        ))}
      </div>
      </details>

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
        {workoutDay ? <details className="mt-3" key={`${workoutDay.day.id}:${dailyProgress.progress?.session?.id ?? ''}`}>
          <summary className="cursor-pointer py-2 text-sm font-bold text-arsen-muted">Nota de la sesión</summary>
          <form onSubmit={(event) => {
            event.preventDefault()
            const notes = String(new FormData(event.currentTarget).get('notes') ?? '')
            runSetAction(async () => { await updateSessionNotesForDay({ date: dateKey, dayId: workoutDay.day.id, displayUnit: preferredUnit, notes, routineId: workoutDay.routine.id }) }, 'Nota de sesión guardada')
          }}>
            <label className="block text-sm text-arsen-muted">Nota de la sesión
              <textarea className="mt-1 min-h-20 w-full rounded-[10px] border border-white/10 bg-arsen-surface2 p-3 text-arsen-ink" defaultValue={dailyProgress.progress?.session?.notes ?? ''} name="notes" />
            </label>
            <button className="min-h-12 text-sm font-bold text-arsen-purple2" disabled={isPending} type="submit">Guardar nota de la sesión</button>
          </form>
        </details> : null}
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
                          <div className="rounded-[10px] border border-white/10 bg-arsen-bg/45 p-3" key={set.id}>
                            <div className="min-w-0">
                              <strong className="block truncate text-sm">Serie {set.order + 1}</strong>
                              <span className="mt-1 block text-xs text-arsen-muted">
                                {formatWeight(set.weightKg, preferredUnit)} - {set.reps} reps - RIR {set.rir}
                                {dropSets.length > 0 ? ` - ${dropSets.length} drop${dropSets.length === 1 ? '' : 's'}` : ''}
                              </span>
                            </div>
                            <details className="group mt-2">
                              <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 rounded-[10px] border border-white/10 px-3 text-xs font-bold text-arsen-purple2">Acciones de serie {set.order + 1}<ChevronDown aria-hidden="true" className="size-4 shrink-0 group-open:rotate-180" /></summary>
                              <div className="mt-2 grid grid-cols-1 gap-2 min-[360px]:grid-cols-3">
                              <button
                                aria-label={`Editar serie ${set.order + 1} de ${exercise.name}`}
                                className="flex min-h-12 items-center justify-center gap-2 rounded-[10px] border border-white/10 px-2 text-sm font-bold text-arsen-purple2 disabled:opacity-40"
                                disabled={isPending}
                                onClick={() => setEditingSet({ exercise, set })}
                                type="button"
                              >
                                <Pencil aria-hidden="true" className="size-4" />
                                Editar
                              </button>
                              <button aria-label={`Duplicar serie ${set.order + 1} de ${exercise.name}`} className="min-h-12 rounded-[10px] border border-white/10 px-2 text-sm font-bold text-arsen-purple2 disabled:opacity-40" disabled={isPending} onClick={() => { setDuplicateSet(set); setSelectedExerciseId(exercise.id) }} type="button">Duplicar</button>
                              <button
                                aria-label={`Eliminar serie ${set.order + 1} de ${exercise.name}`}
                                className="flex min-h-12 items-center justify-center gap-2 rounded-[10px] border border-red-300/30 px-2 text-sm font-bold text-red-300 disabled:opacity-40"
                                disabled={isPending}
                                onClick={() => deleteSet(set)}
                                type="button"
                              >
                                <Trash2 aria-hidden="true" className="size-4" />
                                Eliminar
                              </button>
                              </div>
                            </details>
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
          availablePlateWeightsKg={availablePlateWeightsKg}
          date={dateKey}
          dayId={workoutDay.day.id}
          displayUnit={workoutDay.settings.preferredUnit}
          exercise={selectedExercise}
          onClose={() => { setSelectedExerciseId(null); setDuplicateSet(null) }}
          onSaved={() => setMessage('Serie guardada')}
          referenceSet={duplicateSet ?? loggedRowsForExercise(selectedExercise).at(-1)?.set ?? lastSessionReferences.get(selectedExercise.id)?.sets.at(-1)?.set}
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
            await updateSetWithDrops(editingSet.set.id, input)
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

function buildWarmupsForExercise(exercise: RoutineExercise | null | undefined, unit: WeightUnit, targetWeightKg?: number) {
  if (!exercise) return []

  return buildWarmupSets(targetWeightKg ?? exercise.currentWeightKg, exercise.warmupProtocol).map((set) => ({
    reps: set.reps,
    rir: set.rir,
    weight: formatWeight(set.weightKg, unit),
    weightKg: set.weightKg,
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
      <details className="group">
      <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 rounded-[10px]">
        <div className="min-w-0">
          <strong className="block text-xs font-extrabold text-arsen-purple2">Ultima sesion</strong>
          <span className="mt-0.5 block text-xs text-arsen-muted">
            {reference ? formatShortWorkoutDate(reference.date) : 'Sin historial previo'}
          </span>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-arsen-purple2">
          <span className="rounded-full border border-arsen-purple/35 bg-arsen-purple/15 px-2 py-1 text-xs font-extrabold">Referencia</span>
          <ChevronDown aria-hidden="true" className="size-4 group-open:rotate-180" />
        </span>
      </summary>
      <div className="mt-2">
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
      </div>
      </details>
    </section>
  )
}
function DeloadStatusCard({
  deload,
  disabled,
  onComplete,
}: {
  deload: DeloadOverview | undefined
  disabled: boolean
  onComplete: () => void
}) {
  return (
    <Card className="border-arsen-acid/35 bg-arsen-acid/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-arsen-bg/75 text-arsen-acid">
            <Moon aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0">
            <strong className="block text-sm text-arsen-acid">Modo deload activo</strong>
            <span className="mt-1 block text-xs text-arsen-muted">
              <span>{formatDeloadDays(deload?.daysRemaining)}</span>
              <span> - {deload?.seriesReductionPercent ?? 50}% series - {deload?.weightReductionPercent ?? 80}% peso</span>
            </span>
          </div>
        </div>
        <button
          className="min-h-9 shrink-0 rounded-[10px] border border-arsen-acid/40 px-3 text-xs font-extrabold text-arsen-acid disabled:opacity-60"
          disabled={disabled}
          onClick={onComplete}
          type="button"
        >
          Finalizar deload
        </button>
      </div>
    </Card>
  )
}

function formatDeloadDays(daysRemaining: number | null | undefined) {
  const days = daysRemaining ?? 0

  return `${days} ${days === 1 ? 'dia restante' : 'dias restantes'}`
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
