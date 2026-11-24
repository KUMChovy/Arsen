import type { RoutineExercise } from '../routine/types'
import type { DropSetLog, ExerciseLog, SetLog, WeightUnit, WorkoutSession } from './types'
import { db } from '../../db/schema'
import { createId } from '../../shared/utils/id'
import { exerciseStateFromSets } from '../../shared/calculations/workout'
import { localDateKey } from '../../shared/utils/date'
import { nextOrder } from '../../shared/utils/order'
import { recordedSetValuesSchema, sessionStatusSchema, trainingDateSchema, weightUnitSchema } from '../../shared/validation/dataContract'
import { exerciseLogEntitySchema, routineExerciseEntitySchema } from '../../shared/validation/entities'

function assertExerciseMatchesDay(input: { exercise: RoutineExercise; dayId: string; routineId: string }) {
  if (input.exercise.dayId !== input.dayId || input.exercise.routineId !== input.routineId) throw new Error('El ejercicio no corresponde al día de entrenamiento')
}

const setMeasurementsSchema = recordedSetValuesSchema.pick({ weightKg: true, reps: true, rir: true })

export async function getOrCreateSessionForDay(input: {
  date: string
  dayId: string
  displayUnit: WeightUnit
  routineId: string
}) {
  if (!trainingDateSchema.safeParse(input.date).success) throw new Error('La fecha de entrenamiento no es válida')
  if (!weightUnitSchema.safeParse(input.displayUnit).success) throw new Error('La unidad de peso no es válida')
  return db.transaction('rw', [db.workoutSessions, db.routines, db.routineDays, db.routineExercises], async () => {
    const existing = await db.workoutSessions
      .where('[date+dayId]')
      .equals([input.date, input.dayId])
      .first()

    if (existing) {
      if (existing.routineId !== input.routineId) throw new Error('La sesión pertenece a otra rutina')
      return existing.id
    }

    const now = new Date().toISOString()
    const [routine, day, exercises] = await Promise.all([
      db.routines.get(input.routineId),
      db.routineDays.get(input.dayId),
      db.routineExercises.where('dayId').equals(input.dayId).sortBy('order'),
    ])
    if (!routine || !day || day.routineId !== input.routineId) throw new Error('El día no pertenece a una rutina válida')
    const session: WorkoutSession = {
      id: createId('session'),
      routineId: input.routineId,
      dayId: input.dayId,
      routineName: routine.name,
      dayName: day.name,
      sessionExercises: exercises,
      date: input.date,
      notes: '',
      displayUnit: input.displayUnit,
      status: 'draft',
      startedAt: null,
      lastExerciseAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    }

    await db.workoutSessions.add(session)

    return session.id
  })
}

export async function ensureExerciseLog(sessionId: string, exercise: RoutineExercise) {
  return db.transaction('rw', [db.workoutSessions, db.exerciseLogs, db.exerciseAssets], async () => {
    if (!(await db.workoutSessions.get(sessionId))) throw new Error('Sesión de entrenamiento no encontrada')
    const existing = await db.exerciseLogs
      .where('sessionId')
      .equals(sessionId)
      .filter((log) => log.routineExerciseId === exercise.id)
      .first()

    if (existing) return existing.id
    if (exercise.customAssetId && !(await db.exerciseAssets.get(exercise.customAssetId))) throw new Error('Imagen personalizada no encontrada')

    const now = new Date().toISOString()
    const log: ExerciseLog = {
      id: createId('exercise-log'),
      sessionId,
      routineExerciseId: exercise.id,
      state: 'pending',
      notes: '',
      snapshot: {
        assetKind: exercise.assetKind,
        bundledAssetId: exercise.bundledAssetId,
        customAssetId: exercise.customAssetId,
        name: exercise.name,
        canonicalName: exercise.canonicalName,
        mainMuscle: exercise.mainMuscle,
        equipment: exercise.equipment,
        loadMode: exercise.loadMode,
        barWeightKg: exercise.barWeightKg,
        targetSets: exercise.targetSets,
        repsMin: exercise.repsMin,
        repsMax: exercise.repsMax,
        recommendedRir: exercise.recommendedRir,
        restSeconds: exercise.restSeconds,
      },
      createdAt: now,
      updatedAt: now,
    }

    if (!exerciseLogEntitySchema.safeParse(log).success) throw new Error('Los datos del ejercicio no son válidos')
    await db.exerciseLogs.add(log)

    return log.id
  })
}

export async function saveMainSet(input: {
  displayUnit: WeightUnit
  exerciseLogId: string
  reps: number
  rir: number
  weightKg: number
}) {
  if (!recordedSetValuesSchema.omit({ order: true }).safeParse(input).success) throw new Error('Los datos de la serie no son válidos')
  return db.transaction('rw', [db.setLogs, db.exerciseLogs], async () => {
    if (!(await db.exerciseLogs.get(input.exerciseLogId))) throw new Error('Registro de ejercicio no encontrado')
    const now = new Date().toISOString()
    const existingSets = await db.setLogs
      .where('exerciseLogId')
      .equals(input.exerciseLogId)
      .and((set) => set.kind === 'main')
      .toArray()
    const order = nextOrder(existingSets)

    const set: SetLog = {
      id: createId('set'),
      exerciseLogId: input.exerciseLogId,
      kind: 'main',
      order,
      weightKg: input.weightKg,
      displayUnit: input.displayUnit,
      reps: input.reps,
      rir: input.rir,
      createdAt: now,
      updatedAt: now,
    }

    await db.setLogs.add(set)
    await refreshExerciseState(input.exerciseLogId)

    return set
  })
}

export async function registerWarmupForExercise(input: {
  date: string
  dayId: string
  displayUnit: WeightUnit
  exercise: RoutineExercise
  reps: number
  rir: number
  routineId: string
  weightKg: number
}) {
  assertExerciseMatchesDay(input)
  if (!setMeasurementsSchema.safeParse(input).success) {
    throw new Error('Los datos del calentamiento no son válidos')
  }
  return db.transaction('rw', [db.workoutSessions, db.exerciseLogs, db.setLogs, db.routines, db.routineDays, db.routineExercises, db.exerciseAssets], async () => {
    const sessionId = await getOrCreateSessionForDay(input)
    const exerciseLogId = await ensureExerciseLog(sessionId, input.exercise)
    const warmups = await db.setLogs.where('exerciseLogId').equals(exerciseLogId).and((set) => set.kind === 'warmup').toArray()
    const order = nextOrder(warmups)
    const now = new Date().toISOString()
    const setLogId = createId('set')
    await db.setLogs.add({ id: setLogId, exerciseLogId, kind: 'warmup', order, weightKg: input.weightKg, displayUnit: input.displayUnit, reps: input.reps, rir: input.rir, createdAt: now, updatedAt: now })
    return { exerciseLogId, sessionId, setLogId }
  })
}

export async function registerMainSetForExercise(input: {
  date: string
  dayId: string
  displayUnit: WeightUnit
  dropSet?: {
    reps: number
    rir: number
    weightKg: number
  } | null
  exercise: RoutineExercise
  reps: number
  rir: number
  routineId: string
  weightKg: number
}) {
  assertExerciseMatchesDay(input)
  if (!setMeasurementsSchema.safeParse(input).success) {
    throw new Error('Los datos de la serie no son válidos')
  }
  return db.transaction('rw', [db.workoutSessions, db.exerciseLogs, db.setLogs, db.dropSetLogs, db.routineExercises, db.routineDays, db.routines, db.skipLogs, db.exerciseAssets], async () => {
    const sessionId = await getOrCreateSessionForDay({
      date: input.date,
      dayId: input.dayId,
      displayUnit: input.displayUnit,
      routineId: input.routineId,
    })
    const exerciseLogId = await ensureExerciseLog(sessionId, input.exercise)
    await db.skipLogs.where('sessionId').equals(sessionId).filter((skip) => skip.routineExerciseId === input.exercise.id).delete()
    const set = await saveMainSet({
      displayUnit: input.displayUnit,
      exerciseLogId,
      reps: input.reps,
      rir: input.rir,
      weightKg: input.weightKg,
    })

    if (input.dropSet) {
      await addDropSet({
        displayUnit: input.displayUnit,
        reps: input.dropSet.reps,
        rir: input.dropSet.rir,
        setLogId: set.id,
        weightKg: input.dropSet.weightKg,
      })
    }

    const currentSession = await db.workoutSessions.get(sessionId)
    const now = new Date().toISOString()
    await db.workoutSessions.update(sessionId, {
        lastExerciseAt: set.createdAt,
        startedAt: currentSession?.startedAt ?? set.createdAt,
        updatedAt: now,
    })
    await syncSessionStatusFromExercises(sessionId)

    return { exerciseLogId, sessionId, setLogId: set.id }
  })
}

export async function addDropSet(input: {
  displayUnit: WeightUnit
  reps: number
  rir: number
  setLogId: string
  weightKg: number
}) {
  if (!recordedSetValuesSchema.omit({ order: true }).safeParse(input).success) {
    throw new Error('Los datos del drop set no son vÃ¡lidos')
  }
  return db.transaction('rw', [db.setLogs, db.dropSetLogs], async () => {
    const parentSet = await db.setLogs.get(input.setLogId)
    if (!parentSet || parentSet.kind !== 'main') throw new Error('Serie principal no encontrada')
    const now = new Date().toISOString()
    const drops = await db.dropSetLogs.where('setLogId').equals(input.setLogId).toArray()
    const order = nextOrder(drops)
    const dropSet: DropSetLog = {
      id: createId('drop-set'),
      setLogId: input.setLogId,
      order,
      weightKg: input.weightKg,
      displayUnit: input.displayUnit,
      reps: input.reps,
      rir: input.rir,
      createdAt: now,
      updatedAt: now,
    }

    await db.dropSetLogs.add(dropSet)

    return dropSet.id
  })
}

export async function updateDropSet(
  dropSetId: string,
  input: {
    reps: number
    rir: number
    weightKg: number
  },
) {
  if (!setMeasurementsSchema.safeParse(input).success) {
    throw new Error('Los datos del drop set no son válidos')
  }
  const dropSet = await db.dropSetLogs.get(dropSetId)
  if (!dropSet) throw new Error('Drop set no encontrado')

  await db.dropSetLogs.update(dropSetId, {
    reps: input.reps,
    rir: input.rir,
    updatedAt: new Date().toISOString(),
    weightKg: input.weightKg,
  })
}

export async function deleteDropSet(dropSetId: string) {
  const dropSet = await db.dropSetLogs.get(dropSetId)
  if (!dropSet) throw new Error('Drop set no encontrado')

  await db.dropSetLogs.delete(dropSetId)
}

export async function skipExercise(sessionId: string, routineExerciseId: string, reason = '') {
  if (typeof reason !== 'string') throw new Error('El motivo no es válido')
  const now = new Date().toISOString()
  await db.transaction('rw', [db.skipLogs, db.exerciseLogs, db.workoutSessions], async () => {
    if (!(await db.workoutSessions.get(sessionId))) throw new Error('Sesión de entrenamiento no encontrada')
    const log = await db.exerciseLogs
      .where('sessionId')
      .equals(sessionId)
      .filter((candidate) => candidate.routineExerciseId === routineExerciseId)
      .first()
    if (!log) throw new Error('Ejercicio de la sesión no encontrado')
    const existingSkip = await db.skipLogs.where('sessionId').equals(sessionId).filter((skip) => skip.routineExerciseId === routineExerciseId).first()
    if (!existingSkip) await db.skipLogs.add({
      id: createId('skip'),
      sessionId,
      routineExerciseId,
      reason,
      createdAt: now,
    })

    await db.exerciseLogs.update(log.id, { state: 'skipped', updatedAt: now })
  })
}

export async function skipRoutineExerciseForDay(input: {
  date: string
  dayId: string
  displayUnit: WeightUnit
  exercise: RoutineExercise
  reason?: string
  routineId: string
}) {
  assertExerciseMatchesDay(input)
  return db.transaction('rw', [db.workoutSessions, db.exerciseLogs, db.skipLogs, db.routines, db.routineDays, db.routineExercises, db.exerciseAssets], async () => {
    const sessionId = await getOrCreateSessionForDay({
      date: input.date,
      dayId: input.dayId,
      displayUnit: input.displayUnit,
      routineId: input.routineId,
    })
    await ensureExerciseLog(sessionId, input.exercise)
    await skipExercise(sessionId, input.exercise.id, input.reason)

    return sessionId
  })
}

export async function updateSessionNotesForDay(input: {
  date: string
  dayId: string
  displayUnit: WeightUnit
  notes: string
  routineId: string
}) {
  if (typeof input.notes !== 'string') throw new Error('Las notas no son válidas')
  return db.transaction('rw', [db.workoutSessions, db.routines, db.routineDays, db.routineExercises], async () => {
    const sessionId = await getOrCreateSessionForDay(input)
    await db.workoutSessions.update(sessionId, { notes: input.notes, updatedAt: new Date().toISOString() })
    return sessionId
  })
}

export async function updateExerciseNotesForDay(input: {
  date: string
  dayId: string
  displayUnit: WeightUnit
  exercise: RoutineExercise
  notes: string
  routineId: string
}) {
  if (typeof input.notes !== 'string') throw new Error('Las notas no son válidas')
  assertExerciseMatchesDay(input)
  return db.transaction('rw', [db.workoutSessions, db.exerciseLogs, db.routines, db.routineDays, db.routineExercises, db.exerciseAssets], async () => {
    const sessionId = await getOrCreateSessionForDay(input)
    const exerciseLogId = await ensureExerciseLog(sessionId, input.exercise)
    await db.exerciseLogs.update(exerciseLogId, { notes: input.notes, updatedAt: new Date().toISOString() })
    return exerciseLogId
  })
}

export async function updateSessionExercisePlan(input: {
  date: string
  dayId: string
  displayUnit: WeightUnit
  exercises: RoutineExercise[]
  routineId: string
}) {
  if (new Set(input.exercises.map((exercise) => exercise.id)).size !== input.exercises.length || input.exercises.some((exercise) => exercise.dayId !== input.dayId || exercise.routineId !== input.routineId || !routineExerciseEntitySchema.safeParse(exercise).success)) {
    throw new Error('Los ejercicios de la sesión no son válidos')
  }
  return db.transaction('rw', [db.workoutSessions, db.routines, db.routineDays, db.routineExercises, db.exerciseAssets], async () => {
    for (const exercise of input.exercises) {
      if (exercise.customAssetId && !(await db.exerciseAssets.get(exercise.customAssetId))) throw new Error('Imagen personalizada no encontrada')
    }
    const sessionId = await getOrCreateSessionForDay(input)
    const session = await db.workoutSessions.get(sessionId)
    if (session?.status === 'completed' && session.manuallyCompleted !== false) throw new Error('La sesión ya está finalizada')
    await db.workoutSessions.update(sessionId, { sessionExercises: input.exercises, ...(session?.status === 'completed' ? { status: 'draft', completedAt: null } : {}), updatedAt: new Date().toISOString() })
    return sessionId
  })
}

export async function completeSessionForDay(input: {
  date: string
  dayId: string
  displayUnit: WeightUnit
  routineId: string
}) {
  return db.transaction('rw', [db.workoutSessions, db.routines, db.routineDays, db.routineExercises], async () => {
    const sessionId = await getOrCreateSessionForDay(input)
    const completedAt = new Date().toISOString()
    await db.workoutSessions.update(sessionId, {
      completedAt,
      manuallyCompleted: true,
      status: 'completed',
      updatedAt: completedAt,
    })
    return sessionId
  })
}

export type SessionWeightProposal = {
  exerciseId: string
  name: string
  previousWeightKg: number
  proposedWeightKg: number
  setId: string
}

export async function getSessionWeightProposals(sessionId: string): Promise<SessionWeightProposal[]> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session || session.status !== 'completed') return []
  const logs = await db.exerciseLogs.where('sessionId').equals(sessionId).toArray()
  const proposals: SessionWeightProposal[] = []
  for (const log of logs) {
    const exercise = await db.routineExercises.get(log.routineExerciseId)
    if (!exercise || exercise.routineId !== session.routineId || exercise.dayId !== session.dayId) continue
    const sets = await db.setLogs.where('exerciseLogId').equals(log.id).filter((set) => set.kind === 'main').sortBy('order')
    const last = sets.at(-1)
    if (last && Number.isFinite(last.weightKg) && last.weightKg >= 0 && last.weightKg !== exercise.currentWeightKg) proposals.push({ exerciseId: exercise.id, name: exercise.name, previousWeightKg: exercise.currentWeightKg, proposedWeightKg: last.weightKg, setId: last.id })
  }
  return proposals
}

export async function applySessionWeightsToRoutine(sessionId: string, proposals: SessionWeightProposal[]) {
  await db.transaction('rw', [db.workoutSessions, db.exerciseLogs, db.setLogs, db.routineExercises], async () => {
    if (new Set(proposals.map((proposal) => proposal.exerciseId)).size !== proposals.length) throw new Error('Selección duplicada')
    const current = await getSessionWeightProposals(sessionId)
    for (const proposal of proposals) {
      if (!current.some((candidate) => candidate.exerciseId === proposal.exerciseId && candidate.setId === proposal.setId && candidate.previousWeightKg === proposal.previousWeightKg && candidate.proposedWeightKg === proposal.proposedWeightKg)) {
        throw new Error('Los datos cambiaron. Revisa nuevamente la propuesta.')
      }
    }
    const now = new Date().toISOString()
    await Promise.all(proposals.map((proposal) => db.routineExercises.update(proposal.exerciseId, { currentWeightKg: proposal.proposedWeightKg, updatedAt: now })))
  })
}

export type SessionTargetProposal = {
  exerciseId: string
  name: string
  field: 'sets' | 'reps'
  previous: string
  proposed: string
}

export async function getSessionTargetProposals(sessionId: string): Promise<SessionTargetProposal[]> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session || session.status !== 'completed') return []
  const logs = await db.exerciseLogs.where('sessionId').equals(sessionId).toArray()
  const proposals: SessionTargetProposal[] = []
  for (const log of logs) {
    const exercise = await db.routineExercises.get(log.routineExerciseId)
    if (!exercise || exercise.routineId !== session.routineId || exercise.dayId !== session.dayId) continue
    const sets = await db.setLogs.where('exerciseLogId').equals(log.id).filter((set) => set.kind === 'main').toArray()
    if (!sets.length || sets.some((set) => !Number.isInteger(set.reps) || set.reps <= 0)) continue
    const previousSets = String(exercise.targetSets)
    const proposedSets = String(sets.length)
    const previousReps = `${exercise.repsMin}–${exercise.repsMax}`
    const proposedReps = `${Math.min(...sets.map((set) => set.reps))}–${Math.max(...sets.map((set) => set.reps))}`
    if (previousSets !== proposedSets) proposals.push({ exerciseId: exercise.id, name: exercise.name, field: 'sets', previous: previousSets, proposed: proposedSets })
    if (previousReps !== proposedReps) proposals.push({ exerciseId: exercise.id, name: exercise.name, field: 'reps', previous: previousReps, proposed: proposedReps })
  }
  return proposals
}

export async function applySessionTargetsToRoutine(sessionId: string, proposals: SessionTargetProposal[]) {
  await db.transaction('rw', [db.workoutSessions, db.exerciseLogs, db.setLogs, db.routineExercises], async () => {
    if (new Set(proposals.map((item) => `${item.exerciseId}:${item.field}`)).size !== proposals.length) throw new Error('Selección duplicada')
    const current = await getSessionTargetProposals(sessionId)
    for (const proposal of proposals) {
      if (!current.some((item) => item.exerciseId === proposal.exerciseId && item.field === proposal.field && item.previous === proposal.previous && item.proposed === proposal.proposed)) throw new Error('Los datos cambiaron. Revisa nuevamente la propuesta.')
    }
    for (const proposal of proposals) {
      const [first, second] = proposal.proposed.split('–').map(Number)
      await db.routineExercises.update(proposal.exerciseId, proposal.field === 'sets'
        ? { targetSets: first, updatedAt: new Date().toISOString() }
        : { repsMin: first, repsMax: second, updatedAt: new Date().toISOString() })
    }
  })
}

export async function reactivateExercise(sessionId: string, routineExerciseId: string) {
  await db.transaction('rw', [db.skipLogs, db.exerciseLogs, db.setLogs], async () => {
    await db.skipLogs
      .where('sessionId')
      .equals(sessionId)
      .filter((skip) => skip.routineExerciseId === routineExerciseId)
      .delete()

    const log = await db.exerciseLogs
      .where('sessionId')
      .equals(sessionId)
      .filter((candidate) => candidate.routineExerciseId === routineExerciseId)
      .first()
    if (log) {
      await refreshExerciseState(log.id)
    }
  })
}

export async function updateMainSet(
  setLogId: string,
  input: {
    reps: number
    rir: number
    weightKg: number
  },
) {
  await updateHistoricalSet({ ...input, setLogId })
}

export async function updateSetWithDrops(setLogId: string, input: {
  main: { reps: number; rir: number; weightKg: number }
  drops: Array<{ id: string | null; reps: number; rir: number; weightKg: number }>
  deletedDropSetIds: string[]
}) {
  const valid = (value: { reps: number; rir: number; weightKg: number }) => setMeasurementsSchema.safeParse(value).success
  if (!valid(input.main) || input.drops.some((drop) => !valid(drop))) throw new Error('Los datos de la serie no son válidos')
  await db.transaction('rw', [db.setLogs, db.dropSetLogs, db.exerciseLogs, db.workoutSessions, db.routineExercises], async () => {
    const set = await db.setLogs.get(setLogId)
    if (!set) throw new Error('Serie no encontrada')
    const existing = await db.dropSetLogs.where('setLogId').equals(setLogId).toArray()
    const existingIds = new Set(existing.map((drop) => drop.id))
    if (input.deletedDropSetIds.some((id) => !existingIds.has(id)) || input.drops.some((drop) => drop.id && !existingIds.has(drop.id))) throw new Error('Drop set no encontrado')
    if (set.kind !== 'main' && input.drops.length) throw new Error('Los calentamientos no admiten drop sets')
    await updateHistoricalSet({ ...input.main, setLogId })
    for (const id of input.deletedDropSetIds) await db.dropSetLogs.delete(id)
    for (const drop of input.drops) {
      if (drop.id) await updateDropSet(drop.id, drop)
      else await addDropSet({ ...drop, displayUnit: set.displayUnit, setLogId })
    }
  })
}

export async function updateHistoricalSession(
  sessionId: string,
  input: { date: string; dayId: string; notes?: string; routineId: string; status?: WorkoutSession['status'] },
) {
  if (input.notes !== undefined && typeof input.notes !== 'string') throw new Error('Las notas no son válidas')
  return db.transaction('rw', [db.workoutSessions, db.routines, db.routineDays], async () => {
    const session = await db.workoutSessions.get(sessionId)
    if (!session) throw new Error('Sesión no encontrada')
    if (!trainingDateSchema.safeParse(input.date).success || input.date > localDateKey(new Date())) throw new Error('La fecha debe ser válida y no posterior a hoy')
    if (input.status !== undefined && !sessionStatusSchema.safeParse(input.status).success) throw new Error('El estado de la sesión no es válido')

    const [routine, day, conflicting] = await Promise.all([
      db.routines.get(input.routineId),
      db.routineDays.get(input.dayId),
      db.workoutSessions.where('[date+dayId]').equals([input.date, input.dayId]).filter((candidate) => candidate.id !== sessionId).first(),
    ])
    const contextUnchanged = input.routineId === session.routineId && input.dayId === session.dayId
    if ((!contextUnchanged && (!routine || !day)) || (day && day.routineId !== input.routineId)) throw new Error('La rutina y el día no son compatibles')
    if (conflicting) throw new Error('Ya existe una sesión para esa fecha y día')

    const now = new Date().toISOString()
    await db.workoutSessions.update(sessionId, {
      ...(input.notes === undefined ? {} : { notes: input.notes }),
      ...(input.date !== session.date && session.health && !session.health.sourceDate ? { health: { ...session.health, sourceDate: session.date } } : {}),
      ...(input.status === undefined ? {} : {
        completedAt: input.status === 'completed' ? session.completedAt ?? now : null,
        manuallyCompleted: input.status === 'completed',
        status: input.status,
      }),
      date: input.date,
      dayId: input.dayId,
      ...(input.dayId !== session.dayId && day ? { dayName: day.name } : {}),
      ...(input.routineId !== session.routineId && routine ? { routineName: routine.name } : {}),
      routineId: input.routineId,
      updatedAt: now,
    })
  })
}

export async function updateHistoricalSet(input: { order?: number; reps: number; rir: number; setLogId: string; weightKg: number }) {
  if (!setMeasurementsSchema.safeParse(input).success || (input.order !== undefined && (!Number.isSafeInteger(input.order) || input.order < 0))) {
    throw new Error('Los datos de la serie no son válidos')
  }
  await db.transaction('rw', [db.setLogs, db.exerciseLogs, db.workoutSessions, db.routineExercises], async () => {
    const set = await db.setLogs.get(input.setLogId)
    if (!set) throw new Error('Serie no encontrada')
    if (input.order !== undefined) {
      const duplicate = await db.setLogs.where('exerciseLogId').equals(set.exerciseLogId)
        .filter((other) => other.id !== set.id && other.kind === set.kind && other.order === input.order).first()
      if (duplicate) throw new Error('Ya existe una serie con ese orden')
    }
    await db.setLogs.update(input.setLogId, {
      ...(input.order === undefined ? {} : { order: input.order }),
      reps: input.reps,
      rir: input.rir,
      updatedAt: new Date().toISOString(),
      weightKg: input.weightKg,
    })
    if (set.kind === 'main') await refreshExerciseState(set.exerciseLogId)
    if (set.kind === 'main') await syncSessionStatusFromExerciseLog(set.exerciseLogId)
  })
}

export async function deleteHistoricalExercise(exerciseLogId: string) {
  await db.transaction('rw', [db.workoutSessions, db.routineExercises, db.exerciseLogs, db.setLogs, db.dropSetLogs, db.skipLogs], async () => {
    const log = await db.exerciseLogs.get(exerciseLogId)
    if (!log) throw new Error('Ejercicio no encontrado')
    const sets = await db.setLogs.where('exerciseLogId').equals(exerciseLogId).toArray()
    await db.dropSetLogs.where('setLogId').anyOf(sets.map((set) => set.id)).delete()
    await db.setLogs.bulkDelete(sets.map((set) => set.id))
    await db.skipLogs.where('sessionId').equals(log.sessionId).filter((skip) => skip.routineExerciseId === log.routineExerciseId).delete()
    await db.exerciseLogs.delete(exerciseLogId)
    await refreshSessionActivityTimestamps(log.sessionId)
    await syncSessionStatusFromExercises(log.sessionId)
  })
}

export async function duplicateSessionAsDraft(input: { sourceSessionId: string; targetDate: string }) {
  return db.transaction('rw', [db.workoutSessions, db.exerciseLogs, db.setLogs], async () => {
    const source = await db.workoutSessions.get(input.sourceSessionId)
    if (!source) throw new Error('Sesión de origen no encontrada')
    if (!trainingDateSchema.safeParse(input.targetDate).success || input.targetDate > localDateKey(new Date())) throw new Error('La fecha debe ser válida y no posterior a hoy')
    const existing = await db.workoutSessions.where('[date+dayId]').equals([input.targetDate, source.dayId]).first()
    if (existing) throw new Error('Ya existe una sesión para esa fecha y día')

    const logs = await db.exerciseLogs.where('sessionId').equals(source.id).toArray()
    const sets = logs.length > 0 ? await db.setLogs.where('exerciseLogId').anyOf(logs.map((log) => log.id)).toArray() : []
    const references = sets
      .filter((set) => set.kind === 'main')
      .map((set) => ({ exerciseLogId: set.exerciseLogId, reps: set.reps, rir: set.rir, weightKg: set.weightKg }))
    const now = new Date().toISOString()
    const { health: _health, healthHistory: _healthHistory, ...sourceWithoutHealth } = source
    const session: WorkoutSession = {
      ...sourceWithoutHealth,
      completedAt: null,
      createdAt: now,
      date: input.targetDate,
      id: createId('session'),
      lastExerciseAt: null,
      manuallyCompleted: false,
      startedAt: null,
      status: 'draft',
      updatedAt: now,
    }
    const copiedLogs = logs.map((log): ExerciseLog => ({ ...log, createdAt: now, id: createId('exercise-log'), sessionId: session.id, state: 'pending', updatedAt: now }))

    await db.workoutSessions.add(session)
    await db.exerciseLogs.bulkAdd(copiedLogs)

    return { references, sessionId: session.id }
  })
}

export async function updateWorkoutSession(
  sessionId: string,
  input: {
    date: string
    dayId: string
    routineId: string
  },
) {
  await updateHistoricalSession(sessionId, input)
}

export async function moveHistoricalSet(input: {
  sessionId: string; setLogId: string; routineExerciseId: string; routineId: string; dayId: string; date: string
  weightKg: number; reps: number; rir: number
}) {
  if (!setMeasurementsSchema.safeParse(input).success) throw new Error('Los datos de la serie no son válidos')
  if (!trainingDateSchema.safeParse(input.date).success || input.date > localDateKey(new Date())) throw new Error('La fecha debe ser válida y no posterior a hoy')
  return db.transaction('rw', [db.workoutSessions, db.routines, db.routineDays, db.routineExercises, db.exerciseLogs, db.setLogs, db.exerciseAssets, db.skipLogs], async () => {
    const set = await db.setLogs.get(input.setLogId)
    if (!set || set.kind !== 'main') throw new Error('Serie principal no encontrada')
    const sourceLog = await db.exerciseLogs.get(set.exerciseLogId)
    if (!sourceLog || sourceLog.sessionId !== input.sessionId) throw new Error('La serie no pertenece a la sesión')
    const sourceSession = await db.workoutSessions.get(input.sessionId)
    const exercise = await db.routineExercises.get(input.routineExerciseId)
    if (!sourceSession || !exercise || exercise.routineId !== input.routineId || exercise.dayId !== input.dayId) throw new Error('El ejercicio de destino no es válido')
    const targetId = await getOrCreateSessionForDay({ date: input.date, dayId: input.dayId, routineId: input.routineId, displayUnit: set.displayUnit })
    const targetLogId = await ensureExerciseLog(targetId, exercise)
    const order = targetLogId === sourceLog.id ? set.order : nextOrder(await db.setLogs.where('exerciseLogId').equals(targetLogId).filter((row) => row.kind === 'main').toArray())
    await db.setLogs.update(set.id, { exerciseLogId: targetLogId, order, weightKg: input.weightKg, reps: input.reps, rir: input.rir, updatedAt: new Date().toISOString() })
    await db.skipLogs.where('sessionId').equals(targetId).filter((skip) => skip.routineExerciseId === exercise.id).delete()
    await refreshExerciseState(sourceLog.id)
    if (targetLogId !== sourceLog.id) await refreshExerciseState(targetLogId)
    await refreshSessionActivityTimestamps(sourceSession.id)
    if (targetId !== sourceSession.id) await refreshSessionActivityTimestamps(targetId)
    await syncSessionStatusFromExercises(sourceSession.id)
    if (targetId !== sourceSession.id) await syncSessionStatusFromExercises(targetId)
    return targetId
  })
}

export async function moveMainSetToExercise(setLogId: string, routineExerciseId: string) {
  await db.transaction('rw', [db.setLogs, db.exerciseLogs, db.workoutSessions, db.routineExercises, db.exerciseAssets], async () => {
    const set = await db.setLogs.get(setLogId)
    if (!set || set.kind !== 'main') throw new Error('Serie principal no encontrada')

    const currentLog = await db.exerciseLogs.get(set.exerciseLogId)
    if (!currentLog) throw new Error('Log de ejercicio no encontrado')

    const exercise = await db.routineExercises.get(routineExerciseId)
    if (!exercise) throw new Error('Ejercicio no encontrado')

    const nextLogId = await ensureExerciseLog(currentLog.sessionId, exercise)
    if (nextLogId === set.exerciseLogId) return

    const sets = await db.setLogs.where('exerciseLogId').equals(nextLogId).and((candidate) => candidate.kind === 'main').toArray()
    const order = nextOrder(sets)

    await db.setLogs.update(setLogId, {
      exerciseLogId: nextLogId,
      order,
      updatedAt: new Date().toISOString(),
    })
    await refreshExerciseState(set.exerciseLogId)
    await refreshExerciseState(nextLogId)
    await syncSessionStatusFromExercises(currentLog.sessionId)
  })
}

export async function deleteMainSet(setLogId: string) {
  await db.transaction('rw', [db.setLogs, db.dropSetLogs, db.exerciseLogs, db.workoutSessions, db.routineExercises], async () => {
    const set = await db.setLogs.get(setLogId)
    if (!set) throw new Error('Serie no encontrada')
    const exerciseLog = await db.exerciseLogs.get(set.exerciseLogId)
    await db.dropSetLogs.where('setLogId').equals(setLogId).delete()
    await db.setLogs.delete(setLogId)
    if (set.kind === 'main') await refreshExerciseState(set.exerciseLogId)
    if (set.kind === 'main') await syncSessionStatusFromExerciseLog(set.exerciseLogId)
    if (exerciseLog && set.kind === 'main') await refreshSessionActivityTimestamps(exerciseLog.sessionId)
  })
}

export async function deleteWorkoutSession(sessionId: string) {
  await db.transaction('rw', [db.workoutSessions, db.exerciseLogs, db.setLogs, db.dropSetLogs, db.skipLogs], async () => {
    const exerciseLogs = await db.exerciseLogs.where('sessionId').equals(sessionId).toArray()
    const exerciseLogIds = exerciseLogs.map((log) => log.id)
    const setLogs = exerciseLogIds.length > 0 ? await db.setLogs.where('exerciseLogId').anyOf(exerciseLogIds).toArray() : []
    const setLogIds = setLogs.map((set) => set.id)
    await Promise.all(setLogIds.map((setLogId) => db.dropSetLogs.where('setLogId').equals(setLogId).delete()))
    await db.setLogs.bulkDelete(setLogIds)
    await db.exerciseLogs.bulkDelete(exerciseLogIds)
    await db.skipLogs.where('sessionId').equals(sessionId).delete()
    await db.workoutSessions.delete(sessionId)
  })
}

async function refreshExerciseState(exerciseLogId: string) {
  const log = await db.exerciseLogs.get(exerciseLogId)
  if (!log) return

  const mainSetCount = await db.setLogs
    .where('exerciseLogId')
    .equals(exerciseLogId)
    .and((set) => set.kind === 'main')
    .count()

  await db.exerciseLogs.update(exerciseLogId, {
    state: exerciseStateFromSets(mainSetCount, log.snapshot.targetSets, false),
    updatedAt: new Date().toISOString(),
  })
}

async function syncSessionStatusFromExerciseLog(exerciseLogId: string) {
  const log = await db.exerciseLogs.get(exerciseLogId)
  if (log) await syncSessionStatusFromExercises(log.sessionId)
}

async function syncSessionStatusFromExercises(sessionId: string) {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return
  if (session.status === 'completed' && session.manuallyCompleted !== false) return

  const exercises = session.sessionExercises ?? await db.routineExercises.where('dayId').equals(session.dayId).toArray()
  if (exercises.length === 0) return

  const logs = await db.exerciseLogs.where('sessionId').equals(sessionId).toArray()
  const logByExerciseId = new Map(logs.map((log) => [log.routineExerciseId, log]))
  const isCompleted = exercises.every((exercise) => logByExerciseId.get(exercise.id)?.state === 'done')
  const nextStatus = isCompleted ? 'completed' : 'draft'

  if (session.status !== nextStatus) {
    const now = new Date().toISOString()
    await db.workoutSessions.update(sessionId, {
      completedAt: nextStatus === 'completed' ? now : null,
      manuallyCompleted: false,
      status: nextStatus,
      updatedAt: now,
    })
  }
}

/**
 * Deleting the last set can otherwise leave the session interval pointing at
 * an exercise that no longer exists. Recompute both bounds from surviving main
 * sets so the next health sync reflects the actual workout history.
 */
async function refreshSessionActivityTimestamps(sessionId: string) {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return

  const exerciseLogs = await db.exerciseLogs.where('sessionId').equals(sessionId).toArray()
  const exerciseLogIds = exerciseLogs.map((log) => log.id)
  const setLogs = exerciseLogIds.length > 0
    ? await db.setLogs.where('exerciseLogId').anyOf(exerciseLogIds).toArray()
    : []
  const mainSets = setLogs.filter((set) => set.kind === 'main').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const now = new Date().toISOString()

  await db.workoutSessions.update(sessionId, {
    lastExerciseAt: mainSets.at(-1)?.createdAt ?? null,
    startedAt: mainSets[0]?.createdAt ?? null,
    updatedAt: now,
  })
}
