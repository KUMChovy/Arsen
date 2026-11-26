import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CURRENT_SCHEMA_VERSION, db } from './schema'
import { ensureDemoData } from './seedDemoRoutine'

describe('demo initialization', () => {
  beforeEach(async () => {
    db.close()
    await db.delete()
    await db.open()
  })

  afterEach(() => db.close())

  it('initializes an empty database with the current schema version', async () => {
    await ensureDemoData()
    expect((await db.settings.get('app'))?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(await db.routines.count()).toBe(1)
    expect(await db.localMetadata.get('productTour')).toEqual({ id: 'productTour', value: 'pending' })
  })

  it('does not restart the tour when initialization runs again', async () => {
    await ensureDemoData()
    await db.localMetadata.put({ id: 'productTour', value: 'completed' })
    await ensureDemoData()
    expect(await db.localMetadata.get('productTour')).toEqual({ id: 'productTour', value: 'completed' })
  })

  it('preserves a partially populated database instead of adding demo data', async () => {
    const routine = { id: 'existing', name: 'Existing', isActive: false, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }
    await db.routines.add(routine)
    await expect(ensureDemoData()).rejects.toThrow()
    expect(await db.routines.toArray()).toEqual([routine])
    expect(await db.settings.count()).toBe(0)
  })

  it('initializes only once when invoked concurrently', async () => {
    await Promise.all([ensureDemoData(), ensureDemoData()])
    expect(await db.routines.count()).toBe(1)
    expect(await db.settings.count()).toBe(1)
  })

  it('detects invalid existing settings without reseeding or changing data', async () => {
    await ensureDemoData()
    await db.settings.update('app', { preferredUnit: 'invalid' as 'kg' })
    const before = await db.routines.toArray()
    await expect(ensureDemoData()).rejects.toThrow()
    expect(await db.routines.toArray()).toEqual(before)
    expect((await db.settings.get('app'))?.preferredUnit).toBe('invalid')
  })

  it('adds revision storage to a version 7 development database without replacing its data', async () => {
    db.close()
    await db.delete()
    const previous = new Dexie('arsen')
    previous.version(7).stores({ settings: 'id, activeRoutineId, preferredUnit', routines: 'id, isActive, name, updatedAt' })
    await previous.open()
    const now = '2026-01-01T00:00:00.000Z'
    await previous.table('settings').add({ id: 'app', schemaVersion: 7, activeRoutineId: null, preferredUnit: 'kg', deloadNotifications: true, storagePersisted: null, createdAt: now, updatedAt: now })
    await previous.table('routines').add({ id: 'kept', name: 'Conservada', isActive: false, createdAt: now, updatedAt: now })
    previous.close()
    await db.open()
    await ensureDemoData()
    expect((await db.settings.get('app'))?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect((await db.routines.get('kept'))?.name).toBe('Conservada')
    expect((await db.localMetadata.get('revision'))?.value).toBeGreaterThan(0)
  })
})
