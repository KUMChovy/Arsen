import Papa from 'papaparse'
import { CURRENT_SCHEMA_VERSION, db } from '../../db/schema'
import type {
  ExerciseCatalogItem,
  ExerciseAsset,
  Routine,
  RoutineDay,
  RoutineExercise,
  WeeklyVolumeTarget,
} from '../routine/types'
import type { AppSettings, DeloadCycle, DeloadOverview, DeloadPhase } from './types'
import type { DropSetLog, ExerciseLog, SetLog, SkipLog, WeightUnit, WorkoutSession } from '../workout/types'
import { loadSettingsForEquipment, normalizeAvailablePlateWeightsKg } from '../../shared/calculations/equipmentLoad'
import { performanceScore, volumeForSet, weeksSince } from '../../shared/calculations/workout'
import { normalizeWarmupProtocol } from '../../shared/calculations/warmups'
import {
  DELOAD_SKIP_COOLDOWN_DAYS,
  addDays,
  daysRemainingInDeload,
  isDeloadComplete,
  isDeloadSuggestionWindow,
  normalizeDeloadSeriesPercent,
  normalizeDeloadWeightPercent,
} from '../../shared/calculations/deload'
import { downloadJson, downloadText } from '../../shared/utils/download'
import { createId } from '../../shared/utils/id'
import { localDateKey } from '../../shared/utils/date'
import { backupSchema } from '../../shared/validation/arsenImportSchemas'
import { deleteWorkoutSession } from '../workout/services'

/**
 * Exports a full IndexedDB backup JSON file with every persisted Arsen table.
 * Routine and catalog rows keep recipe fields, notes, equipment, and load settings.
 */
export async function exportFullBackup() {
  const data = {
    exportedAt: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tables: {
      deloadCycles: await db.deloadCycles.toArray(),
      dropSetLogs: await db.dropSetLogs.toArray(),
      exerciseAssets: await db.exerciseAssets.toArray(),
      exerciseCatalog: (await db.exerciseCatalog.toArray()).map(stripLegacyCatalogProgression),
      exerciseLogs: await db.exerciseLogs.toArray(),
      routineDays: await db.routineDays.toArray(),
      routineExercises: (await db.routineExercises.toArray()).map(stripLegacyProgression),
      routines: await db.routines.toArray(),
      setLogs: await db.setLogs.toArray(),
      settings: await db.settings.toArray(),
      skipLogs: await db.skipLogs.toArray(),
      weeklyVolumeTargets: await db.weeklyVolumeTargets.toArray(),
      workoutSessions: await db.workoutSessions.toArray(),
    },
  }

  downloadJson(`arsen-backup-${localDateKey(new Date())}.json`, data)
}

export type BackupImportMode = 'merge' | 'replace'

/**
 * Imports a full backup JSON file, replacing or merging every persisted table after schema validation.
 */
export async function importFullBackup(file: File, mode: BackupImportMode = 'replace') {
  const backup = parseBackup(await file.text())
  const tables = backup.tables

  await db.transaction(
    'rw',
    [
      db.deloadCycles,
      db.dropSetLogs,
      db.exerciseAssets,
      db.exerciseCatalog,
      db.exerciseLogs,
      db.routineDays,
      db.routineExercises,
      db.routines,
      db.setLogs,
      db.settings,
      db.skipLogs,
      db.weeklyVolumeTargets,
      db.workoutSessions,
    ],
    async () => {
      if (mode === 'replace') await clearBackupTables()
      await putBackupTables(tables, mode)
    },
  )
}

async function clearBackupTables() {
  await Promise.all([
    db.deloadCycles.clear(),
    db.dropSetLogs.clear(),
    db.exerciseAssets.clear(),
    db.exerciseCatalog.clear(),
    db.exerciseLogs.clear(),
    db.routineDays.clear(),
    db.routineExercises.clear(),
    db.routines.clear(),
    db.setLogs.clear(),
    db.settings.clear(),
    db.skipLogs.clear(),
    db.weeklyVolumeTargets.clear(),
    db.workoutSessions.clear(),
  ])
}

async function putBackupTables(tables: BackupTables, mode: BackupImportMode) {
  const shouldImportSettings = mode === 'replace' || !(await db.settings.get('app'))

  await Promise.all([
    db.deloadCycles.bulkPut(tables.deloadCycles ?? []),
    db.dropSetLogs.bulkPut(tables.dropSetLogs ?? []),
    db.exerciseAssets.bulkPut(tables.exerciseAssets ?? []),
    db.exerciseCatalog.bulkPut((tables.exerciseCatalog ?? []).map(stripLegacyCatalogProgression)),
    db.exerciseLogs.bulkPut(tables.exerciseLogs ?? []),
    db.routineDays.bulkPut(tables.routineDays ?? []),
    db.routineExercises.bulkPut((tables.routineExercises ?? []).map(stripLegacyProgression)),
    db.routines.bulkPut(tables.routines ?? []),
    db.setLogs.bulkPut(tables.setLogs ?? []),
    shouldImportSettings ? db.settings.bulkPut(tables.settings ?? []) : Promise.resolve(),
    db.skipLogs.bulkPut(tables.skipLogs ?? []),
    db.weeklyVolumeTargets.bulkPut(tables.weeklyVolumeTargets ?? []),
    db.workoutSessions.bulkPut(tables.workoutSessions ?? []),
  ])
}

export type ProgressExportFilters = {
  canonicalName?: string | null
  dayId?: string | null
}

/**
 * Exports progress JSON: summary, graph points, and chronological main-set timeline.
 */
export async function exportProgressJson(filters: ProgressExportFilters = {}) {
  const data = await buildProgressExport(filters)
  downloadJson(progressExportFilename(filters, 'json'), data)
}

/**
 * Exports progress CSV for end users, with one row per main set and drop set.
 */
export async function exportProgressCsv(filters: ProgressExportFilters = {}) {
  const data = await buildProgressExport(filters)
  const rows = [CSV_EXPORT_HEADERS, ...data.timeline.flatMap(csvRowsForTimelineRow)]
  const csv = `\ufeffsep=;
${Papa.unparse(rows, { delimiter: ';' })}`

  downloadText(progressExportFilename(filters, 'csv'), csv, 'text/csv;charset=utf-8')
}

const OPEN_DELOAD_STATUSES = ['suggested', 'scheduled', 'active'] as const

function isOpenDeloadStatus(status: DeloadCycle['status']) {
  return OPEN_DELOAD_STATUSES.some((candidate) => candidate === status)
}

export async function getDeloadOverview(currentDate = localDateKey(new Date())): Promise<DeloadOverview> {
  await applyDeloadDateTransitions(currentDate)

  const [settings, firstSession, cycles] = await Promise.all([
    db.settings.get('app'),
    db.workoutSessions.orderBy('date').first(),
    db.deloadCycles.toArray(),
  ])
  const sortedCycles = [...cycles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const currentCycle = sortedCycles.find((cycle) => isOpenDeloadStatus(cycle.status)) ?? null
  const lastCompleted = cycles
    .filter((cycle) => cycle.status === 'completed' && cycle.completedAt)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))[0] ?? null
  const lastSkipped = cycles
    .filter((cycle) => cycle.status === 'skipped' && cycle.skippedAt)
    .sort((a, b) => b.skippedAt!.localeCompare(a.skippedAt!))[0] ?? null
  const cooldownUntil = lastSkipped?.skippedAt ? addDays(lastSkipped.skippedAt, DELOAD_SKIP_COOLDOWN_DAYS) : null
  const cooldownActive = Boolean(cooldownUntil && currentDate < cooldownUntil)
  const firstLogDate = firstSession?.date ?? null
  const lastCompletedDate = lastCompleted?.completedAt ?? null
  const anchorDate = lastCompletedDate ?? firstLogDate
  const weeksSinceAnchor = anchorDate ? weeksSince(anchorDate, currentDate) : 0
  const seriesReductionPercent = normalizeDeloadSeriesPercent(settings?.deloadSeriesReductionPercent)
  const weightReductionPercent = normalizeDeloadWeightPercent(settings?.deloadWeightReductionPercent)

  if (currentCycle) {
    const phase: DeloadPhase = currentCycle.status === 'active' ? 'active' : currentCycle.status === 'scheduled' ? 'scheduled' : 'suggested'

    return {
      anchorDate,
      cooldownUntil: cooldownActive ? cooldownUntil : null,
      currentCycle,
      daysRemaining:
        currentCycle.status === 'active' && currentCycle.startedAt
          ? daysRemainingInDeload(currentCycle.startedAt, currentDate)
          : null,
      firstLogDate,
      lastCompletedDate,
      phase,
      seriesReductionPercent,
      shouldNotify: currentCycle.status === 'suggested',
      weeksSinceAnchor,
      weightReductionPercent,
    }
  }

  const justCompleted = sortedCycles.find((cycle) => cycle.status === 'completed' && cycle.completedAt === currentDate) ?? null
  if (justCompleted) {
    return {
      anchorDate: justCompleted.completedAt,
      cooldownUntil: null,
      currentCycle: justCompleted,
      daysRemaining: null,
      firstLogDate,
      lastCompletedDate: justCompleted.completedAt,
      phase: 'completed',
      seriesReductionPercent,
      shouldNotify: false,
      weeksSinceAnchor: 0,
      weightReductionPercent,
    }
  }

  if (!cooldownActive && isDeloadSuggestionWindow(anchorDate, currentDate)) {
    const suggested = await createSuggestedDeload(currentDate)

    return {
      anchorDate,
      cooldownUntil: null,
      currentCycle: suggested,
      daysRemaining: null,
      firstLogDate,
      lastCompletedDate,
      phase: 'suggested',
      seriesReductionPercent,
      shouldNotify: true,
      weeksSinceAnchor,
      weightReductionPercent,
    }
  }

  return {
    anchorDate,
    cooldownUntil: cooldownActive ? cooldownUntil : null,
    currentCycle: null,
    daysRemaining: null,
    firstLogDate,
    lastCompletedDate,
    phase: 'idle',
    seriesReductionPercent,
    shouldNotify: false,
    weeksSinceAnchor,
    weightReductionPercent,
  }
}

export async function scheduleDeload(startDate: string, currentDate = localDateKey(new Date())) {
  if (!startDate || startDate <= currentDate) throw new Error('Programa una fecha futura')
  const now = new Date().toISOString()

  await db.transaction('rw', db.deloadCycles, async () => {
    await closeOpenDeloadCycles(now, currentDate)
    await db.deloadCycles.add({
      completedAt: null,
      createdAt: now,
      id: createId('deload'),
      scheduledStartDate: startDate,
      skippedAt: null,
      startedAt: null,
      status: 'scheduled',
      suggestedAt: null,
      updatedAt: now,
    })
  })
}

export async function startDeloadNow(currentDate = localDateKey(new Date())) {
  const now = new Date().toISOString()

  await db.transaction('rw', db.deloadCycles, async () => {
    await closeOpenDeloadCycles(now, currentDate)
    await db.deloadCycles.add({
      completedAt: null,
      createdAt: now,
      id: createId('deload'),
      scheduledStartDate: null,
      skippedAt: null,
      startedAt: currentDate,
      status: 'active',
      suggestedAt: null,
      updatedAt: now,
    })
  })
}

export async function skipDeloadSuggestion(currentDate = localDateKey(new Date())) {
  const open = await getOpenDeloadCycle()
  if (!open || open.status !== 'suggested') return

  await db.deloadCycles.update(open.id, {
    skippedAt: currentDate,
    status: 'skipped',
    updatedAt: new Date().toISOString(),
  })
}

export async function completeActiveDeload(currentDate = localDateKey(new Date())) {
  const open = await getOpenDeloadCycle()
  if (!open || open.status !== 'active') return

  await db.deloadCycles.update(open.id, {
    completedAt: currentDate,
    status: 'completed',
    updatedAt: new Date().toISOString(),
  })
}

export async function updateDeloadReductionSettings(input: {
  seriesReductionPercent: number
  weightReductionPercent: number
}) {
  await db.settings.update('app', {
    deloadSeriesReductionPercent: normalizeDeloadSeriesPercent(input.seriesReductionPercent),
    deloadWeightReductionPercent: normalizeDeloadWeightPercent(input.weightReductionPercent),
    updatedAt: new Date().toISOString(),
  })
}

async function applyDeloadDateTransitions(currentDate: string) {
  const open = await getOpenDeloadCycle()
  if (!open) return

  const now = new Date().toISOString()
  if (open.status === 'scheduled' && open.scheduledStartDate && open.scheduledStartDate <= currentDate) {
    await db.deloadCycles.update(open.id, {
      startedAt: open.scheduledStartDate,
      status: 'active',
      updatedAt: now,
    })
    return
  }

  if (open.status === 'active' && open.startedAt && isDeloadComplete(open.startedAt, currentDate)) {
    await db.deloadCycles.update(open.id, {
      completedAt: currentDate,
      status: 'completed',
      updatedAt: now,
    })
  }
}

async function getOpenDeloadCycle() {
  const cycles = await db.deloadCycles.toArray()

  return cycles
    .filter((cycle) => isOpenDeloadStatus(cycle.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
}

async function createSuggestedDeload(currentDate: string) {
  const existing = await getOpenDeloadCycle()
  if (existing) return existing

  const now = new Date().toISOString()
  const cycle: DeloadCycle = {
    completedAt: null,
    createdAt: now,
    id: createId('deload'),
    scheduledStartDate: null,
    skippedAt: null,
    startedAt: null,
    status: 'suggested',
    suggestedAt: currentDate,
    updatedAt: now,
  }
  await db.deloadCycles.add(cycle)

  return cycle
}

async function closeOpenDeloadCycles(now: string, currentDate: string) {
  const openCycles = (await db.deloadCycles.toArray()).filter((cycle) => isOpenDeloadStatus(cycle.status))

  await Promise.all(
    openCycles.map((cycle) =>
      db.deloadCycles.update(cycle.id, {
        skippedAt: currentDate,
        status: 'skipped',
        updatedAt: now,
      }),
    ),
  )
}

export async function getStorageOverview() {
  const [routines, sessions, exerciseLogs, setLogs, estimate, persisted] = await Promise.all([
    db.routines.count(),
    db.workoutSessions.count(),
    db.exerciseLogs.count(),
    db.setLogs.count(),
    navigator.storage?.estimate?.() ?? Promise.resolve({ quota: undefined, usage: undefined }),
    navigator.storage?.persisted?.() ?? Promise.resolve(null),
  ])

  return {
    exerciseLogs,
    persisted,
    quota: estimate.quota ?? null,
    routines,
    sessions,
    setLogs,
    usage: estimate.usage ?? null,
  }
}

export async function requestPersistentStorage() {
  if (!navigator.storage?.persist) return false

  return navigator.storage.persist()
}

export async function getAppSettings() {
  return db.settings.get('app')
}

export async function updatePreferredUnit(preferredUnit: WeightUnit) {
  await db.settings.update('app', {
    preferredUnit,
    updatedAt: new Date().toISOString(),
  })
}

export function resolveAvailablePlateWeightsKg(settings?: Pick<AppSettings, 'availablePlateWeightsKg'> | null) {
  return normalizeAvailablePlateWeightsKg(settings?.availablePlateWeightsKg)
}

export async function updateAvailablePlateWeights(availablePlateWeightsKg: number[]) {
  await db.settings.update('app', {
    availablePlateWeightsKg: normalizeAvailablePlateWeightsKg(availablePlateWeightsKg),
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteAllWorkoutLogs() {
  const sessions = await db.workoutSessions.toArray()

  await Promise.all(sessions.map((session) => deleteWorkoutSession(session.id)))
}

export async function deleteActiveRoutineWorkoutLogs() {
  const settings = await db.settings.get('app')
  if (!settings?.activeRoutineId) return

  const sessions = await db.workoutSessions.where('routineId').equals(settings.activeRoutineId).toArray()
  await Promise.all(sessions.map((session) => deleteWorkoutSession(session.id)))
}

export async function deleteWorkoutLogsByDateRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) throw new Error('Selecciona fecha inicial y final')
  if (startDate > endDate) throw new Error('La fecha inicial no puede ser mayor a la final')

  const sessions = await db.workoutSessions.where('date').between(startDate, endDate, true, true).toArray()
  await Promise.all(sessions.map((session) => deleteWorkoutSession(session.id)))
}

export async function buildProgressExport(filters: ProgressExportFilters = {}) {
  const [routines, days, exercises, sessions, exerciseLogs, setLogs, dropSetLogs] = await Promise.all([
    db.routines.toArray(),
    db.routineDays.toArray(),
    db.routineExercises.toArray(),
    db.workoutSessions.orderBy('date').toArray(),
    db.exerciseLogs.toArray(),
    db.setLogs.toArray(),
    db.dropSetLogs.toArray(),
  ])
  const routineById = new Map(routines.map((routine) => [routine.id, routine]))
  const dayById = new Map(days.map((day) => [day.id, day]))
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const visibleSessions = filters.dayId ? sessions.filter((session) => session.dayId === filters.dayId) : sessions
  const sessionById = new Map(visibleSessions.map((session) => [session.id, session]))
  const exerciseLogById = new Map(exerciseLogs.map((log) => [log.id, log]))
  const dropSetsBySetId = new Map<string, typeof dropSetLogs>()

  for (const dropSet of dropSetLogs) {
    const current = dropSetsBySetId.get(dropSet.setLogId)
    if (current) {
      current.push(dropSet)
    } else {
      dropSetsBySetId.set(dropSet.setLogId, [dropSet])
    }
  }

  const timeline = setLogs
    .filter((set) => set.kind === 'main')
    .flatMap((set) => {
      const log = exerciseLogById.get(set.exerciseLogId)
      const session = log ? sessionById.get(log.sessionId) : undefined
      if (!log || !session) return []
      if (filters.canonicalName && log.snapshot.canonicalName !== filters.canonicalName) return []

      const routine = routineById.get(session.routineId)
      const day = dayById.get(session.dayId)
      const exercise = exerciseById.get(log.routineExerciseId)
      const dropSets = dropSetsBySetId.get(set.id) ?? []

      return [
        {
          canonicalName: log.snapshot.canonicalName,
          date: session.date,
          dayId: session.dayId,
          dayName: day?.name ?? 'Dia eliminado',
          dropSets,
          equipment: log.snapshot.equipment,
          exerciseLogId: log.id,
          exerciseName: log.snapshot.name,
          mainMuscle: log.snapshot.mainMuscle,
          reps: set.reps,
          rir: set.rir,
          routineExerciseId: log.routineExerciseId,
          routineId: session.routineId,
          routineName: routine?.name ?? 'Rutina eliminada',
          sessionId: session.id,
          setOrder: set.order + 1,
          setLogId: set.id,
          score: Math.round(performanceScore(set) * 100) / 100,
          sourceExerciseId: exercise?.id ?? log.routineExerciseId,
          volume: volumeForSet(set) + dropSets.reduce((total, dropSet) => total + volumeForSet(dropSet), 0),
          weightKg: set.weightKg,
        },
      ]
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.routineName.localeCompare(b.routineName) ||
        a.exerciseName.localeCompare(b.exerciseName) ||
        a.setOrder - b.setOrder,
    )
  const graphPoints = buildGraphPoints(timeline)
  const timelineSessionIds = new Set(timeline.map((row) => row.sessionId))
  const timelineRoutineIds = new Set(timeline.map((row) => row.routineId))
  const isFiltered = Boolean(filters.dayId || filters.canonicalName)

  return {
    exportedAt: new Date().toISOString(),
    filters: {
      canonicalName: filters.canonicalName ?? null,
      dayId: filters.dayId ?? null,
      scope: isFiltered ? 'filtered' : 'all',
    },
    schemaVersion: CURRENT_SCHEMA_VERSION,
    graphPoints,
    summary: {
      exercises: new Set(timeline.map((row) => row.canonicalName)).size,
      routines: isFiltered ? timelineRoutineIds.size : routines.length,
      sessions: filters.canonicalName ? timelineSessionIds.size : visibleSessions.length,
      sets: timeline.length,
      volume: timeline.reduce((total, row) => total + row.volume, 0),
    },
    timeline,
  }
}

function buildGraphPoints(timeline: Array<{ canonicalName: string; date: string; exerciseName: string; routineId: string; routineName: string; score: number; sessionId: string; volume: number }>) {
  const points = new Map<
    string,
    {
      canonicalName: string
      date: string
      exerciseName: string
      routineId: string
      routineName: string
      score: number
      sessionId: string
      volume: number
    }
  >()

  for (const row of timeline) {
    const key = `${row.sessionId}:${row.canonicalName}`
    const current = points.get(key)

    points.set(key, {
      canonicalName: row.canonicalName,
      date: row.date,
      exerciseName: row.exerciseName,
      routineId: row.routineId,
      routineName: row.routineName,
      score: Math.max(current?.score ?? 0, row.score),
      sessionId: row.sessionId,
      volume: (current?.volume ?? 0) + row.volume,
    })
  }

  return [...points.values()].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.routineName.localeCompare(b.routineName) ||
      a.exerciseName.localeCompare(b.exerciseName),
  )
}

const CSV_EXPORT_HEADERS = [
  'Fecha',
  'Rutina',
  'Dia',
  'Ejercicio',
  'Musculo',
  'Equipo',
  'Serie',
  'Tipo de serie',
  'Serie principal',
  'Peso (kg)',
  'Repeticiones',
  'RIR',
  'Volumen',
  'Puntaje',
]

type ProgressTimelineRow = Awaited<ReturnType<typeof buildProgressExport>>['timeline'][number]

function csvRowsForTimelineRow(row: ProgressTimelineRow) {
  const mainRow = csvRow({
    dayName: row.dayName,
    equipment: row.equipment,
    exerciseName: row.exerciseName,
    mainMuscle: row.mainMuscle,
    parentSetOrder: '',
    reps: row.reps,
    rir: row.rir,
    routineName: row.routineName,
    score: row.score,
    setOrder: row.setOrder,
    setType: 'principal',
    trainedAt: row.date,
    volume: volumeForSet(row),
    weightKg: row.weightKg,
  })
  const dropRows = [...row.dropSets]
    .sort((a, b) => a.order - b.order)
    .map((dropSet) =>
      csvRow({
        dayName: row.dayName,
        equipment: row.equipment,
        exerciseName: row.exerciseName,
        mainMuscle: row.mainMuscle,
        parentSetOrder: row.setOrder,
        reps: dropSet.reps,
        rir: dropSet.rir,
        routineName: row.routineName,
        score: performanceScore(dropSet),
        setOrder: `Drop ${dropSet.order + 1}`,
        setType: 'drop',
        trainedAt: row.date,
        volume: volumeForSet(dropSet),
        weightKg: dropSet.weightKg,
      }),
    )

  return [mainRow, ...dropRows]
}

function csvRow(input: {
  dayName: string
  equipment: string
  exerciseName: string
  mainMuscle: string
  parentSetOrder: number | ''
  reps: number
  rir: number
  routineName: string
  score: number
  setOrder: number | string
  setType: 'principal' | 'drop'
  trainedAt: string
  volume: number
  weightKg: number
}) {
  return [
    input.trainedAt,
    formatCsvText(input.routineName),
    formatCsvText(input.dayName),
    formatCsvText(input.exerciseName),
    formatCsvText(input.mainMuscle),
    formatCsvText(input.equipment),
    String(input.setOrder),
    input.setType,
    String(input.parentSetOrder),
    formatCsvDecimal(input.weightKg),
    String(input.reps),
    String(input.rir),
    formatCsvDecimal(input.volume),
    formatCsvDecimal(input.score),
  ]
}

function formatCsvText(value: string) {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function formatCsvDecimal(value: number) {
  return value.toFixed(2).replace('.', ',')
}


function progressExportFilename(filters: ProgressExportFilters, extension: 'csv' | 'json') {
  const suffix = filters.dayId || filters.canonicalName ? '-filtrado' : ''

  return `arsen-progreso${suffix}-${localDateKey(new Date())}.${extension}`
}

type BackupTables = {
  deloadCycles?: DeloadCycle[]
  dropSetLogs?: DropSetLog[]
  exerciseAssets?: ExerciseAsset[]
  exerciseCatalog?: ExerciseCatalogItem[]
  exerciseLogs?: ExerciseLog[]
  routineDays?: RoutineDay[]
  routineExercises?: RoutineExercise[]
  routines?: Routine[]
  setLogs?: SetLog[]
  settings?: AppSettings[]
  skipLogs?: SkipLog[]
  weeklyVolumeTargets?: WeeklyVolumeTarget[]
  workoutSessions?: WorkoutSession[]
}

function parseBackup(content: string): { tables: BackupTables } {
  const parsed: unknown = JSON.parse(content)
  const result = backupSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error('El archivo no es un respaldo Arsen valido')
  }

  return { tables: result.data.tables as BackupTables }
}

function stripLegacyProgression(exercise: RoutineExercise): RoutineExercise {
  const copy = { ...exercise } as RoutineExercise & { progression?: unknown }
  delete copy.progression
  copy.warmupProtocol = normalizeWarmupProtocol(copy.warmupProtocol)
  const loadSettings = loadSettingsForEquipment(copy)
  copy.equipment = loadSettings.equipment
  copy.loadMode = loadSettings.loadMode
  copy.barWeightKg = loadSettings.barWeightKg

  return copy
}

function stripLegacyCatalogProgression(item: ExerciseCatalogItem): ExerciseCatalogItem {
  const copy = { ...item } as ExerciseCatalogItem & { progressionStrategy?: unknown }
  delete copy.progressionStrategy
  copy.warmupProtocol = normalizeWarmupProtocol(copy.warmupProtocol)
  const loadSettings = loadSettingsForEquipment(copy)
  copy.equipment = loadSettings.equipment
  copy.loadMode = loadSettings.loadMode
  copy.barWeightKg = loadSettings.barWeightKg

  return copy
}
