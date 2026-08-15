import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import { DEFAULT_AVAILABLE_PLATES_KG } from '../../shared/calculations/equipmentLoad'
import { downloadText } from '../../shared/utils/download'
import {
  buildProgressExport,
  completeActiveDeload,
  exportProgressCsv,
  getDeloadOverview,
  resolveAvailablePlateWeightsKg,
  scheduleDeload,
  skipDeloadSuggestion,
  startDeloadNow,
  updateAvailablePlateWeights,
  updateDeloadReductionSettings,
} from './services'
import type { Routine, RoutineDay, RoutineExercise } from '../routine/types'
import type { DropSetLog, ExerciseLog, SetLog, WorkoutSession } from '../workout/types'
import type { AppSettings } from './types'

vi.mock('../../shared/utils/download', () => ({
  downloadJson: vi.fn(),
  downloadText: vi.fn(),
}))

const now = '2026-01-01T00:00:00.000Z'

describe('settings export services', () => {
  beforeEach(async () => {
    await resetDb()
    vi.mocked(downloadText).mockClear()
  })

  afterEach(async () => {
    await resetDb()
  })

  it('builds serializable progress JSON', async () => {
    await seedProgressData({
      dayName: 'Dia A',
      exerciseName: 'Press inclinado',
      routineName: 'Rutina A',
    })

    const data = await buildProgressExport()

    expect(() => JSON.stringify(data)).not.toThrow()
    expect(data.summary).toMatchObject({
      exercises: 1,
      routines: 1,
      sessions: 1,
      sets: 1,
      volume: 600,
    })
    expect(data.timeline).toHaveLength(1)
    expect(data.timeline[0]).toMatchObject({
      date: '2026-01-02',
      exerciseName: 'Press inclinado',
      routineName: 'Rutina A',
      volume: 600,
    })
  })


  it('resolves default plate weights when settings do not have an inventory', () => {
    expect(resolveAvailablePlateWeightsKg(null)).toEqual(DEFAULT_AVAILABLE_PLATES_KG)
    expect(resolveAvailablePlateWeightsKg({ availablePlateWeightsKg: [] })).toEqual(DEFAULT_AVAILABLE_PLATES_KG)
  })

  it('updates available plate weights normalized in kg', async () => {
    await db.settings.put(appSettings())

    await updateAvailablePlateWeights([2.5, 20, 20, 0, 10])

    await expect(db.settings.get('app')).resolves.toMatchObject({
      availablePlateWeightsKg: [20, 10, 2.5],
    })
  })
  it('exports user-readable progress CSV with BOM and drop-set rows', async () => {
    await seedProgressData({
      dayName: 'Dia A',
      exerciseName: 'Press "inclinado"\npausado',
      routineName: 'Rutina; "A"',
      withDropSet: true,
    })

    await exportProgressCsv()

    const call = vi.mocked(downloadText).mock.calls[0]
    expect(call).toBeDefined()
    if (!call) return
    const [filename, csv, type] = call
    const normalizedCsv = csv.replace(/\r\n/g, '\n')

    expect(filename).toMatch(/^arsen-progreso-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(type).toBe('text/csv;charset=utf-8')
    expect(normalizedCsv.startsWith('\ufeff')).toBe(true)
    const physicalLines = normalizedCsv.slice(1).split('\n')
    expect(physicalLines[0]).toBe('sep=;')
    expect(physicalLines[1]).toBe(
      'Fecha;Rutina;Dia;Ejercicio;Musculo;Equipo;Serie;Tipo de serie;Serie principal;Peso (kg);Repeticiones;RIR;Volumen;Puntaje',
    )
    expect(normalizedCsv).toContain('"Rutina; ""A"""')
    expect(physicalLines).toHaveLength(4)
    expect(normalizedCsv).toContain('"Press ""inclinado"" pausado"')
    expect(normalizedCsv).toContain(';principal;;60,00;10;2;600,00;80,00')
    expect(normalizedCsv).toContain(';Drop 1;drop;1;40,00;10;2;400,00;53,33')
  })
})

describe('deload services', () => {
  beforeEach(async () => {
    await resetDb()
    await db.settings.put(appSettings())
  })

  afterEach(async () => {
    await resetDb()
  })

  it('anchors suggestions to the last completed deload when one exists', async () => {
    await db.workoutSessions.put(workoutSession({ date: '2026-01-01', id: 'session-1' }))
    await db.deloadCycles.put({
      completedAt: '2026-02-01',
      createdAt: now,
      id: 'deload-1',
      scheduledStartDate: null,
      skippedAt: null,
      startedAt: '2026-01-25',
      status: 'completed',
      suggestedAt: '2026-01-20',
      updatedAt: now,
    })

    const overview = await getDeloadOverview('2026-03-12')

    expect(overview.anchorDate).toBe('2026-02-01')
    expect(overview.lastCompletedDate).toBe('2026-02-01')
    expect(overview.weeksSinceAnchor).toBe(5)
    expect(overview.phase).toBe('suggested')
    expect(overview.currentCycle?.status).toBe('suggested')
  })

  it('falls back to first workout session when no deload has completed', async () => {
    await db.workoutSessions.put(workoutSession({ date: '2026-01-01', id: 'session-1' }))

    const overview = await getDeloadOverview('2026-02-05')

    expect(overview.anchorDate).toBe('2026-01-01')
    expect(overview.firstLogDate).toBe('2026-01-01')
    expect(overview.phase).toBe('suggested')
  })

  it('schedules a future deload and activates it on the scheduled date', async () => {
    await scheduleDeload('2026-02-10', '2026-02-01')
    await expect(getDeloadOverview('2026-02-09')).resolves.toMatchObject({
      phase: 'scheduled',
    })

    const overview = await getDeloadOverview('2026-02-10')

    expect(overview.phase).toBe('active')
    expect(overview.currentCycle).toMatchObject({
      scheduledStartDate: '2026-02-10',
      startedAt: '2026-02-10',
      status: 'active',
    })
  })

  it('starts now and auto-completes after seven calendar days', async () => {
    await startDeloadNow('2026-02-01')

    expect(await getDeloadOverview('2026-02-07')).toMatchObject({
      daysRemaining: 1,
      phase: 'active',
    })

    const overview = await getDeloadOverview('2026-02-08')

    expect(overview.phase).toBe('completed')
    expect(overview.currentCycle).toMatchObject({
      completedAt: '2026-02-08',
      status: 'completed',
    })
  })

  it('skips a suggestion and suppresses a new one during cooldown', async () => {
    await db.workoutSessions.put(workoutSession({ date: '2026-01-01', id: 'session-1' }))
    await getDeloadOverview('2026-02-05')
    await skipDeloadSuggestion('2026-02-05')

    expect(await getDeloadOverview('2026-02-06')).toMatchObject({
      cooldownUntil: '2026-02-19',
      phase: 'idle',
      shouldNotify: false,
    })
  })

  it('completes an active deload manually', async () => {
    await startDeloadNow('2026-02-01')
    await completeActiveDeload('2026-02-03')

    await expect(db.deloadCycles.toArray()).resolves.toEqual([
      expect.objectContaining({ completedAt: '2026-02-03', status: 'completed' }),
    ])
  })

  it('updates deload reduction settings with clamped values', async () => {
    await updateDeloadReductionSettings({
      seriesReductionPercent: 99,
      weightReductionPercent: 10,
    })

    await expect(db.settings.get('app')).resolves.toMatchObject({
      deloadSeriesReductionPercent: 60,
      deloadWeightReductionPercent: 70,
    })
  })
})

function appSettings(): AppSettings {
  return {
    activeRoutineId: 'routine-1',
    createdAt: now,
    deloadNotifications: true,
    id: 'app',
    lastDeloadNotificationDate: null,
    notificationPermission: 'default',
    preferredUnit: 'kg',
    schemaVersion: 6,
    storagePersisted: null,
    updatedAt: now,
  }
}

async function resetDb() {
  db.close()
  await db.delete()
  await db.open()
}

async function seedProgressData(input: { dayName: string; exerciseName: string; routineName: string; withDropSet?: boolean }) {
  const routine: Routine = {
    createdAt: now,
    id: 'routine-1',
    isActive: true,
    name: input.routineName,
    updatedAt: now,
  }
  const day: RoutineDay = {
    createdAt: now,
    description: '',
    id: 'day-1',
    name: input.dayName,
    order: 0,
    routineId: routine.id,
    updatedAt: now,
    weekday: null,
  }
  const exercise: RoutineExercise = {
    assetKind: null,
    bundledAssetId: null,
    barWeightKg: 20,
    canonicalName: 'press-inclinado',
    createdAt: now,
    currentWeightKg: 60,
    customAssetId: null,
    dayId: day.id,
    equipment: 'Barra',
    id: 'exercise-1',
    loadMode: 'split',
    mainMuscle: 'Pecho',
    name: input.exerciseName,
    order: 0,
    recommendedRir: 2,
    repsMax: 10,
    repsMin: 8,
    rest: '120 seg',
    restSeconds: 120,
    routineId: routine.id,
    sourceExerciseId: null,
    targetSets: 4,
    technicalNotes: '',
    updatedAt: now,
    warmupProtocol: 'none',
    warmupSets: 0,
  }
  const session: WorkoutSession = {
    createdAt: now,
    date: '2026-01-02',
    dayId: day.id,
    displayUnit: 'kg',
    id: 'session-1',
    notes: '',
    routineId: routine.id,
    status: 'completed',
    updatedAt: now,
  }
  const exerciseLog: ExerciseLog = {
    createdAt: now,
    id: 'exercise-log-1',
    notes: '',
    routineExerciseId: exercise.id,
    sessionId: session.id,
    snapshot: {
      barWeightKg: exercise.barWeightKg,
      canonicalName: exercise.canonicalName,
      equipment: exercise.equipment,
      loadMode: exercise.loadMode,
      mainMuscle: exercise.mainMuscle,
      name: exercise.name,
      recommendedRir: exercise.recommendedRir,
      repsMax: exercise.repsMax,
      repsMin: exercise.repsMin,
      restSeconds: exercise.restSeconds,
      targetSets: exercise.targetSets,
    },
    state: 'done',
    updatedAt: now,
  }
  const setLog: SetLog = {
    createdAt: now,
    displayUnit: 'kg',
    exerciseLogId: exerciseLog.id,
    id: 'set-1',
    kind: 'main',
    order: 0,
    reps: 10,
    rir: 2,
    updatedAt: now,
    weightKg: 60,
  }

  await db.routines.put(routine)
  await db.routineDays.put(day)
  await db.routineExercises.put(exercise)
  await db.workoutSessions.put(session)
  await db.exerciseLogs.put(exerciseLog)
  await db.setLogs.put(setLog)

  if (input.withDropSet) {
    const dropSetLog: DropSetLog = {
      createdAt: now,
      displayUnit: 'kg',
      id: 'drop-set-1',
      order: 0,
      reps: 10,
      rir: 2,
      setLogId: setLog.id,
      updatedAt: now,
      weightKg: 40,
    }

    await db.dropSetLogs.put(dropSetLog)
  }
}

function workoutSession(input: { date: string; id: string }): WorkoutSession {
  return {
    createdAt: now,
    date: input.date,
    dayId: 'day-1',
    displayUnit: 'kg',
    id: input.id,
    notes: '',
    routineId: 'routine-1',
    status: 'completed',
    updatedAt: now,
  }
}