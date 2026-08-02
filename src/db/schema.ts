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
import { loadSettingsForEquipment } from '../shared/calculations/equipmentLoad'
import { normalizeWarmupProtocol } from '../shared/calculations/warmups'

export const CURRENT_SCHEMA_VERSION = 5

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

    this.version(2)
      .stores({
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
      .upgrade((tx) =>
        tx
          .table('routineExercises')
          .toCollection()
          .modify((item) => {
            delete item.progression
          }),
      )

    this.version(3)
      .stores({
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
      .upgrade((tx) =>
        tx
          .table('exerciseCatalog')
          .toCollection()
          .modify((item) => {
            delete item.progressionStrategy
          }),
      )

    this.version(4)
      .stores({
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
      .upgrade((tx) =>
        Promise.all([
          tx
            .table('exerciseCatalog')
            .toCollection()
            .modify((item) => {
              item.warmupProtocol = normalizeWarmupProtocol(item.warmupProtocol)
            }),
          tx
            .table('routineExercises')
            .toCollection()
            .modify((item) => {
              item.warmupProtocol = normalizeWarmupProtocol(item.warmupProtocol)
            }),
        ]),
      )

    this.version(5)
      .stores({
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
      .upgrade((tx) =>
        Promise.all(
          ['exerciseCatalog', 'routineExercises'].map((tableName) =>
            tx
              .table(tableName)
              .toCollection()
              .modify((item) => {
                const settings = loadSettingsForEquipment({
                  barWeightKg: item.barWeightKg,
                  equipment: item.equipment,
                  loadMode: item.loadMode,
                })
                item.equipment = settings.equipment
                item.loadMode = settings.loadMode
                item.barWeightKg = settings.barWeightKg
              }),
          ),
        ),
      )
  }
}

export const db = new ArsenDatabase()
