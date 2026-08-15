import Dexie, { type Table } from 'dexie'
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
import { loadSettingsForEquipment } from '../shared/calculations/equipmentLoad'
import { DEFAULT_DELOAD_SERIES_PERCENT, DEFAULT_DELOAD_WEIGHT_PERCENT } from '../shared/calculations/deload'
import { normalizeWarmupProtocol } from '../shared/calculations/warmups'

export const CURRENT_SCHEMA_VERSION = 7

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

  constructor() {
    super('arsen')

    this.version(1).stores({
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
    })

    this.version(2)
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
        exerciseAssets: 'id, updatedAt',
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
        exerciseAssets: 'id, updatedAt',
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
        exerciseAssets: 'id, updatedAt',
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

    this.version(6)
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
      })
      .upgrade((tx) =>
        Promise.all([
          tx
            .table('exerciseCatalog')
            .toCollection()
            .modify((item) => {
              item.assetKind = typeof item.assetKind === 'string' ? item.assetKind : null
              item.customAssetId = typeof item.customAssetId === 'string' ? item.customAssetId : null
            }),
          tx
            .table('routineExercises')
            .toCollection()
            .modify((item) => {
              item.assetKind = typeof item.assetKind === 'string' ? item.assetKind : null
              item.customAssetId = typeof item.customAssetId === 'string' ? item.customAssetId : null
            }),
          tx
            .table('exerciseLogs')
            .toCollection()
            .modify((log) => {
              log.snapshot.assetKind = typeof log.snapshot.assetKind === 'string' ? log.snapshot.assetKind : null
              log.snapshot.customAssetId = typeof log.snapshot.customAssetId === 'string' ? log.snapshot.customAssetId : null
            }),
        ]),
      )
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
      .upgrade((tx) =>
        tx
          .table('settings')
          .toCollection()
          .modify((settings) => {
            settings.deloadSeriesReductionPercent =
              typeof settings.deloadSeriesReductionPercent === 'number'
                ? settings.deloadSeriesReductionPercent
                : DEFAULT_DELOAD_SERIES_PERCENT
            settings.deloadWeightReductionPercent =
              typeof settings.deloadWeightReductionPercent === 'number'
                ? settings.deloadWeightReductionPercent
                : DEFAULT_DELOAD_WEIGHT_PERCENT
          }),
      )
  }
}

export const db = new ArsenDatabase()
