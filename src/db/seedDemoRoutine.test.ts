import 'fake-indexeddb/auto'
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
})
