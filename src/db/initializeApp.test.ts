import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './schema'
import { ensureDemoData } from './seedDemoRoutine'
import { initializeApp } from './initializeApp'

describe('initialization without a default routine', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open() })

  it('starts a new installation with settings and no routine or personal exercises', async () => {
    await initializeApp()
    expect(await db.routines.count()).toBe(0)
    expect(await db.exerciseCatalog.count()).toBe(0)
    expect((await db.settings.get('app'))?.activeRoutineId).toBeNull()
    expect(await db.localMetadata.get('productTour')).toEqual({ id: 'productTour', value: 'pending' })
  })

  it('removes the modified demo only once and retains catalog, other routines, and historical session names', async () => {
    await ensureDemoData()
    await db.localMetadata.put({ id: 'pageTours', value: ['routine', 'settings', 'workout'] })
    const day = (await db.routineDays.toArray())[0]!
    await db.routines.update('routine-demo-current', { name: 'Mi rutina modificada' })
    const now = new Date().toISOString()
    await db.routines.add({ id: 'other', name: 'Otra rutina', isActive: false, createdAt: now, updatedAt: now })
    await db.workoutSessions.add({ id: 'session', routineId: 'routine-demo-current', dayId: day.id, date: '2026-01-01', startedAt: now, endedAt: null, status: 'in-progress', createdAt: now, updatedAt: now } as never)
    const count = await db.exerciseCatalog.count()
    await initializeApp()
    expect(await db.routines.get('routine-demo-current')).toBeUndefined()
    expect((await db.settings.get('app'))?.activeRoutineId).toBe('other')
    expect((await db.routines.get('other'))?.isActive).toBe(true)
    expect(await db.exerciseCatalog.count()).toBe(count)
    expect(await db.localMetadata.get('pageTours')).toEqual({ id: 'pageTours', value: [] })
    expect(await db.workoutSessions.get('session')).toMatchObject({ routineName: 'Mi rutina modificada', dayName: day.name })
    await db.routines.add({ id: 'routine-demo-current', name: 'Restaurada', isActive: false, createdAt: now, updatedAt: now })
    await initializeApp()
    expect(await db.routines.get('routine-demo-current')).toBeDefined()
  })
  it('keeps another already active routine selected while removing the demo', async () => {
    await ensureDemoData()
    const now = new Date().toISOString()
    await db.routines.update('routine-demo-current', { isActive: false })
    await db.routines.add({ id: 'active', name: 'Activa', isActive: true, createdAt: now, updatedAt: now })
    await db.settings.update('app', { activeRoutineId: 'active' })
    await initializeApp()
    expect((await db.settings.get('app'))?.activeRoutineId).toBe('active')
    expect((await db.routines.get('active'))?.isActive).toBe(true)
  })
  it('does not modify a partially populated database without settings', async () => {
    const now = new Date().toISOString()
    await db.routines.add({ id: 'kept', name: 'Conservar', isActive: false, createdAt: now, updatedAt: now })
    await expect(initializeApp()).rejects.toThrow()
    expect(await db.routines.get('kept')).toBeDefined()
  })
})
