import { z } from 'zod'
import { assetEntitySchema, catalogEntitySchema, deloadEntitySchema, dropSetEntitySchema, exerciseLogEntitySchema, routineDayEntitySchema, routineEntitySchema, routineExerciseEntitySchema, sessionEntitySchema, setEntitySchema, settingsEntitySchema, skipEntitySchema, volumeTargetEntitySchema } from './entities'

export const datasetSchema = z.object({
  settings: z.array(settingsEntitySchema), deloadCycles: z.array(deloadEntitySchema), routines: z.array(routineEntitySchema),
  routineDays: z.array(routineDayEntitySchema), routineExercises: z.array(routineExerciseEntitySchema), exerciseCatalog: z.array(catalogEntitySchema),
  exerciseAssets: z.array(assetEntitySchema), weeklyVolumeTargets: z.array(volumeTargetEntitySchema), workoutSessions: z.array(sessionEntitySchema),
  exerciseLogs: z.array(exerciseLogEntitySchema), setLogs: z.array(setEntitySchema), dropSetLogs: z.array(dropSetEntitySchema), skipLogs: z.array(skipEntitySchema),
}).strict().superRefine((data, ctx) => {
  const issue = (table: string, index: number, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [table, index], message })
  for (const [table, rows] of Object.entries(data)) {
    const seen = new Set<string>()
    rows.forEach((row, index) => {
      if (seen.has(row.id)) issue(table, index, 'Identificador duplicado')
      seen.add(row.id)
    })
  }
  const routines = new Set(data.routines.map((row) => row.id))
  if (data.settings.length !== 1) issue('settings', 0, 'Se requiere la configuración de la aplicación')
  if (data.settings[0]?.activeRoutineId && !routines.has(data.settings[0].activeRoutineId)) issue('settings', 0, 'La rutina activa no existe')
  const activeRoutineId = data.settings[0]?.activeRoutineId
  const activeRoutines = data.routines.filter((routine) => routine.isActive)
  if (data.settings.length === 1 && (activeRoutineId ? activeRoutines.length !== 1 || activeRoutines[0]?.id !== activeRoutineId : activeRoutines.length !== 0)) issue('settings', 0, 'La rutina activa no coincide con la configuración')
  const days = new Map(data.routineDays.map((row) => [row.id, row]))
  const sessions = new Map(data.workoutSessions.map((row) => [row.id, row]))
  const logs = new Map(data.exerciseLogs.map((row) => [row.id, row]))
  const sets = new Map(data.setLogs.map((row) => [row.id, row]))
  const assets = new Set(data.exerciseAssets.map((row) => row.id))
  const assetExists = (assetId: string | null | undefined) => !assetId || assets.has(assetId)
  const distinct = <T>(table: string, rows: T[], keyOf: (row: T) => unknown) => {
    const seen = new Set<string>()
    rows.forEach((row, index) => {
      const key = JSON.stringify(keyOf(row))
      if (seen.has(key)) issue(table, index, 'Orden o relación duplicada')
      seen.add(key)
    })
  }
  distinct('routineDays', data.routineDays, (row) => [row.routineId, row.order])
  distinct('routineExercises', data.routineExercises, (row) => [row.dayId, row.order])
  distinct('setLogs', data.setLogs, (row) => [row.exerciseLogId, row.kind, row.order])
  distinct('dropSetLogs', data.dropSetLogs, (row) => [row.setLogId, row.order])
  distinct('skipLogs', data.skipLogs, (row) => [row.sessionId, row.routineExerciseId])
  data.deloadCycles.forEach((row, index) => {
    const required = { suggested: row.suggestedAt, scheduled: row.scheduledStartDate, active: row.startedAt, completed: row.completedAt, skipped: row.skippedAt }[row.status]
    if (!required || (row.startedAt && row.completedAt && row.startedAt > row.completedAt)) issue('deloadCycles', index, 'Estado o fechas de descarga incoherentes')
  })
  data.routineDays.forEach((row, index) => { if (!routines.has(row.routineId)) issue('routineDays', index, 'Rutina inexistente') })
  data.routineExercises.forEach((row, index) => {
    if (!routines.has(row.routineId) || days.get(row.dayId)?.routineId !== row.routineId) issue('routineExercises', index, 'Día o rutina incompatible')
    if (!assetExists(row.customAssetId)) issue('routineExercises', index, 'Imagen personalizada inexistente')
  })
  data.exerciseCatalog.forEach((row, index) => { if (!assetExists(row.customAssetId)) issue('exerciseCatalog', index, 'Imagen personalizada inexistente') })
  data.weeklyVolumeTargets.forEach((row, index) => { if (!routines.has(row.routineId)) issue('weeklyVolumeTargets', index, 'Rutina inexistente') })
  const sessionKeys = new Set<string>()
  data.workoutSessions.forEach((row, index) => {
    const day = days.get(row.dayId)
    if (day && day.routineId !== row.routineId) issue('workoutSessions', index, 'Día y rutina incompatibles')
    if (new Set((row.sessionExercises ?? []).map((exercise) => exercise.id)).size !== (row.sessionExercises ?? []).length) issue('workoutSessions', index, 'Ejercicio duplicado en el plan de sesión')
    if ((row.sessionExercises ?? []).some((exercise) => !assetExists(exercise.customAssetId))) issue('workoutSessions', index, 'Imagen de sesión inexistente')
    for (const summary of [...(row.healthHistory ?? []), ...(row.health ? [row.health] : [])]) {
      const healthLogIds = new Set<string>()
      for (const health of summary.exercises ?? []) {
        const log = logs.get(health.exerciseLogId)
        if ((log && (log.sessionId !== row.id || log.routineExerciseId !== health.routineExerciseId)) || healthLogIds.has(health.exerciseLogId)) issue('workoutSessions', index, 'Referencia de salud incompatible')
        healthLogIds.add(health.exerciseLogId)
      }
    }
    const key = JSON.stringify([row.date, row.dayId])
    if (sessionKeys.has(key)) issue('workoutSessions', index, 'Sesión duplicada para fecha y día')
    sessionKeys.add(key)
  })
  const logKeys = new Set<string>()
  data.exerciseLogs.forEach((row, index) => {
    if (!sessions.has(row.sessionId)) issue('exerciseLogs', index, 'Sesión inexistente')
    if (!assetExists(row.snapshot.customAssetId)) issue('exerciseLogs', index, 'Imagen histórica inexistente')
    const key = JSON.stringify([row.sessionId, row.routineExerciseId])
    if (logKeys.has(key)) issue('exerciseLogs', index, 'Registro de ejercicio duplicado')
    logKeys.add(key)
  })
  data.setLogs.forEach((row, index) => { if (!logs.has(row.exerciseLogId)) issue('setLogs', index, 'Registro de ejercicio inexistente') })
  data.dropSetLogs.forEach((row, index) => { if (sets.get(row.setLogId)?.kind !== 'main') issue('dropSetLogs', index, 'Serie principal inexistente') })
  data.skipLogs.forEach((row, index) => { if (!sessions.has(row.sessionId)) issue('skipLogs', index, 'Sesión inexistente') })
})

export type ValidatedDataset = z.infer<typeof datasetSchema>
