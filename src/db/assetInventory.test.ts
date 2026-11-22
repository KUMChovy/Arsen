import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from './schema'
import { ensureDemoData } from './seedDemoRoutine'
import { inspectExerciseAssets } from './assetInventory'

describe('exercise asset inventory', () => {
  beforeEach(async () => {
    db.close()
    await db.delete()
    await db.open()
    await ensureDemoData()
  })
  afterEach(() => db.close())

  it('reports binary size and references without exposing image content', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    const exercise = (await db.routineExercises.toArray())[0]!
    const catalog = (await db.exerciseCatalog.toArray())[0]!
    await db.exerciseAssets.add({ id: 'image', name: 'Imagen', mimeType: 'image/png', dataUrl: 'data:image/png;base64,AQIDBA==', createdAt: now, updatedAt: now })
    await db.routineExercises.update(exercise.id, { customAssetId: 'image' })
    await db.exerciseCatalog.update(catalog.id, { customAssetId: 'image' })
    const inventory = await inspectExerciseAssets()
    expect(inventory).toEqual([expect.objectContaining({ id: 'image', sizeBytes: 4, references: expect.arrayContaining([
      { entity: 'routineExercises', id: exercise.id }, { entity: 'exerciseCatalog', id: catalog.id },
    ]) })])
    expect(JSON.stringify(inventory)).not.toContain('AQIDBA==')
  })

  it('includes references from historical snapshots and identifies missing assets', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    const exercise = (await db.routineExercises.toArray())[0]!
    await db.workoutSessions.add({ id: 'session', routineId: 'deleted', dayId: 'deleted', date: '2026-08-01', notes: '', displayUnit: 'kg', status: 'completed', sessionExercises: [{ ...exercise, customAssetId: 'missing' }], createdAt: now, updatedAt: now })
    await db.exerciseLogs.add({ id: 'log', sessionId: 'session', routineExerciseId: exercise.id, state: 'done', notes: '', snapshot: { ...exercise, customAssetId: 'missing' }, createdAt: now, updatedAt: now })
    expect(await inspectExerciseAssets()).toEqual([expect.objectContaining({ id: 'missing', missing: true, sizeBytes: null, references: expect.arrayContaining([
      { entity: 'workoutSessions', id: 'session' }, { entity: 'exerciseLogs', id: 'log' },
    ]) })])
  })

  it('retains unused images and leaves unrecognized content sizes unknown', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    await db.exerciseAssets.add({ id: 'unused', name: 'Imagen', mimeType: 'image/svg+xml', dataUrl: 'data:image/svg+xml,%3Csvg%3E', createdAt: now, updatedAt: now })
    expect(await inspectExerciseAssets()).toEqual([expect.objectContaining({ id: 'unused', missing: false, sizeBytes: null, references: [] })])
    expect(await db.exerciseAssets.get('unused')).toBeDefined()
  })
})
