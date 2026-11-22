import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { addCatalogExerciseToDay, createCatalogExercise, createDay, createExercise, createRoutine, deleteDay, duplicateExercise, moveExerciseToDay, renameRoutine, reorderDays, reorderExercises, updateCatalogExercise } from './services'

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
