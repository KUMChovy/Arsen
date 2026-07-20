import { CURRENT_SCHEMA_VERSION, db } from '../../db/schema'
import type {
  ExerciseCatalogItem,
  Routine,
  RoutineDay,
  RoutineExercise,
  WeeklyVolumeTarget,
} from '../routine/types'
import type { AppSettings } from './types'
import type { DropSetLog, ExerciseLog, SetLog, SkipLog, WorkoutSession } from '../workout/types'
import { performanceScore, volumeForSet } from '../../shared/calculations/workout'
import { downloadJson, downloadText } from '../../shared/utils/download'
import { localDateKey } from '../../shared/utils/date'

export async function exportFullBackup() {
  const data = {
    exportedAt: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tables: {
      dropSetLogs: await db.dropSetLogs.toArray(),
      exerciseCatalog: await db.exerciseCatalog.toArray(),
      exerciseLogs: await db.exerciseLogs.toArray(),
      routineDays: await db.routineDays.toArray(),
      routineExercises: await db.routineExercises.toArray(),
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

export async function importFullBackup(file: File) {
  const backup = parseBackup(await file.text())
  const tables = backup.tables

  await db.transaction(
    'rw',
    [
      db.dropSetLogs,
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
      await Promise.all([
        db.dropSetLogs.clear(),
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

      await Promise.all([
        db.dropSetLogs.bulkPut(tables.dropSetLogs ?? []),
        db.exerciseCatalog.bulkPut(tables.exerciseCatalog ?? []),
        db.exerciseLogs.bulkPut(tables.exerciseLogs ?? []),
        db.routineDays.bulkPut(tables.routineDays ?? []),
        db.routineExercises.bulkPut(tables.routineExercises ?? []),
        db.routines.bulkPut(tables.routines ?? []),
        db.setLogs.bulkPut(tables.setLogs ?? []),
        db.settings.bulkPut(tables.settings ?? []),
        db.skipLogs.bulkPut(tables.skipLogs ?? []),
        db.weeklyVolumeTargets.bulkPut(tables.weeklyVolumeTargets ?? []),
        db.workoutSessions.bulkPut(tables.workoutSessions ?? []),
      ])
    },
  )
}

export async function exportProgressJson() {
  const data = await buildProgressExport()
  downloadJson(`arsen-progreso-${localDateKey(new Date())}.json`, data)
}

export async function exportProgressCsv() {
  const data = await buildProgressExport()
  const rows = [
    [
      'date',
      'routine',
      'day',
      'exercise',
      'muscle',
      'equipment',
      'set_order',
      'weight_kg',
      'reps',
      'rir',
      'volume',
      'score',
    ],
    ...data.timeline.map((row) => [
      row.date,
      row.routineName,
      row.dayName,
      row.exerciseName,
      row.mainMuscle,
      row.equipment,
      String(row.setOrder),
      String(row.weightKg),
      String(row.reps),
      String(row.rir),
      String(row.volume),
      String(row.score),
    ]),
  ]
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n')

  downloadText(`arsen-progreso-${localDateKey(new Date())}.csv`, csv, 'text/csv')
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

async function buildProgressExport() {
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
  const sessionById = new Map(sessions.map((session) => [session.id, session]))
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

      const routine = routineById.get(session.routineId)
      const day = dayById.get(session.dayId)
      const exercise = exerciseById.get(log.routineExerciseId)

      return [
        {
          canonicalName: log.snapshot.canonicalName,
          date: session.date,
          dayName: day?.name ?? 'Dia eliminado',
          dropSets: dropSetsBySetId.get(set.id) ?? [],
          equipment: log.snapshot.equipment,
          exerciseName: log.snapshot.name,
          mainMuscle: log.snapshot.mainMuscle,
          reps: set.reps,
          rir: set.rir,
          routineId: session.routineId,
          routineName: routine?.name ?? 'Rutina eliminada',
          sessionId: session.id,
          setOrder: set.order + 1,
          setLogId: set.id,
          score: Math.round(performanceScore(set) * 100) / 100,
          sourceExerciseId: exercise?.id ?? log.routineExerciseId,
          volume: volumeForSet(set),
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

  return {
    exportedAt: new Date().toISOString(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    graphPoints,
    summary: {
      exercises: new Set(timeline.map((row) => row.canonicalName)).size,
      routines: routines.length,
      sessions: sessions.length,
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

type BackupTables = {
  dropSetLogs?: DropSetLog[]
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
  if (!isObject(parsed) || !isObject(parsed.tables)) {
    throw new Error('El archivo no es un respaldo Arsen valido')
  }

  return { tables: parsed.tables as BackupTables }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
