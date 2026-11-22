import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { getRoutineSummaries } from './repository'
import { createDay, createExercise, createRoutine } from './services'

beforeEach(async () => { db.close(); await db.delete(); await db.open() })
afterEach(async () => { db.close(); await db.delete() })

it('summarizes each routine using only its own days and exercises', async () => {
  const first = await createRoutine('Fuerza')
  const second = await createRoutine('Movilidad')
  const day = await createDay(first, 'Torso')
  await createExercise(first, day, { name: 'Press', mainMuscle: 'Pecho' })
  const summaries = await getRoutineSummaries()
  expect(summaries).toEqual(expect.arrayContaining([
    expect.objectContaining({ routine: expect.objectContaining({ id: first }), days: [expect.objectContaining({ id: day, name: 'Torso' })], exerciseCount: 1 }),
    expect.objectContaining({ routine: expect.objectContaining({ id: second }), days: [], exerciseCount: 0 }),
  ]))
})
