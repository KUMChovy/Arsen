import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { ensureDemoData } from '../../db/seedDemoRoutine'
import { createGuidedRoutine } from './services'

describe('guided routine creation', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open(); await ensureDemoData() })
  afterEach(async () => { db.close(); await db.delete() })
  it('creates and activates the selected days and exercises together', async () => {
    const item = (await db.exerciseCatalog.toArray())[0]!
    const id = await createGuidedRoutine({ name: 'Mi rutina', days: [{ name: 'Día A', exerciseIds: [item.id] }, { name: 'Día B', exerciseIds: [] }] })
    expect(await db.routines.get(id)).toMatchObject({ name: 'Mi rutina', isActive: true })
    expect((await db.settings.get('app'))?.activeRoutineId).toBe(id)
    expect(await db.routineDays.where('routineId').equals(id).count()).toBe(2)
    expect((await db.routineExercises.where('routineId').equals(id).toArray())[0]).toMatchObject({ sourceExerciseId: item.id })
  })
  it('rolls back the entire routine if an exercise no longer exists', async () => {
    const before = await db.routines.toArray()
    const active = (await db.settings.get('app'))?.activeRoutineId
    await expect(createGuidedRoutine({ name: 'Nueva', days: [{ name: 'Día', exerciseIds: ['missing'] }] })).rejects.toThrow()
    expect(await db.routines.toArray()).toEqual(before)
    expect((await db.settings.get('app'))?.activeRoutineId).toBe(active)
  })
  it('rejects empty names, empty days and duplicate exercises', async () => {
    const item = (await db.exerciseCatalog.toArray())[0]!
    await expect(createGuidedRoutine({ name: ' ', days: [{ name: 'Día', exerciseIds: [] }] })).rejects.toThrow()
    await expect(createGuidedRoutine({ name: 'Rutina', days: [] })).rejects.toThrow()
    await expect(createGuidedRoutine({ name: 'Rutina', days: [{ name: 'Día', exerciseIds: [item.id, item.id] }] })).rejects.toThrow()
  })
})
