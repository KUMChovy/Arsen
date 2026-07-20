import Dexie, { type Table } from 'dexie'
import type {
  ExerciseCatalogItem,
  Routine,
  RoutineDay,
  RoutineExercise,
  WeeklyVolumeTarget,
} from '../domains/routine/types'
import type { AppSettings } from '../domains/settings/types'
import type { DropSetLog, ExerciseLog, SetLog, SkipLog, WorkoutSession } from '../domains/workout/types'

export const CURRENT_SCHEMA_VERSION = 1

export class ArsenDatabase extends Dexie {
  settings!: Table<AppSettings, string>
  routines!: Table<Routine, string>
  routineDays!: Table<RoutineDay, string>
  routineExercises!: Table<RoutineExercise, string>
  exerciseCatalog!: Table<ExerciseCatalogItem, string>
  weeklyVolumeTargets!: Table<WeeklyVolumeTarget, string>
  workoutSessions!: Table<WorkoutSession, string>
  exerciseLogs!: Table<ExerciseLog, string>
  setLogs!: Table<SetLog, string>
  dropSetLogs!: Table<DropSetLog, string>
  skipLogs!: Table<SkipLog, string>

  constructor() {
    super('arsen')

    this.version(1).stores({
      settings: 'id, activeRoutineId, preferredUnit',
      routines: 'id, isActive, name, updatedAt',
      routineDays: 'id, routineId, [routineId+order], weekday',
      routineExercises: 'id, routineId, dayId, canonicalName, [dayId+order], sourceExerciseId',
      exerciseCatalog: 'id, canonicalName, mainMuscle, equipment',
      weeklyVolumeTargets: 'id, routineId, muscle',
      workoutSessions: 'id, routineId, dayId, date, [date+routineId], [date+dayId]',
      exerciseLogs: 'id, sessionId, routineExerciseId, state',
      setLogs: 'id, exerciseLogId, kind, [exerciseLogId+order]',
      dropSetLogs: 'id, setLogId, [setLogId+order]',
      skipLogs: 'id, sessionId, routineExerciseId',
    })
  }
}

export const db = new ArsenDatabase()
