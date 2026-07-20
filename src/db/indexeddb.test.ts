import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from './schema'
import type { Routine, RoutineDay, RoutineExercise } from '../domains/routine/types'
import type { AppSettings } from '../domains/settings/types'
import { buildProgressExport, importFullBackup } from '../domains/settings/services'
import {
  deleteWorkoutSession,
  registerMainSetForExercise,
  skipRoutineExerciseForDay,
} from '../domains/workout/services'

const now = '2026-07-20T00:00:00.000Z'

describe('IndexedDB integration', () => {
  beforeEach(async () => {
    await resetDb()
  })

  afterEach(async () => {
    await resetDb()
  })

  it('replaces local backup tables when mode is replace', async () => {
    await db.settings.put(settings('local-routine', 'lb'))
    await db.routines.put(routine('local-routine', 'Local'))

    await importFullBackup(
      backupFile({
        settings: [settings('remote-routine', 'kg')],
        routines: [routine('remote-routine', 'Remote')],
      }),
      'replace',
    )

    await expect(db.routines.toArray()).resolves.toEqual([routine('remote-routine', 'Remote')])
    await expect(db.settings.get('app')).resolves.toMatchObject({
      activeRoutineId: 'remote-routine',
      preferredUnit: 'kg',
    })
  })

  it('merges backup tables without replacing existing app settings', async () => {
    await db.settings.put(settings('local-routine', 'lb'))
    await db.routines.put(routine('local-routine', 'Local'))

    await importFullBackup(
      backupFile({
        settings: [settings('remote-routine', 'kg')],
        routines: [routine('remote-routine', 'Remote')],
      }),
      'merge',
    )

    await expect(db.routines.orderBy('id').toArray()).resolves.toEqual([
      routine('local-routine', 'Local'),
      routine('remote-routine', 'Remote'),
    ])
    await expect(db.settings.get('app')).resolves.toMatchObject({
      activeRoutineId: 'local-routine',
      preferredUnit: 'lb',
    })
  })

  it('registers main sets, drop sets and completes exercise state', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)

    const first = await registerMainSetForExercise({
      date: '2026-07-20',
      dayId: exercise.dayId,
      displayUnit: 'kg',
      dropSet: { reps: 10, rir: 2, weightKg: 48 },
      exercise,
      reps: 8,
      rir: 1,
      routineId: exercise.routineId,
      weightKg: 60,
    })
    const second = await registerMainSetForExercise({
      date: '2026-07-20',
      dayId: exercise.dayId,
      displayUnit: 'kg',
      exercise,
      reps: 7,
      rir: 1,
      routineId: exercise.routineId,
      weightKg: 62.5,
    })

    expect(second.sessionId).toBe(first.sessionId)
    await expect(db.workoutSessions.count()).resolves.toBe(1)
    await expect(db.setLogs.where('exerciseLogId').equals(first.exerciseLogId).count()).resolves.toBe(2)
    await expect(db.dropSetLogs.where('setLogId').equals(first.setLogId).count()).resolves.toBe(1)
    await expect(db.exerciseLogs.get(first.exerciseLogId)).resolves.toMatchObject({ state: 'done' })
    await expect(db.routineExercises.get(exercise.id)).resolves.toMatchObject({ currentWeightKg: 62.5 })
  })

  it('deletes workout session with logs, sets, drop sets and skips', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)
    const registered = await registerMainSetForExercise({
      date: '2026-07-20',
      dayId: exercise.dayId,
      displayUnit: 'kg',
      dropSet: { reps: 12, rir: 2, weightKg: 40 },
      exercise,
      reps: 8,
      rir: 1,
      routineId: exercise.routineId,
      weightKg: 50,
    })
    await skipRoutineExerciseForDay({
      date: '2026-07-20',
      dayId: exercise.dayId,
      displayUnit: 'kg',
      exercise,
      routineId: exercise.routineId,
    })

    await deleteWorkoutSession(registered.sessionId)

    await expect(db.workoutSessions.count()).resolves.toBe(0)
    await expect(db.exerciseLogs.count()).resolves.toBe(0)
    await expect(db.setLogs.count()).resolves.toBe(0)
    await expect(db.dropSetLogs.count()).resolves.toBe(0)
    await expect(db.skipLogs.count()).resolves.toBe(0)
  })

  it('exports chronological progress with routines, graph points and drop set volume', async () => {
    const routineA = routine('routine-a', 'Rutina A')
    const routineB = routine('routine-b', 'Rutina B')
    const dayA = routineDay('day-a', routineA.id, 'Dia A')
    const dayB = routineDay('day-b', routineB.id, 'Dia B')
    const exerciseA = routineExercise({ dayId: dayA.id, id: 'exercise-a', routineId: routineA.id })
    const exerciseB = routineExercise({ dayId: dayB.id, id: 'exercise-b', routineId: routineB.id })
    await db.routines.bulkPut([routineA, routineB])
    await db.routineDays.bulkPut([dayA, dayB])
    await db.routineExercises.bulkPut([exerciseA, exerciseB])

    await registerMainSetForExercise({
      date: '2026-07-27',
      dayId: dayB.id,
      displayUnit: 'kg',
      exercise: exerciseB,
      reps: 5,
      rir: 1,
      routineId: routineB.id,
      weightKg: 80,
    })
    await registerMainSetForExercise({
      date: '2026-07-20',
      dayId: dayA.id,
      displayUnit: 'kg',
      dropSet: { reps: 10, rir: 2, weightKg: 40 },
      exercise: exerciseA,
      reps: 8,
      rir: 1,
      routineId: routineA.id,
      weightKg: 60,
    })

    const exported = await buildProgressExport()

    expect(exported.timeline.map((row) => row.date)).toEqual(['2026-07-20', '2026-07-27'])
    expect(exported.timeline[0]).toMatchObject({
      canonicalName: 'press-inclinado',
      dayName: 'Dia A',
      exerciseName: 'Press inclinado',
      routineName: 'Rutina A',
      volume: 880,
    })
    expect(exported.graphPoints).toEqual([
      expect.objectContaining({
        canonicalName: 'press-inclinado',
        date: '2026-07-20',
        routineName: 'Rutina A',
        volume: 880,
      }),
      expect.objectContaining({
        canonicalName: 'press-inclinado',
        date: '2026-07-27',
        routineName: 'Rutina B',
        volume: 400,
      }),
    ])
    expect(exported.summary).toMatchObject({
      exercises: 1,
      routines: 2,
      sessions: 2,
      sets: 2,
      volume: 1280,
    })
  })
})

async function resetDb() {
  db.close()
  await db.delete()
  await db.open()
}

function backupFile(tables: {
  routines?: Routine[]
  settings?: AppSettings[]
}) {
  return new File(
    [
      JSON.stringify({
        exportedAt: now,
        schemaVersion: 1,
        tables,
      }),
    ],
    'backup.json',
    { type: 'application/json' },
  )
}

function routine(id: string, name: string): Routine {
  return {
    createdAt: now,
    id,
    isActive: id.includes('local'),
    name,
    updatedAt: now,
  }
}

function settings(activeRoutineId: string, preferredUnit: 'kg' | 'lb'): AppSettings {
  return {
    activeRoutineId,
    createdAt: now,
    deloadNotifications: true,
    id: 'app',
    preferredUnit,
    schemaVersion: 1,
    storagePersisted: null,
    updatedAt: now,
  }
}

function routineDay(id: string, routineId: string, name: string): RoutineDay {
  return {
    createdAt: now,
    description: '',
    id,
    name,
    order: 0,
    routineId,
    updatedAt: now,
    weekday: null,
  }
}

function routineExercise(
  overrides: Partial<Pick<RoutineExercise, 'dayId' | 'id' | 'routineId'>> = {},
): RoutineExercise {
  return {
    canonicalName: 'press-inclinado',
    createdAt: now,
    currentWeightKg: 50,
    dayId: overrides.dayId ?? 'day-1',
    equipment: 'Barra',
    id: overrides.id ?? 'exercise-1',
    mainMuscle: 'Pecho',
    name: 'Press inclinado',
    order: 0,
    progression: '',
    recommendedRir: '1-2',
    repRange: '8-10',
    rest: '90 seg',
    restSeconds: 90,
    routineId: overrides.routineId ?? 'routine-1',
    sourceExerciseId: null,
    targetSets: 2,
    technicalNotes: '',
    updatedAt: now,
    warmupProtocol: '',
    warmupSets: 0,
  }
}
