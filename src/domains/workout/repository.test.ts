import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { getPendingWorkoutSessions } from './repository'

beforeEach(async () => { db.close(); await db.delete(); await db.open() })
afterEach(async () => { db.close(); await db.delete() })

it('finds unfinished sessions with saved work and excludes empty drafts', async () => {
  const base = { routineId: 'r', dayId: 'd', date: '2026-08-01', displayUnit: 'kg' as const, status: 'draft' as const, notes: '', createdAt: '2026-08-01', updatedAt: '2026-08-01' }
  await db.routines.add({ id: 'r', name: 'Rutina', isActive: true, createdAt: base.createdAt, updatedAt: base.updatedAt })
  await db.routineDays.bulkAdd([{ id: 'd', routineId: 'r', name: 'Día', description: '', order: 0, weekday: null, createdAt: base.createdAt, updatedAt: base.updatedAt }, { id: 'd2', routineId: 'r', name: 'Día 2', description: '', order: 1, weekday: null, createdAt: base.createdAt, updatedAt: base.updatedAt }])
  await db.workoutSessions.bulkAdd([{ ...base, id: 'active' }, { ...base, id: 'empty', dayId: 'd2' }])
  await db.exerciseLogs.add({ id: 'log', sessionId: 'active', routineExerciseId: 'e', state: 'in_progress', notes: '', snapshot: { name: 'Press', canonicalName: 'press', mainMuscle: 'Pecho', equipment: 'Barra', targetSets: 3, repsMin: 8, repsMax: 10, recommendedRir: 2, restSeconds: 90 }, createdAt: base.createdAt, updatedAt: base.updatedAt })
  await db.setLogs.add({ id: 'set', exerciseLogId: 'log', kind: 'main', order: 0, weightKg: 60, displayUnit: 'kg', reps: 8, rir: 2, createdAt: base.createdAt, updatedAt: base.updatedAt })
  expect((await getPendingWorkoutSessions()).map((session) => session.id)).toEqual(['active'])
})

it('does not offer a deleted routine or day as a resumable session', async () => {
  await db.workoutSessions.add({ id: 'old', routineId: 'deleted', dayId: 'deleted-day', date: '2026-08-01', displayUnit: 'kg', status: 'draft', notes: 'Nota guardada', createdAt: '2026-08-01', updatedAt: '2026-08-01' })
  expect(await getPendingWorkoutSessions()).toEqual([])
  expect(await db.workoutSessions.get('old')).toBeDefined()
})
