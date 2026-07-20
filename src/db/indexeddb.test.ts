import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from './schema'
import type { Routine, RoutineExercise } from '../domains/routine/types'
import type { AppSettings } from '../domains/settings/types'
import { importFullBackup } from '../domains/settings/services'
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

function routineExercise(): RoutineExercise {
  return {
    canonicalName: 'press-inclinado',
    createdAt: now,
    currentWeightKg: 50,
    dayId: 'day-1',
    equipment: 'Barra',
    id: 'exercise-1',
    mainMuscle: 'Pecho',
    name: 'Press inclinado',
    order: 0,
    progression: '',
    recommendedRir: '1-2',
    repRange: '8-10',
    rest: '90 seg',
    restSeconds: 90,
    routineId: 'routine-1',
    sourceExerciseId: null,
    targetSets: 2,
    technicalNotes: '',
    updatedAt: now,
    warmupProtocol: '',
    warmupSets: 0,
  }
}
