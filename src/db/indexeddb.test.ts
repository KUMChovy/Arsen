import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from './schema'
import type { ExerciseCatalogItem, Routine, RoutineDay, RoutineExercise } from '../domains/routine/types'
import type { AppSettings } from '../domains/settings/types'
import { addCatalogExerciseToDay, createCatalogExercise } from '../domains/routine/services'
import { buildProgressExport, importFullBackup } from '../domains/settings/services'
import {
  getProgressDayOptions,
  getProgressEditOptions,
  getProgressExerciseOptions,
  getSessionDetail,
  getSessionsForDate,
  getTrainingDates,
} from '../domains/progress/repository'
import {
  deleteWorkoutSession,
  moveMainSetToExercise,
  registerMainSetForExercise,
  skipRoutineExerciseForDay,
  updateWorkoutSession,
} from '../domains/workout/services'

const now = '2026-07-20T00:00:00.000Z'

describe('IndexedDB integration', () => {
  beforeEach(async () => {
    await resetDb()
  })

  afterEach(async () => {
    await resetDb()
  })

  it('replaces local backup tables when mode is replace', async () => {
    await db.settings.put(settings('local-routine', 'lb'))
    await db.routines.put(routine('local-routine', 'Local'))

    await importFullBackup(
      backupFile({
        settings: [settings('remote-routine', 'kg')],
        routines: [routine('remote-routine', 'Remote')],
      }),
      'replace',
    )

    await expect(db.routines.toArray()).resolves.toEqual([routine('remote-routine', 'Remote')])
    await expect(db.settings.get('app')).resolves.toMatchObject({
      activeRoutineId: 'remote-routine',
      preferredUnit: 'kg',
    })
  })

  it('merges backup tables without replacing existing app settings', async () => {
    await db.settings.put(settings('local-routine', 'lb'))
    await db.routines.put(routine('local-routine', 'Local'))

    await importFullBackup(
      backupFile({
        settings: [settings('remote-routine', 'kg')],
        routines: [routine('remote-routine', 'Remote')],
      }),
      'merge',
    )

    await expect(db.routines.orderBy('id').toArray()).resolves.toEqual([
      routine('local-routine', 'Local'),
      routine('remote-routine', 'Remote'),
    ])
    await expect(db.settings.get('app')).resolves.toMatchObject({
      activeRoutineId: 'local-routine',
      preferredUnit: 'lb',
    })
  })

  it('registers main sets, drop sets and completes exercise state', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)

    const first = await registerMainSetForExercise({
      date: '2026-07-20',
      dayId: exercise.dayId,
      displayUnit: 'kg',
      dropSet: { reps: 10, rir: 2, weightKg: 48 },
      exercise,
      reps: 8,
      rir: 1,
      routineId: exercise.routineId,
      weightKg: 60,
    })
    const second = await registerMainSetForExercise({
      date: '2026-07-20',
      dayId: exercise.dayId,
      displayUnit: 'kg',
      exercise,
      reps: 7,
      rir: 1,
      routineId: exercise.routineId,
      weightKg: 62.5,
    })

    expect(second.sessionId).toBe(first.sessionId)
    await expect(db.workoutSessions.count()).resolves.toBe(1)
    await expect(db.setLogs.where('exerciseLogId').equals(first.exerciseLogId).count()).resolves.toBe(2)
    await expect(db.dropSetLogs.where('setLogId').equals(first.setLogId).count()).resolves.toBe(1)
    await expect(db.exerciseLogs.get(first.exerciseLogId)).resolves.toMatchObject({ state: 'done' })
    await expect(db.routineExercises.get(exercise.id)).resolves.toMatchObject({ currentWeightKg: 62.5 })
  })

  it('deletes workout session with logs, sets, drop sets and skips', async () => {
    const exercise = routineExercise()
    await db.routineExercises.put(exercise)
    const registered = await registerMainSetForExercise({
      date: '2026-07-20',
      dayId: exercise.dayId,
      displayUnit: 'kg',
      dropSet: { reps: 12, rir: 2, weightKg: 40 },
      exercise,
      reps: 8,
      rir: 1,
      routineId: exercise.routineId,
      weightKg: 50,
    })
    await skipRoutineExerciseForDay({
      date: '2026-07-20',
      dayId: exercise.dayId,
      displayUnit: 'kg',
      exercise,
      routineId: exercise.routineId,
    })

    await deleteWorkoutSession(registered.sessionId)

    await expect(db.workoutSessions.count()).resolves.toBe(0)
    await expect(db.exerciseLogs.count()).resolves.toBe(0)
    await expect(db.setLogs.count()).resolves.toBe(0)
    await expect(db.dropSetLogs.count()).resolves.toBe(0)
    await expect(db.skipLogs.count()).resolves.toBe(0)
  })

  it('keeps catalog exercise separate from day recipe', async () => {
    const routineA = routine('routine-a', 'Rutina A')
    const dayA = routineDay('day-a', routineA.id, 'Dia A')
    const dayB = routineDay('day-b', routineA.id, 'Dia B')
    await db.routines.put(routineA)
    await db.routineDays.bulkPut([dayA, dayB])

    const catalogItemId = await createCatalogExercise({
      equipment: 'Barra',
      mainMuscle: 'Pectoral mayor',
      name: 'Press inclinado',
      technicalNotes: 'Baja controlado y pausa al pecho.',
      warmupProtocol: 'Hipertrofia',
    })
    await addCatalogExerciseToDay(routineA.id, dayA.id, catalogItemId, {
      recommendedRir: 2,
      repsMax: 10,
      repsMin: 8,
      targetSets: 3,
    })
    await addCatalogExerciseToDay(routineA.id, dayB.id, catalogItemId, {
      recommendedRir: 3,
      repsMax: 12,
      repsMin: 10,
      targetSets: 2,
      technicalNotes: 'Version ligera del dia B.',
      warmupProtocol: 'strength',
    })

    const catalogItem = await db.exerciseCatalog.get(catalogItemId)
    const recipes = await db.routineExercises.where('sourceExerciseId').equals(catalogItemId).sortBy('dayId')

    expect(catalogItem).toMatchObject({
      barWeightKg: 20,
      defaultRecommendedRir: 2,
      defaultRepsMax: 10,
      defaultRepsMin: 8,
      defaultTargetSets: 3,
      loadMode: 'split',
      mainMuscle: 'Pecho',
      name: 'Press inclinado',
      technicalNotes: 'Baja controlado y pausa al pecho.',
      warmupProtocol: 'hypertrophy',
    })
    expect(recipes).toHaveLength(2)
    expect(recipes[0]).toMatchObject({ barWeightKg: 20, dayId: dayA.id, loadMode: 'split', recommendedRir: 2, repsMax: 10, repsMin: 8, targetSets: 3, technicalNotes: 'Baja controlado y pausa al pecho.', warmupProtocol: 'hypertrophy' })
    expect(recipes[1]).toMatchObject({ barWeightKg: 20, dayId: dayB.id, loadMode: 'split', recommendedRir: 3, repsMax: 12, repsMin: 10, targetSets: 2, technicalNotes: 'Version ligera del dia B.', warmupProtocol: 'strength' })
  })

  it('defaults load settings for service-created barbell exercises', async () => {
    const catalogItemId = await createCatalogExercise({
      equipment: 'Barra',
      mainMuscle: 'Pecho',
      name: 'Press banca',
    })

    const catalogItem = await db.exerciseCatalog.get(catalogItemId)

    expect(catalogItem).toMatchObject({
      barWeightKg: 20,
      equipment: 'Barra',
      loadMode: 'split',
    })
  })

  it('preserves indication notes when importing a backup', async () => {
    const legacyExercise = { ...routineExercise({ technicalNotes: 'Rodillas siguen la punta del pie.' }), progression: 'legacy' }

    await importFullBackup(
      backupFile({
        exerciseCatalog: [catalogExercise({ technicalNotes: 'Empuja el piso con todo el pie.' })],
        routineExercises: [legacyExercise],
      }),
      'replace',
    )

    await expect(db.exerciseCatalog.get('catalog-1')).resolves.toMatchObject({ technicalNotes: 'Empuja el piso con todo el pie.' })
    await expect(db.routineExercises.get('exercise-1')).resolves.toMatchObject({ technicalNotes: 'Rodillas siguen la punta del pie.' })
    expect(await db.routineExercises.get('exercise-1')).not.toHaveProperty('progression')
  })

  it('strips legacy catalog progression strategy when importing a backup', async () => {
    const legacyCatalogExercise = {
      ...catalogExercise({ technicalNotes: 'Completa el rango alto antes de subir peso.' }),
      progressionStrategy: 'legacy_catalog_strategy',
    } as ExerciseCatalogItem

    await importFullBackup(
      backupFile({
        exerciseCatalog: [legacyCatalogExercise],
      }),
      'replace',
    )

    const savedCatalogExercise = await db.exerciseCatalog.get('catalog-1')

    await expect(db.exerciseCatalog.get('catalog-1')).resolves.toMatchObject({
      technicalNotes: 'Completa el rango alto antes de subir peso.',
    })
    expect(savedCatalogExercise).not.toHaveProperty('progressionStrategy')
  })

  it('exports chronological progress with routines, graph points and drop set volume', async () => {
    const routineA = routine('routine-a', 'Rutina A')
    const routineB = routine('routine-b', 'Rutina B')
    const dayA = routineDay('day-a', routineA.id, 'Dia A')
    const dayB = routineDay('day-b', routineB.id, 'Dia B')
    const exerciseA = routineExercise({ dayId: dayA.id, id: 'exercise-a', routineId: routineA.id })
    const exerciseB = routineExercise({ dayId: dayB.id, id: 'exercise-b', routineId: routineB.id })
    await db.routines.bulkPut([routineA, routineB])
    await db.routineDays.bulkPut([dayA, dayB])
    await db.routineExercises.bulkPut([exerciseA, exerciseB])

    await registerMainSetForExercise({
      date: '2026-07-27',
      dayId: dayB.id,
      displayUnit: 'kg',
      exercise: exerciseB,
      reps: 5,
      rir: 1,
      routineId: routineB.id,
      weightKg: 80,
    })
    await registerMainSetForExercise({
      date: '2026-07-20',
      dayId: dayA.id,
      displayUnit: 'kg',
      dropSet: { reps: 10, rir: 2, weightKg: 40 },
      exercise: exerciseA,
      reps: 8,
      rir: 1,
      routineId: routineA.id,
      weightKg: 60,
    })

    const exported = await buildProgressExport()

    expect(exported.timeline.map((row) => row.date)).toEqual(['2026-07-20', '2026-07-27'])
    expect(exported.timeline[0]).toMatchObject({
      canonicalName: 'press-inclinado',
      dayId: 'day-a',
      dayName: 'Dia A',
      exerciseLogId: expect.any(String),
      exerciseName: 'Press inclinado',
      routineExerciseId: 'exercise-a',
      routineId: 'routine-a',
      routineName: 'Rutina A',
      setLogId: expect.any(String),
      volume: 880,
    })
    expect(exported.graphPoints).toEqual([
      expect.objectContaining({
        canonicalName: 'press-inclinado',
        date: '2026-07-20',
        routineName: 'Rutina A',
        volume: 880,
      }),
      expect.objectContaining({
        canonicalName: 'press-inclinado',
        date: '2026-07-27',
        routineName: 'Rutina B',
        volume: 400,
      }),
    ])
    expect(exported.summary).toMatchObject({
      exercises: 1,
      routines: 2,
      sessions: 2,
      sets: 2,
      volume: 1280,
    })
  })

  it('filters progress export by day and canonical exercise', async () => {
    const routineA = routine('routine-a', 'Rutina A')
    const routineB = routine('routine-b', 'Rutina B')
    const routineC = routine('routine-c', 'Rutina C')
    const dayA = routineDay('day-a', routineA.id, 'Dia A')
    const dayB = routineDay('day-b', routineB.id, 'Dia B')
    const dayC = routineDay('day-c', routineC.id, 'Dia C')
    const exerciseA = routineExercise({
      canonicalName: 'remo-barra',
      dayId: dayA.id,
      id: 'exercise-a',
      name: 'Remo barra',
      routineId: routineA.id,
    })
    const exerciseB = routineExercise({
      canonicalName: 'press-banca',
      dayId: dayB.id,
      id: 'exercise-b',
      name: 'Press banca',
      routineId: routineB.id,
    })
    const exerciseC = routineExercise({
      canonicalName: 'press-banca',
      dayId: dayC.id,
      id: 'exercise-c',
      name: 'Press banca pausado',
      routineId: routineC.id,
    })
    await db.routines.bulkPut([routineA, routineB, routineC])
    await db.routineDays.bulkPut([dayA, dayB, dayC])
    await db.routineExercises.bulkPut([exerciseA, exerciseB, exerciseC])

    await registerMainSetForExercise({
      date: '2026-08-01',
      dayId: dayA.id,
      displayUnit: 'kg',
      exercise: exerciseA,
      reps: 8,
      rir: 2,
      routineId: routineA.id,
      weightKg: 70,
    })
    await registerMainSetForExercise({
      date: '2026-08-02',
      dayId: dayB.id,
      displayUnit: 'kg',
      exercise: exerciseB,
      reps: 6,
      rir: 1,
      routineId: routineB.id,
      weightKg: 90,
    })
    await registerMainSetForExercise({
      date: '2026-08-03',
      dayId: dayC.id,
      displayUnit: 'kg',
      exercise: exerciseC,
      reps: 5,
      rir: 1,
      routineId: routineC.id,
      weightKg: 95,
    })

    const dayExport = await buildProgressExport({ dayId: dayA.id })
    const exerciseExport = await buildProgressExport({ canonicalName: 'press-banca' })

    expect(dayExport.timeline.map((row) => row.dayId)).toEqual([dayA.id])
    expect(dayExport.summary).toMatchObject({ exercises: 1, routines: 1, sessions: 1, sets: 1 })
    expect(exerciseExport.timeline.map((row) => row.routineId)).toEqual([routineB.id, routineC.id])
    expect(exerciseExport.summary).toMatchObject({ exercises: 1, routines: 2, sessions: 2, sets: 2 })
  })

  it('loads progress edit options without requiring order indexes', async () => {
    const routineA = routine('routine-a', 'Rutina A')
    const dayA = routineDay('day-a', routineA.id, 'Dia A')
    const exerciseA = routineExercise({ dayId: dayA.id, id: 'exercise-a', routineId: routineA.id })
    await db.routines.put(routineA)
    await db.routineDays.put(dayA)
    await db.routineExercises.put(exerciseA)

    const options = await getProgressEditOptions()

    expect(options.routines).toEqual([{ id: 'routine-a', name: 'Rutina A' }])
    expect(options.days).toEqual([{ id: 'day-a', name: 'Dia A', routineId: 'routine-a', routineName: 'Rutina A' }])
    expect(options.exercises).toEqual([{ dayId: 'day-a', id: 'exercise-a', name: 'Press inclinado', routineId: 'routine-a' }])
  })

  it('filters progress history dates, sessions and details by day and exercise', async () => {
    const routineA = routine('routine-a', 'Rutina A')
    const routineB = routine('routine-b', 'Rutina B')
    const routineC = routine('routine-c', 'Rutina C')
    const dayA = routineDay('day-a', routineA.id, 'Dia A')
    const dayB = routineDay('day-b', routineB.id, 'Dia B')
    const dayC = routineDay('day-c', routineC.id, 'Dia C')
    const exerciseA = routineExercise({
      canonicalName: 'remo-barra',
      dayId: dayA.id,
      id: 'exercise-a',
      name: 'Remo barra',
      routineId: routineA.id,
    })
    const exerciseB = routineExercise({
      canonicalName: 'press-banca',
      dayId: dayB.id,
      id: 'exercise-b',
      name: 'Press banca',
      routineId: routineB.id,
    })
    const exerciseC = routineExercise({
      canonicalName: 'press-banca',
      dayId: dayC.id,
      id: 'exercise-c',
      name: 'Press banca pausado',
      routineId: routineC.id,
    })
    await db.routines.bulkPut([routineA, routineB, routineC])
    await db.routineDays.bulkPut([dayA, dayB, dayC])
    await db.routineExercises.bulkPut([exerciseA, exerciseB, exerciseC])

    const sessionA = await registerMainSetForExercise({
      date: '2026-08-02',
      dayId: dayA.id,
      displayUnit: 'kg',
      exercise: exerciseA,
      reps: 8,
      rir: 2,
      routineId: routineA.id,
      weightKg: 70,
    })
    const sessionB = await registerMainSetForExercise({
      date: '2026-08-02',
      dayId: dayB.id,
      displayUnit: 'kg',
      exercise: exerciseB,
      reps: 6,
      rir: 1,
      routineId: routineB.id,
      weightKg: 90,
    })
    const sessionC = await registerMainSetForExercise({
      date: '2026-08-03',
      dayId: dayC.id,
      displayUnit: 'kg',
      exercise: exerciseC,
      reps: 5,
      rir: 1,
      routineId: routineC.id,
      weightKg: 95,
    })

    expect((await getSessionsForDate('2026-08-02', { dayId: dayA.id })).map((session) => session.id)).toEqual([
      sessionA.sessionId,
    ])
    expect((await getSessionsForDate('2026-08-02', { canonicalName: 'press-banca' })).map((session) => session.id)).toEqual([
      sessionB.sessionId,
    ])
    expect((await getSessionsForDate('2026-08-03', { canonicalName: 'press-banca' })).map((session) => session.id)).toEqual([
      sessionC.sessionId,
    ])
    expect(await getTrainingDates({ canonicalName: 'press-banca' })).toEqual(['2026-08-03', '2026-08-02'])
    expect(await getProgressExerciseOptions({ dayId: dayA.id })).toEqual([
      {
        canonicalName: 'remo-barra',
        name: 'Remo barra',
        sessions: 1,
      },
    ])

    await db.routineDays.delete(dayB.id)

    expect(await getProgressDayOptions()).toContainEqual({
      dayId: dayB.id,
      name: 'Dia eliminado',
      routineName: 'Rutina B',
      sessions: 1,
    })

    const detail = await getSessionDetail(sessionB.sessionId, { canonicalName: 'press-banca' })

    expect(detail?.exercises.map((exercise) => exercise.exerciseName)).toEqual(['Press banca'])
  })

  it('loads session detail and moves a set to another exercise recipe', async () => {
    const routineA = routine('routine-a', 'Rutina A')
    const dayA = routineDay('day-a', routineA.id, 'Dia A')
    const dayB = routineDay('day-b', routineA.id, 'Dia B')
    const exerciseA = routineExercise({ dayId: dayA.id, id: 'exercise-a', routineId: routineA.id })
    const exerciseB = routineExercise({ dayId: dayB.id, id: 'exercise-b', routineId: routineA.id })
    await db.routines.put(routineA)
    await db.routineDays.bulkPut([dayA, dayB])
    await db.routineExercises.bulkPut([exerciseA, exerciseB])

    const registered = await registerMainSetForExercise({
      date: '2026-07-20',
      dayId: dayA.id,
      displayUnit: 'kg',
      exercise: exerciseA,
      reps: 10,
      rir: 2,
      routineId: routineA.id,
      weightKg: 60,
    })

    await updateWorkoutSession(registered.sessionId, {
      date: '2026-07-21',
      dayId: dayB.id,
      routineId: routineA.id,
    })
    await moveMainSetToExercise(registered.setLogId, exerciseB.id)

    const detail = await getSessionDetail(registered.sessionId)
    const movedSet = await db.setLogs.get(registered.setLogId)
    const movedLog = movedSet ? await db.exerciseLogs.get(movedSet.exerciseLogId) : null

    expect(detail).toMatchObject({
      date: '2026-07-21',
      dayId: 'day-b',
      dayName: 'Dia B',
      routineId: 'routine-a',
    })
    expect(movedLog).toMatchObject({
      routineExerciseId: 'exercise-b',
      snapshot: expect.objectContaining({ name: 'Press inclinado' }),
    })
    expect(detail?.exercises.some((exercise) => exercise.routineExerciseId === 'exercise-b')).toBe(true)
  })
})

async function resetDb() {
  db.close()
  await db.delete()
  await db.open()
}

function backupFile(tables: {
  exerciseCatalog?: ExerciseCatalogItem[]
  routineExercises?: RoutineExercise[]
  routines?: Routine[]
  settings?: AppSettings[]
}) {
  return new File(
    [
      JSON.stringify({
        exportedAt: now,
        schemaVersion: 1,
        tables,
      }),
    ],
    'backup.json',
    { type: 'application/json' },
  )
}

function routine(id: string, name: string): Routine {
  return {
    createdAt: now,
    id,
    isActive: id.includes('local'),
    name,
    updatedAt: now,
  }
}

function settings(activeRoutineId: string, preferredUnit: 'kg' | 'lb'): AppSettings {
  return {
    activeRoutineId,
    createdAt: now,
    deloadNotifications: true,
    id: 'app',
    preferredUnit,
    schemaVersion: 1,
    storagePersisted: null,
    updatedAt: now,
  }
}

function routineDay(id: string, routineId: string, name: string): RoutineDay {
  return {
    createdAt: now,
    description: '',
    id,
    name,
    order: 0,
    routineId,
    updatedAt: now,
    weekday: null,
  }
}

function routineExercise(
  overrides: Partial<
    Pick<RoutineExercise, 'canonicalName' | 'dayId' | 'id' | 'name' | 'routineId' | 'sourceExerciseId' | 'technicalNotes'>
  > = {},
): RoutineExercise {
  return {
    canonicalName: overrides.canonicalName ?? 'press-inclinado',
    createdAt: now,
    currentWeightKg: 50,
    dayId: overrides.dayId ?? 'day-1',
    equipment: 'Barra',
    loadMode: 'split',
    barWeightKg: 20,
    id: overrides.id ?? 'exercise-1',
    mainMuscle: 'Pecho',
    name: overrides.name ?? 'Press inclinado',
    order: 0,
    recommendedRir: 2,
    repsMax: 10,
    repsMin: 8,
    rest: '90 seg',
    restSeconds: 90,
    routineId: overrides.routineId ?? 'routine-1',
    sourceExerciseId: overrides.sourceExerciseId ?? null,
    targetSets: 2,
    technicalNotes: overrides.technicalNotes ?? '',
    updatedAt: now,
    warmupProtocol: '',
    warmupSets: 0,
  }
}

function catalogExercise(overrides: Partial<Pick<ExerciseCatalogItem, 'technicalNotes' | 'warmupProtocol'>> = {}): ExerciseCatalogItem {
  return {
    aliases: [],
    assetKind: null,
    canonicalName: 'sentadilla',
    createdAt: now,
    defaultRecommendedRir: 2,
    defaultRepsMax: 10,
    defaultRepsMin: 8,
    defaultRestSeconds: 120,
    defaultTargetSets: 4,
    equipment: 'Barra',
    loadMode: 'split',
    barWeightKg: 20,
    id: 'catalog-1',
    mainMuscle: 'Piernas',
    name: 'Sentadilla',
    technicalNotes: overrides.technicalNotes ?? '',
    updatedAt: now,
    warmupProtocol: overrides.warmupProtocol ?? 'none',
  }
}
