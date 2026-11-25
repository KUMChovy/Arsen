import Dexie, { type DexieOptions, type Table } from 'dexie'
import type {
  ExerciseAsset,
  ExerciseCatalogItem,
  Routine,
  RoutineDay,
  RoutineExercise,
  WeeklyVolumeTarget,
} from '../domains/routine/types'
import type { AppSettings, DeloadCycle } from '../domains/settings/types'
import type { DropSetLog, ExerciseLog, SetLog, SkipLog, WorkoutSession } from '../domains/workout/types'
import { CONTRACT_TABLE_NAMES, installRevisionTracking } from './revisionTracking'
import type { PublishedCatalog } from '../shared/validation/remoteCatalog'

import { CURRENT_SCHEMA_VERSION } from './schemaVersion'
export { CURRENT_SCHEMA_VERSION } from './schemaVersion'

export class ArsenDatabase extends Dexie {
  settings!: Table<AppSettings, string>
  deloadCycles!: Table<DeloadCycle, string>
  routines!: Table<Routine, string>
  routineDays!: Table<RoutineDay, string>
  routineExercises!: Table<RoutineExercise, string>
  exerciseCatalog!: Table<ExerciseCatalogItem, string>
  exerciseAssets!: Table<ExerciseAsset, string>
  weeklyVolumeTargets!: Table<WeeklyVolumeTarget, string>
  workoutSessions!: Table<WorkoutSession, string>
  exerciseLogs!: Table<ExerciseLog, string>
  setLogs!: Table<SetLog, string>
  dropSetLogs!: Table<DropSetLog, string>
  skipLogs!: Table<SkipLog, string>
  localMetadata!: Table<{ id: 'revision'; value: number } | { id: 'globalCatalog'; value: PublishedCatalog } | { id: 'automaticBackup'; value: { owner: string; deviceId: string; baseBackupId: string | null; baselineConfirmedId: string | null; baselineEquivalentRevision?: number | null; equivalentRevision?: number; equivalentBackupId?: string } }, string>

  constructor(name = 'arsen', options?: DexieOptions) {
    super(name, options)

    this.version(7)
      .stores({
        settings: 'id, activeRoutineId, preferredUnit',
        routines: 'id, isActive, name, updatedAt',
        routineDays: 'id, routineId, [routineId+order], weekday',
        routineExercises: 'id, routineId, dayId, canonicalName, [dayId+order], sourceExerciseId',
        exerciseCatalog: 'id, canonicalName, mainMuscle, equipment',
        exerciseAssets: 'id, updatedAt',
        weeklyVolumeTargets: 'id, routineId, muscle',
        workoutSessions: 'id, routineId, dayId, date, [date+routineId], [date+dayId]',
        exerciseLogs: 'id, sessionId, routineExerciseId, state',
        setLogs: 'id, exerciseLogId, kind, [exerciseLogId+order]',
        dropSetLogs: 'id, setLogId, [setLogId+order]',
        skipLogs: 'id, sessionId, routineExerciseId',
        deloadCycles: 'id, status, startedAt, completedAt, scheduledStartDate, skippedAt, updatedAt',
      })
    this.version(8).stores({ localMetadata: 'id' }).upgrade(async (transaction) => {
      await transaction.table('localMetadata').add({ id: 'revision', value: 0 })
      await transaction.table('settings').toCollection().modify({ schemaVersion: CURRENT_SCHEMA_VERSION })
    })
    this.on('populate', (transaction) => transaction.table('localMetadata').add({ id: 'revision', value: 0 }))
    installRevisionTracking(this)
  }
}

export const db = new ArsenDatabase()

export function dataTables() {
  return db.tables.filter((table) => (CONTRACT_TABLE_NAMES as readonly string[]).includes(table.name))
}
