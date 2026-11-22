import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import { addCatalogExerciseToDay, createCatalogExercise, createDay, createExercise, createExerciseAsset, createRoutine, deleteDay, deleteRoutine, duplicateExercise, duplicateRoutine, moveExerciseToDay, renameRoutine, reorderDays, reorderExercises, setActiveRoutine, updateCatalogExercise, updateExercise } from './services'

async function resetDb() {
  db.close()
  await db.delete()
  await db.open()
}

describe('routine services Sinful Shell catalog', () => {
  beforeEach(resetDb)

  afterEach(async () => {
    db.close()
    await db.delete()
  })

  it('rejects a day whose routine does not exist', async () => {
    await expect(createDay('missing', 'Día')).rejects.toThrow()
    expect(await db.routineDays.count()).toBe(0)
  })

  it('does not deactivate routines when the requested active routine is missing', async () => {
    const routine = await createRoutine('Rutina')
    const now = '2026-08-01T00:00:00.000Z'
    await db.routines.update(routine, { isActive: true })
    await db.settings.put({ id: 'app', schemaVersion: 7, activeRoutineId: routine, preferredUnit: 'kg', deloadNotifications: true, storagePersisted: null, createdAt: now, updatedAt: now })
    await expect(setActiveRoutine('missing')).rejects.toThrow()
    expect((await db.routines.get(routine))?.isActive).toBe(true)
    expect((await db.settings.get('app'))?.activeRoutineId).toBe(routine)
  })

  it('does not activate a routine when application settings are missing', async () => {
    const routine = await createRoutine('Rutina')
    await expect(setActiveRoutine(routine)).rejects.toThrow()
    expect((await db.routines.get(routine))?.isActive).toBe(false)
  })

  it('keeps a concurrent active-routine selection when deleting the previous routine', async () => {
    const now = '2026-08-01T00:00:00.000Z'
    await db.routines.bulkAdd(['a', 'b', 'c'].map((id) => ({ id, name: id, isActive: id === 'a', createdAt: now, updatedAt: now })))
    await db.settings.put({ id: 'app', schemaVersion: 7, activeRoutineId: 'a', preferredUnit: 'kg', deloadNotifications: true, storagePersisted: null, createdAt: now, updatedAt: now })
    const original = db.settings.get.bind(db.settings)
    let pending: Promise<unknown> | undefined
    const getWithConcurrentSelection = (() => Dexie.Promise.resolve((async () => {
      const settings = await original('app')
      pending = Dexie.ignoreTransaction(() => setActiveRoutine('b'))
      const race = Promise.race([pending, new Promise<void>((resolve) => setTimeout(resolve, 40))])
      await (Dexie.currentTransaction ? Dexie.waitFor(race) : race)
      return settings
    })())) as typeof db.settings.get
    const spy = vi.spyOn(db.settings, 'get').mockImplementationOnce(getWithConcurrentSelection)
    try {
      await deleteRoutine('a')
      await pending
      expect((await db.settings.get('app'))?.activeRoutineId).toBe('b')
      expect((await db.routines.get('b'))?.isActive).toBe(true)
    } finally {
      spy.mockRestore()
    }
  })

  it('rejects an image whose data URL does not match its MIME type', async () => {
    await expect(createExerciseAsset({ name: 'imagen', mimeType: 'image/jpeg', dataUrl: 'data:image/png;base64,AAAA' })).rejects.toThrow()
    expect(await db.exerciseAssets.count()).toBe(0)
  })

  it('rejects a new routine exercise referencing a missing custom image', async () => {
    const routine = await createRoutine('Rutina')
    const day = await createDay(routine, 'Día')
    await expect(createExercise(routine, day, { name: 'Press', mainMuscle: 'Pecho', customAssetId: 'missing' })).rejects.toThrow()
    expect(await db.routineExercises.count()).toBe(0)
  })

  it('rejects invalid set counts and non-finite weights when creating a routine exercise', async () => {
    const routine = await createRoutine('Rutina')
    const day = await createDay(routine, 'Día')
    await expect(createExercise(routine, day, { name: 'Press', mainMuscle: 'Pecho', targetSets: -1 })).rejects.toThrow()
    await expect(createExercise(routine, day, { name: 'Press', mainMuscle: 'Pecho', currentWeightKg: Infinity })).rejects.toThrow()
    await expect(createExercise(routine, day, { name: 'Press', mainMuscle: 'Pecho', barWeightKg: -1 })).rejects.toThrow()
    expect(await db.routineExercises.count()).toBe(0)
  })

  it('rejects invalid catalog recipe values without creating an item', async () => {
    await expect(createCatalogExercise({ name: 'Press', mainMuscle: 'Pecho', defaultTargetSets: -1 })).rejects.toThrow()
    await expect(createCatalogExercise({ name: 'Press', mainMuscle: 'Pecho', barWeightKg: -1 })).rejects.toThrow()
    expect(await db.exerciseCatalog.count()).toBe(0)
  })

  it('rejects invalid recipe edits without modifying an existing exercise', async () => {
    const routine = await createRoutine('Rutina')
    const day = await createDay(routine, 'Día')
    const exercise = await createExercise(routine, day, { name: 'Press', mainMuscle: 'Pecho' })
    await expect(updateExercise(exercise, { name: 'Press', mainMuscle: 'Pecho', targetSets: -1 })).rejects.toThrow()
    expect((await db.routineExercises.get(exercise))?.targetSets).toBe(3)
  })

  it('rejects invalid recipe edits without modifying an existing catalog item', async () => {
    const catalog = await createCatalogExercise({ name: 'Press', mainMuscle: 'Pecho' })
    await expect(updateCatalogExercise(catalog, { name: 'Press', mainMuscle: 'Pecho', defaultTargetSets: -1 })).rejects.toThrow()
    expect((await db.exerciseCatalog.get(catalog))?.defaultTargetSets).toBe(3)
  })

  it('rejects adding a missing custom image to an existing routine exercise', async () => {
    const routine = await createRoutine('Rutina')
    const day = await createDay(routine, 'Día')
    const exercise = await createExercise(routine, day, { name: 'Press', mainMuscle: 'Pecho' })
    await expect(updateExercise(exercise, { name: 'Otro', mainMuscle: 'Pecho', customAssetId: 'missing' })).rejects.toThrow()
    expect(await db.routineExercises.get(exercise)).toMatchObject({ name: 'Press', customAssetId: null })
  })

  it('rejects copying a catalog exercise whose custom image is missing', async () => {
    const routine = await createRoutine('Rutina')
    const day = await createDay(routine, 'Día')
    const catalog = await createCatalogExercise({ name: 'Press', mainMuscle: 'Pecho' })
    await db.exerciseCatalog.update(catalog, { customAssetId: 'missing' })
    await expect(addCatalogExerciseToDay(routine, day, catalog)).rejects.toThrow()
    expect(await db.routineExercises.count()).toBe(0)
  })

  it('rejects creating a catalog exercise with a missing custom image', async () => {
    await expect(createCatalogExercise({ name: 'Press', mainMuscle: 'Pecho', customAssetId: 'missing' })).rejects.toThrow()
    expect(await db.exerciseCatalog.count()).toBe(0)
  })

  it('rejects updating a catalog exercise with a missing custom image', async () => {
    const id = await createCatalogExercise({ name: 'Press', mainMuscle: 'Pecho' })
    await expect(updateCatalogExercise(id, { name: 'Press', mainMuscle: 'Pecho', customAssetId: 'missing' })).rejects.toThrow()
    expect((await db.exerciseCatalog.get(id))?.customAssetId).toBeNull()
  })

  it('assigns distinct order to days created concurrently', async () => {
    const routineId = await createRoutine('Rutina')
    await Promise.all([createDay(routineId, 'Uno'), createDay(routineId, 'Dos')])
    expect((await db.routineDays.toArray()).map((day) => day.order).sort()).toEqual([0, 1])
  })

  it('rejects an exercise assigned to a day from another routine', async () => {
    const first = await createRoutine('Una')
    const second = await createRoutine('Otra')
    const day = await createDay(second, 'Día')
    await expect(createExercise(first, day, { name: 'Press', mainMuscle: 'Pecho' })).rejects.toThrow()
    expect(await db.routineExercises.count()).toBe(0)
  })

  it('rejects adding a catalog exercise to another routine’s day', async () => {
    const first = await createRoutine('Una')
    const second = await createRoutine('Otra')
    const day = await createDay(second, 'Día')
    const catalog = await createCatalogExercise({ name: 'Remo', mainMuscle: 'Espalda' })
    await expect(addCatalogExerciseToDay(first, day, catalog)).rejects.toThrow()
    expect(await db.routineExercises.count()).toBe(0)
  })

  it('assigns distinct order to exercises created concurrently', async () => {
    const routine = await createRoutine('Rutina')
    const day = await createDay(routine, 'Día')
    await Promise.all([
      createExercise(routine, day, { name: 'Press', mainMuscle: 'Pecho' }),
      createExercise(routine, day, { name: 'Remo', mainMuscle: 'Espalda' }),
    ])
    expect((await db.routineExercises.toArray()).map((exercise) => exercise.order).sort()).toEqual([0, 1])
  })

  it('does not duplicate a routine containing an exercise with a missing day', async () => {
    const routine = await createRoutine('Rutina')
    const day = await createDay(routine, 'Día')
    await createExercise(routine, day, { name: 'Press', mainMuscle: 'Pecho' })
    await db.routineDays.delete(day)
    await expect(duplicateRoutine(routine)).rejects.toThrow()
    expect(await db.routines.count()).toBe(1)
    expect(await db.routineExercises.count()).toBe(1)
  })

  it('creates a locked personal copy from manifest values', async () => {
    const id = await createCatalogExercise({
      aliases: ['usuario puede editar aliases'],
      equipment: 'Mancuerna',
      loadMode: 'single',
      mainMuscle: 'Piernas',
      mode: 'create-from-sinful-shell',
      name: 'Nombre falsificado',
      sinfulShellId: 'sinful-shell-press-inclinado',
      technicalNotes: 'texto falsificado',
      warmupProtocol: 'hypertrophy',
    })

    const item = await db.exerciseCatalog.get(id)

    expect(item).toMatchObject({
      aliases: ['usuario puede editar aliases'],
      bundledAssetId: 'press-inclinado--pecho',
      canonicalName: 'press-inclinado',
      equipment: 'Mancuerna',
      mainMuscle: 'Pecho',
      name: 'Press inclinado',
      origin: 'sinful-shell',
      sinfulShellContentLocked: true,
      sinfulShellId: 'sinful-shell-press-inclinado',
      warmupProtocol: 'hypertrophy',
    })
    expect(item?.technicalNotes).toMatch(/^M/)
    expect(item?.technicalNotes).toContain('pector')
  })

  it('records the source catalog version and active state on a Sinful Shell copy', async () => {
    const id = await createCatalogExercise({ mode: 'create-from-sinful-shell', sinfulShellId: 'sinful-shell-press-inclinado' })
    expect(await db.exerciseCatalog.get(id)).toMatchObject({ origin: 'sinful-shell', sinfulShellId: 'sinful-shell-press-inclinado', catalogVersion: 1, catalogStatus: 'active' })
  })

  it('returns the existing copy instead of duplicating sinfulShellId', async () => {
    const firstId = await createCatalogExercise({
      mode: 'create-from-sinful-shell',
      sinfulShellId: 'sinful-shell-press-plano',
    })
    const secondId = await createCatalogExercise({
      mode: 'create-from-sinful-shell',
      sinfulShellId: 'sinful-shell-press-plano',
    })

    expect(secondId).toBe(firstId)
    expect(await db.exerciseCatalog.count()).toBe(1)
  })

  it('reuses the same Sinful Shell copy under concurrent creation', async () => {
    const input = { mode: 'create-from-sinful-shell' as const, sinfulShellId: 'sinful-shell-press-plano' }
    const [first, second] = await Promise.all([createCatalogExercise(input), createCatalogExercise(input)])
    expect(first).toBe(second)
    expect(await db.exerciseCatalog.count()).toBe(1)
  })

  it('preserves protected fields when updating a locked Sinful Shell copy', async () => {
    const id = await createCatalogExercise({
      mode: 'create-from-sinful-shell',
      sinfulShellId: 'sinful-shell-jalon-al-pecho',
    })

    await updateCatalogExercise(id, {
      aliases: ['alias nuevo'],
      bundledAssetId: 'press-plano--pecho',
      equipment: 'Maquina',
      mainMuscle: 'Pecho',
      name: 'Nombre editado',
      technicalNotes: 'notas editadas',
      warmupProtocol: 'strength',
    })

    const item = await db.exerciseCatalog.get(id)
    expect(item).toMatchObject({
      aliases: ['alias nuevo'],
      bundledAssetId: 'jalon-al-pecho--espalda',
      canonicalName: 'jalon-al-pecho',
      equipment: 'Maquina',
      mainMuscle: 'Espalda',
      origin: 'sinful-shell',
      sinfulShellContentLocked: true,
      sinfulShellId: 'sinful-shell-jalon-al-pecho',
      warmupProtocol: 'strength',
    })
    expect(item?.technicalNotes).not.toBe('notas editadas')
  })

  it('keeps manual catalog items fully editable', async () => {
    const id = await createCatalogExercise({
      bundledAssetId: 'press-plano--pecho',
      mainMuscle: 'Pecho',
      name: 'Press manual',
      technicalNotes: 'Notas manuales',
    })

    await updateCatalogExercise(id, {
      bundledAssetId: 'remo-t--espalda',
      mainMuscle: 'Espalda',
      name: 'Remo manual',
      technicalNotes: 'Notas nuevas',
    })

    const item = await db.exerciseCatalog.get(id)
    expect(item).toMatchObject({
      bundledAssetId: 'remo-t--espalda',
      canonicalName: 'remo-manual',
      mainMuscle: 'Espalda',
      name: 'Remo manual',
      origin: 'user',
      sinfulShellContentLocked: false,
      sinfulShellId: null,
      technicalNotes: 'Notas nuevas',
    })
  })

  it('copies bundledAssetId from a Sinful Shell catalog copy into routine exercises', async () => {
    const catalogItemId = await createCatalogExercise({
      mode: 'create-from-sinful-shell',
      sinfulShellId: 'sinful-shell-pec-deck',
    })
    const routineId = await createRoutine('Rutina')
    const dayId = await createDay(routineId, 'Dia')

    const exerciseId = await addCatalogExerciseToDay(routineId, dayId, catalogItemId)

    expect(await db.routineExercises.get(exerciseId)).toMatchObject({
      bundledAssetId: 'pec-deck--pecho',
      sourceExerciseId: catalogItemId,
    })
  })
})

describe('routine exercise organization', () => {
  beforeEach(resetDb)
  afterEach(async () => { db.close(); await db.delete() })

  it('rejects an order containing an exercise from another day without moving it', async () => {
    const routineId = await createRoutine('Rutina')
    const firstDay = await createDay(routineId, 'Uno')
    const secondDay = await createDay(routineId, 'Dos')
    const first = await createExercise(routineId, firstDay, { name: 'Press', mainMuscle: 'Pecho' })
    const second = await createExercise(routineId, secondDay, { name: 'Remo', mainMuscle: 'Espalda' })
    await expect(reorderExercises(firstDay, [first, second])).rejects.toThrow()
    expect((await db.routineExercises.get(second))?.dayId).toBe(secondDay)
  })

  it('moves an exercise to another day in the same routine without changing its recipe', async () => {
    const routineId = await createRoutine('Rutina')
    const firstDay = await createDay(routineId, 'Uno')
    const secondDay = await createDay(routineId, 'Dos')
    const first = await createExercise(routineId, firstDay, { name: 'Press', mainMuscle: 'Pecho', targetSets: 4 })
    await createExercise(routineId, secondDay, { name: 'Remo', mainMuscle: 'Espalda' })
    await moveExerciseToDay(first, secondDay)
    expect(await db.routineExercises.get(first)).toMatchObject({ dayId: secondDay, order: 1, targetSets: 4, routineId })
  })

  it('keeps a unique order when an exercise in the middle is duplicated', async () => {
    const routineId = await createRoutine('Rutina')
    const dayId = await createDay(routineId, 'Día')
    const first = await createExercise(routineId, dayId, { name: 'Press', mainMuscle: 'Pecho' })
    const second = await createExercise(routineId, dayId, { name: 'Remo', mainMuscle: 'Espalda' })
    const copy = await duplicateExercise(first)
    const exercises = await db.routineExercises.where('dayId').equals(dayId).sortBy('order')
    expect(exercises.map((exercise) => [exercise.id, exercise.order])).toEqual([[first, 0], [copy, 1], [second, 2]])
  })

  it('appends a new exercise after an existing gap in order', async () => {
    const routineId = await createRoutine('Rutina')
    const dayId = await createDay(routineId, 'Día')
    const first = await createExercise(routineId, dayId, { name: 'Press', mainMuscle: 'Pecho' })
    const second = await createExercise(routineId, dayId, { name: 'Remo', mainMuscle: 'Espalda' })
    await db.routineExercises.delete(first)
    const third = await createExercise(routineId, dayId, { name: 'Sentadilla', mainMuscle: 'Piernas' })
    expect((await db.routineExercises.get(third))?.order).toBeGreaterThan((await db.routineExercises.get(second))!.order)
  })

  it('rejects day orders containing a day belonging to another routine', async () => {
    const routineId = await createRoutine('Una')
    const otherRoutine = await createRoutine('Otra')
    const first = await createDay(routineId, 'Uno')
    const other = await createDay(otherRoutine, 'Otro')
    await expect(reorderDays(routineId, [first, other])).rejects.toThrow()
    expect((await db.routineDays.get(other))?.routineId).toBe(otherRoutine)
  })

  it('preserves recoverable legacy session context before a routine rename and day deletion', async () => {
    const routineId = await createRoutine('Original')
    const dayId = await createDay(routineId, 'Día original')
    await createExercise(routineId, dayId, { name: 'Press', mainMuscle: 'Pecho' })
    const now = '2026-08-01T00:00:00.000Z'
    await db.workoutSessions.add({ id: 'legacy', routineId, dayId, date: '2026-08-01', notes: '', displayUnit: 'kg', status: 'completed', createdAt: now, updatedAt: now })
    await renameRoutine(routineId, 'Nueva')
    await deleteDay(dayId)
    expect(await db.workoutSessions.get('legacy')).toMatchObject({ routineName: 'Original', dayName: 'Día original' })
  })
})
