import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { addCatalogExerciseToDay, createCatalogExercise, createDay, createRoutine, updateCatalogExercise } from './services'

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
