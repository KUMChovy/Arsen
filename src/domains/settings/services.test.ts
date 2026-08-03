import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import { downloadText } from '../../shared/utils/download'
import { buildProgressExport, exportProgressCsv } from './services'
import type { Routine, RoutineDay, RoutineExercise } from '../routine/types'
import type { ExerciseLog, SetLog, WorkoutSession } from '../workout/types'

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

  it('exports valid escaped progress CSV', async () => {
    await seedProgressData({
      dayName: 'Dia, A',
      exerciseName: 'Press "inclinado"\npausado',
      routineName: 'Rutina, "A"',
    })

    await exportProgressCsv()

    const call = vi.mocked(downloadText).mock.calls[0]
    expect(call).toBeDefined()
    if (!call) return
    const [filename, csv, type] = call

    expect(filename).toMatch(/^arsen-progreso-\d{4}-\d{2}-\d{2}\.csv$/)
    expect(type).toBe('text/csv')
    expect(csv).toContain(
      'date,routine,routine_id,day,day_id,exercise,exercise_log_id,routine_exercise_id,muscle,equipment,set_order,set_log_id,weight_kg,reps,rir,volume,score',
    )
    expect(csv).toContain('"Rutina, ""A"""')
    expect(csv).toContain('"Dia, A"')
    expect(csv).toContain('"Press ""inclinado""\npausado"')
  })
})

async function resetDb() {
  db.close()
  await db.delete()
  await db.open()
}

async function seedProgressData(input: { dayName: string; exerciseName: string; routineName: string }) {
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
}
