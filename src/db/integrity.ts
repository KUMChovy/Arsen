import { CURRENT_SCHEMA_VERSION, db } from './schema'
import { healthSummarySchema } from '../shared/validation/healthSchemas'
import { recordedMainOrWarmupSetValuesSchema, recordedSetValuesSchema, timestampSchema, trainingDateSchema } from '../shared/validation/dataContract'
import { datasetSchema } from '../shared/validation/dataset'

export type IntegrityIssue = {
  severity: 'error' | 'warning'
  entity: string
  id: string
  code: string
  message: string
  possibleSolution: string
}


/** Inspects a consistent snapshot. This function never repairs or deletes data. */
export async function diagnoseIntegrity(): Promise<IntegrityIssue[]> {
  return db.transaction('r', db.tables, async () => {
    const [settings, cycles, routines, days, exercises, catalog, assets, targets, sessions, logs, sets, drops, skips] = await Promise.all([
      db.settings.toArray(), db.deloadCycles.toArray(),
      db.routines.toArray(), db.routineDays.toArray(), db.routineExercises.toArray(), db.exerciseCatalog.toArray(), db.exerciseAssets.toArray(),
      db.weeklyVolumeTargets.toArray(),
      db.workoutSessions.toArray(), db.exerciseLogs.toArray(), db.setLogs.toArray(), db.dropSetLogs.toArray(), db.skipLogs.toArray(),
    ])
    const issues: IntegrityIssue[] = []
    const add = (entity: string, id: string, code: string, message: string, possibleSolution: string, severity: IntegrityIssue['severity'] = 'error') => {
      issues.push({ severity, entity, id, code, message, possibleSolution })
    }
    const dataset = { settings, deloadCycles: cycles, routines, routineDays: days, routineExercises: exercises, exerciseCatalog: catalog, exerciseAssets: assets, weeklyVolumeTargets: targets, workoutSessions: sessions, exerciseLogs: logs, setLogs: sets, dropSetLogs: drops, skipLogs: skips }
    const result = datasetSchema.safeParse(dataset)
    if (!result.success) {
      const reported = new Set<string>()
      const tables = dataset as Record<string, Array<{ id: string }>>
      for (const problem of result.error.issues) {
        const [table, index, ...field] = problem.path
        if (typeof table !== 'string' || typeof index !== 'number' || !tables[table]) continue
        const recordId = tables[table][index]?.id ?? (table === 'settings' ? 'app' : `índice ${index}`)
        const key = JSON.stringify([table, recordId])
        if (reported.has(key)) continue
        reported.add(key)
        const fieldName = field.length ? ` (${field.join('.')})` : ''
        add(table, recordId, 'invalid-entity', `El registro no cumple el contrato${fieldName}: ${problem.message}`, 'Revisar el registro sin eliminar datos automáticamente.')
      }
    }
    const routineIds = new Set(routines.map((routine) => routine.id))
    const logIds = new Set(logs.map((log) => log.id))
    const logById = new Map(logs.map((log) => [log.id, log]))
    const dayById = new Map(days.map((day) => [day.id, day]))
    const assetIds = new Set(assets.map((asset) => asset.id))
    const referencedAssets = new Set([
      ...catalog.map((item) => item.customAssetId), ...exercises.map((exercise) => exercise.customAssetId),
      ...logs.map((log) => log.snapshot?.customAssetId), ...sessions.flatMap((session) => (session.sessionExercises ?? []).map((exercise) => exercise.customAssetId)),
    ].filter((id): id is string => typeof id === 'string' && id.length > 0))
    const sessionIds = new Set(sessions.map((session) => session.id))
    const setById = new Map(sets.map((set) => [set.id, set]))
    const timestamped = [
      ['settings', settings], ['deloadCycles', cycles], ['routines', routines], ['routineDays', days],
      ['routineExercises', exercises], ['exerciseCatalog', catalog], ['exerciseAssets', assets],
      ['workoutSessions', sessions], ['exerciseLogs', logs], ['setLogs', sets], ['dropSetLogs', drops],
    ] as const
    for (const [entity, records] of timestamped) {
      for (const record of records) {
        if (!timestampSchema.safeParse(record.createdAt).success || !timestampSchema.safeParse(record.updatedAt).success) add(entity, record.id, 'invalid-timestamp', 'El registro contiene marcas temporales inválidas.', 'Revisar las fechas originales antes de corregirlas.')
      }
    }
    for (const skip of skips) {
      if (!timestampSchema.safeParse(skip.createdAt).success) add('skipLogs', skip.id, 'invalid-timestamp', 'La omisión contiene una marca temporal inválida.', 'Revisar la fecha original antes de corregirla.')
    }
    for (const setting of settings) {
      if (setting.schemaVersion !== CURRENT_SCHEMA_VERSION) add('settings', setting.id, 'schema-version', 'La versión registrada no coincide con el esquema actual.', 'Revisar la transición de la base antes de actualizar la versión registrada.')
    }
    for (const cycle of cycles) {
      const requiredDate = { suggested: cycle.suggestedAt, scheduled: cycle.scheduledStartDate, active: cycle.startedAt, completed: cycle.completedAt, skipped: cycle.skippedAt }[cycle.status]
      if (!requiredDate) add('deloadCycles', cycle.id, 'invalid-state', 'El estado del ciclo de descarga no tiene su fecha correspondiente.', 'Revisar las fechas del ciclo antes de corregirlo.')
      const dates = [cycle.suggestedAt, cycle.scheduledStartDate, cycle.startedAt, cycle.completedAt, cycle.skippedAt]
      if (dates.some((date) => date !== null && !trainingDateSchema.safeParse(date).success)) add('deloadCycles', cycle.id, 'invalid-date', 'El ciclo contiene una fecha inválida.', 'Revisar las fechas originales del ciclo.')
      if (cycle.startedAt && cycle.completedAt && cycle.startedAt > cycle.completedAt) add('deloadCycles', cycle.id, 'invalid-date-order', 'El ciclo termina antes de comenzar.', 'Revisar las fechas originales del ciclo.')
    }
    for (const day of days) {
      if (!routineIds.has(day.routineId)) add('routineDays', day.id, 'missing-routine', 'El día refiere a una rutina inexistente.', 'Revisar la relación y restaurar la rutina si es posible.')
    }
    for (const exercise of exercises) {
      if (dayById.get(exercise.dayId)?.routineId !== exercise.routineId || !routineIds.has(exercise.routineId)) add('routineExercises', exercise.id, 'invalid-day-routine', 'El ejercicio no pertenece a un día y rutina coherentes.', 'Revisar el día y la rutina del ejercicio.')
      if (exercise.customAssetId && !assetIds.has(exercise.customAssetId)) add('routineExercises', exercise.id, 'missing-asset', 'Falta la imagen personalizada del ejercicio.', 'Recuperar el recurso o corregir la referencia.')
    }
    for (const item of catalog) {
      if (item.customAssetId && !assetIds.has(item.customAssetId)) add('exerciseCatalog', item.id, 'missing-asset', 'Falta la imagen personalizada del catálogo.', 'Recuperar el recurso o revisar la referencia.')
    }
    for (const asset of assets) {
      if (!referencedAssets.has(asset.id)) add('exerciseAssets', asset.id, 'unreferenced-asset', 'La imagen no tiene referencias conocidas.', 'Confirmar si se necesita antes de cualquier limpieza.', 'warning')
    }
    for (const target of targets) {
      if (!routineIds.has(target.routineId)) add('weeklyVolumeTargets', target.id, 'missing-routine', 'El objetivo de volumen no tiene una rutina.', 'Recuperar la rutina o revisar la referencia.')
    }
    const sessionKeys = new Set<string>()
    for (const session of sessions) {
      const day = dayById.get(session.dayId)
      if (day && day.routineId !== session.routineId) add('workoutSessions', session.id, 'invalid-day-routine', 'El día actual pertenece a otra rutina.', 'Comparar la sesión con sus instantáneas antes de corregir la referencia.')
      if ((!routineIds.has(session.routineId) && !session.routineName) || (!day && !session.dayName)) add('workoutSessions', session.id, 'missing-history-context', 'No está disponible parte del contexto histórico de la sesión.', 'Revisar respaldos o conservar la sesión con el contexto disponible.', 'warning')
      const date = session.date
      if (!trainingDateSchema.safeParse(date).success) add('workoutSessions', session.id, 'invalid-date', 'La fecha de entrenamiento no es válida.', 'Revisar la fecha original de la sesión.')
      const key = JSON.stringify([session.date, session.dayId])
      if (sessionKeys.has(key)) add('workoutSessions', session.id, 'duplicate-session', 'Hay más de una sesión para el mismo día y fecha.', 'Comparar las sesiones antes de decidir cómo resolverlas.')
      sessionKeys.add(key)
      if (session.health) {
        const result = healthSummarySchema.safeParse(session.health)
        if (!result.success) add('workoutSessions', session.id, 'invalid-health', 'El resumen de salud contiene valores o intervalos inválidos.', 'Revisar el resumen sin eliminarlo.')
        else {
          const seen = new Set<string>()
          for (const exercise of result.data.exercises ?? []) {
            const log = logById.get(exercise.exerciseLogId)
            if (!log || log.sessionId !== session.id || log.routineExerciseId !== exercise.routineExerciseId || seen.has(exercise.exerciseLogId)) {
              add('workoutSessions', session.id, 'invalid-health-reference', 'El resumen de salud refiere a un ejercicio ausente, duplicado o de otra sesión.', 'Comparar el resumen con los registros de la sesión sin borrarlo.', log ? 'error' : 'warning')
            }
            seen.add(exercise.exerciseLogId)
          }
        }
      }
    }
    const logKeys = new Set<string>()
    for (const log of logs) {
      if (!sessionIds.has(log.sessionId)) add('exerciseLogs', log.id, 'missing-session', 'El registro de ejercicio no tiene una sesión.', 'Recuperar la sesión o revisar su referencia.')
      const key = JSON.stringify([log.sessionId, log.routineExerciseId])
      if (logKeys.has(key)) add('exerciseLogs', log.id, 'duplicate-log', 'Hay registros duplicados de ejercicio en la sesión.', 'Comparar los registros y sus series antes de decidir cómo resolverlos.')
      logKeys.add(key)
      if (log.snapshot?.customAssetId && !assetIds.has(log.snapshot.customAssetId)) add('exerciseLogs', log.id, 'missing-asset', 'Falta la imagen personalizada histórica.', 'Recuperar el recurso o revisar la referencia sin borrar el historial.')
    }
    for (const set of sets) {
      if (!logIds.has(set.exerciseLogId)) add('setLogs', set.id, 'missing-exercise-log', 'La serie no tiene un registro de ejercicio.', 'Revisar la relación o recuperar el registro de ejercicio.')
      if (!recordedMainOrWarmupSetValuesSchema.safeParse(set).success) add('setLogs', set.id, 'invalid-value', 'La serie contiene valores inválidos.', 'Revisar los valores originales antes de corregirlos.')
    }
    for (const drop of drops) {
      const parent = setById.get(drop.setLogId)
      if (!parent) add('dropSetLogs', drop.id, 'missing-set', 'El drop set no tiene una serie.', 'Recuperar la serie o revisar su referencia.')
      else if (parent.kind !== 'main') add('dropSetLogs', drop.id, 'incompatible-set', 'El drop set pertenece a una serie de calentamiento.', 'Revisar la serie y el drop set antes de corregirlos.')
      if (!recordedSetValuesSchema.safeParse(drop).success) add('dropSetLogs', drop.id, 'invalid-value', 'El drop set contiene valores inválidos.', 'Revisar los valores originales antes de corregirlos.')
    }
    for (const skip of skips) {
      if (!sessionIds.has(skip.sessionId)) add('skipLogs', skip.id, 'missing-session', 'La omisión no tiene una sesión.', 'Recuperar la sesión o revisar su referencia.')
    }
    return issues
  })
}
