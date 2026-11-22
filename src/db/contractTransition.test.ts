import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from './schema'
import { ensureDemoData } from './seedDemoRoutine'
import { prepareContractTransition } from './contractTransition'
import { restoreContractBackup } from './contractBackup'

describe('explicit legacy transition', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open(); await ensureDemoData() })
  afterEach(() => db.close())

  async function legacyBackup() {
    return { schemaVersion: 7, tables: {
      settings: await db.settings.toArray(), deloadCycles: await db.deloadCycles.toArray(), routines: await db.routines.toArray(),
      routineDays: await db.routineDays.toArray(), routineExercises: await db.routineExercises.toArray(), exerciseCatalog: await db.exerciseCatalog.toArray(),
      exerciseAssets: await db.exerciseAssets.toArray(), weeklyVolumeTargets: await db.weeklyVolumeTargets.toArray(), workoutSessions: await db.workoutSessions.toArray(),
      exerciseLogs: await db.exerciseLogs.toArray(), setLogs: await db.setLogs.toArray(), dropSetLogs: await db.dropSetLogs.toArray(), skipLogs: await db.skipLogs.toArray(),
    } }
  }

  it('prepares a verified conversion without changing the installed database', async () => {
    const legacy = await legacyBackup()
    legacy.tables.settings[0]!.schemaVersion = 5
    const exercise = legacy.tables.routineExercises[0]! as typeof legacy.tables.routineExercises[number] & { progression?: string }
    exercise.progression = 'obsolete'
    const content = JSON.stringify(legacy)
    const before = await db.routineExercises.toArray()
    const result = await prepareContractTransition(content)
    expect(result.changes).toContain('tables.settings[0].schemaVersion')
    expect(result.changes).toContain('tables.routineExercises[0].progression')
    expect(await db.routineExercises.toArray()).toEqual(before)
    await restoreContractBackup(result.backup)
    expect(await db.routineExercises.count()).toBe(before.length)
    expect((await db.routineExercises.get(exercise.id))?.warmupProtocol).toBe(exercise.warmupProtocol)
    expect((await db.settings.get('app'))?.schemaVersion).toBe(7)
  })

  it('rejects incompatible or partial legacy input without changing local data', async () => {
    const before = await db.routines.toArray()
    await expect(prepareContractTransition(JSON.stringify({ schemaVersion: 7, tables: { routines: [] } }))).rejects.toThrow()
    expect(await db.routines.toArray()).toEqual(before)
  })

  it('rejects invalid existing values rather than silently normalizing them', async () => {
    const legacy = await legacyBackup()
    legacy.tables.routineExercises[0]!.equipment = 'desconocido' as 'Barra'
    const before = await db.routines.toArray()
    await expect(prepareContractTransition(JSON.stringify(legacy))).rejects.toThrow()
    expect(await db.routines.toArray()).toEqual(before)
  })
})
