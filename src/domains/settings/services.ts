import { CURRENT_SCHEMA_VERSION, db } from '../../db/schema'
import type {
  ExerciseCatalogItem,
  ExerciseAsset,
  Routine,
  RoutineDay,
  RoutineExercise,
  WeeklyVolumeTarget,
} from '../routine/types'
import type { AppSettings } from './types'
import type { DropSetLog, ExerciseLog, SetLog, SkipLog, WeightUnit, WorkoutSession } from '../workout/types'
import { loadSettingsForEquipment, normalizeAvailablePlateWeightsKg } from '../../shared/calculations/equipmentLoad'
import { performanceScore, volumeForSet } from '../../shared/calculations/workout'
import { normalizeWarmupProtocol } from '../../shared/calculations/warmups'
import { downloadJson, downloadText } from '../../shared/utils/download'
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
 * Exports progress CSV from the same timeline as progress JSON, with one row per main set.
 */
export async function exportProgressCsv(filters: ProgressExportFilters = {}) {
  const data = await buildProgressExport(filters)
  const rows = [
    [
      'date',
      'routine',
      'routine_id',
      'day',
      'day_id',
      'exercise',
      'exercise_log_id',
      'routine_exercise_id',
      'muscle',
      'equipment',
      'set_order',
      'set_log_id',
      'weight_kg',
      'reps',
      'rir',
      'volume',
      'score',
    ],
    ...data.timeline.map((row) => [
      row.date,
      row.routineName,
      row.routineId,
      row.dayName,
      row.dayId,
      row.exerciseName,
      row.exerciseLogId,
      row.routineExerciseId,
      row.mainMuscle,
      row.equipment,
      String(row.setOrder),
      row.setLogId,
      String(row.weightKg),
      String(row.reps),
      String(row.rir),
      String(row.volume),
      String(row.score),
    ]),
  ]
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')

  downloadText(progressExportFilename(filters, 'csv'), csv, 'text/csv')
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

function escapeCsvCell(value: string) {
  if (!/[",\n]/.test(value)) return value

  return `"${value.replaceAll('"', '""')}"`
}

function progressExportFilename(filters: ProgressExportFilters, extension: 'csv' | 'json') {
  const suffix = filters.dayId || filters.canonicalName ? '-filtrado' : ''

  return `arsen-progreso${suffix}-${localDateKey(new Date())}.${extension}`
}

type BackupTables = {
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
