import { db } from '../../db/schema'
import { localDateKey } from '../../shared/utils/date'
import { getAppSettings } from '../settings/services'
import { resolveHealthDayWindow, resolveHealthWindows } from './calculations'
import {
  HEALTH_CONNECT_PLAY_STORE_URL,
  healthConnect,
  isHealthConnectNative,
  type HealthAvailabilityStatus,
  type NativeHealthReadResult,
  type NativeHealthPermissions,
} from './native'
import type { HealthSummary, HealthWindowSummary } from './types'

export type HealthAvailability = {
  status: HealthAvailabilityStatus | 'not-native'
}

export class HealthConnectAvailabilityError extends Error {
  constructor(readonly status: HealthAvailabilityStatus) {
    super(healthAvailabilityMessage(status))
    this.name = 'HealthConnectAvailabilityError'
  }
}

export function isHealthConnectAvailabilityError(error: unknown): error is HealthConnectAvailabilityError {
  return error instanceof HealthConnectAvailabilityError
}

// Consulta si el proveedor Android existe sin abrir pantallas ni pedir permisos.
export async function getHealthAvailability(): Promise<HealthAvailability> {
  if (!isHealthConnectNative()) return { status: 'not-native' }
  return healthConnect.getAvailability()
}

// Lee el estado actual de los cuatro permisos que Arsen puede solicitar.
export async function getHealthPermissions(): Promise<NativeHealthPermissions> {
  if (!isHealthConnectNative()) return { granted: [], requested: [] }
  return healthConnect.getPermissions()
}

// Activa la función solo después de que Health Connect y al menos un permiso existan.
export async function enableHealthIntegration() {
  if (!isHealthConnectNative()) throw new Error('La integración de salud solo está disponible en Android')

  const availability = await healthConnect.getAvailability()
  if (availability.status !== 'available') {
    throw new HealthConnectAvailabilityError(availability.status)
  }

  const permissions = await healthConnect.requestHealthPermissions()
  if (permissions.granted.length === 0) {
    throw new Error('No se concedieron permisos de salud')
  }

  const currentSettings = await getAppSettings()
  await db.settings.update('app', {
    healthIntegrationEnabled: true,
    healthIntegrationFirstConnectedAt: currentSettings?.healthIntegrationFirstConnectedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  return permissions
}

export async function openHealthConnectInstall() {
  if (!isHealthConnectNative()) {
    if (typeof globalThis.open !== 'function') throw new Error('No se pudo abrir Google Play desde este entorno')
    globalThis.open(HEALTH_CONNECT_PLAY_STORE_URL, '_blank', 'noopener,noreferrer')
    return
  }
  await healthConnect.openHealthConnectInstall()
}

export async function openHealthConnectAccess() {
  if (!isHealthConnectNative()) {
    if (typeof globalThis.open !== 'function') throw new Error('Health Connect solo se puede abrir desde Android')
    globalThis.open(HEALTH_CONNECT_PLAY_STORE_URL, '_blank', 'noopener,noreferrer')
    return
  }
  await healthConnect.openHealthConnectAccess()
}

export async function disableHealthIntegration() {
  await db.settings.update('app', {
    healthIntegrationEnabled: false,
    updatedAt: new Date().toISOString(),
  })
}

// Lee bajo demanda, transforma la respuesta nativa y guarda el resumen junto a la sesión.
export async function syncWorkoutHealth(sessionId: string, syncTime = new Date()): Promise<HealthSummary | null> {
  const settings = await getAppSettings()
  // This guard keeps old users and users without a watch on the exact old flow:
  // no native call, no permission prompt, no new database record, no error.
  if (!settings?.healthIntegrationEnabled) return null
  if (!isHealthConnectNative()) return null

  const availability = await healthConnect.getAvailability()
  if (availability.status !== 'available') {
    throw new HealthConnectAvailabilityError(availability.status)
  }

  const session = await db.workoutSessions.get(sessionId)
  if (!session) throw new Error('Sesión de entrenamiento no encontrada')

  // Health Connect can return records from before Arsen was connected.
  const day = resolveHealthDayWindow(session.date, syncTime)
  const [exerciseLogs, sessionSets] = await Promise.all([
    db.exerciseLogs.where('sessionId').equals(sessionId).toArray(),
    db.setLogs.toArray(),
  ])
  const setLogsByExerciseLogId = new Map<string, typeof sessionSets>()
  for (const set of sessionSets) {
    if (set.kind !== 'main' || !exerciseLogs.some((log) => log.id === set.exerciseLogId)) continue
    const current = setLogsByExerciseLogId.get(set.exerciseLogId)
    if (current) current.push(set)
    else setLogsByExerciseLogId.set(set.exerciseLogId, [set])
  }
  const windows = resolveHealthWindows(
    session,
    exerciseLogs.map((log) => ({
      canonicalName: log.snapshot.canonicalName,
      exerciseLogId: log.id,
      exerciseName: log.snapshot.name,
      routineExerciseId: log.routineExerciseId,
      setCount: setLogsByExerciseLogId.get(log.id)?.length ?? 0,
      setTimes: (setLogsByExerciseLogId.get(log.id) ?? []).map((set) => set.createdAt),
    })),
    syncTime,
  )
  const sessionRange = windows.session
  // Se envía el día completo y, si hay series con duración, sus rangos específicos.
  const nativeResult = await healthConnect.readDayHealth({
    dayEnd: day.rangeEnd,
    dayStart: day.rangeStart,
    exercises: windows.exercises.map(({ exerciseLogId, rangeEnd, rangeStart }) => {
      return {
        id: exerciseLogId,
        rangeEnd,
        rangeStart,
      }
    }),
    ...(sessionRange ? { session: sessionRange } : {}),
  })
  const summary: HealthSummary = {
    day: nativeWindowToSummary(nativeResult.day),
    syncedAt: syncTime.toISOString(),
    ...(nativeResult.session && windows.session
      ? { session: nativeWindowToSummary(nativeResult.session) }
      : {}),
    ...(nativeResult.exercises
      ? {
          exercises: nativeResult.exercises.flatMap((exercise) => {
            const metadata = windows.exercises.find((window) => window.exerciseLogId === exercise.id)
            return metadata
              ? [{
                  ...nativeWindowToSummary(exercise),
                  canonicalName: metadata.canonicalName,
                  exerciseLogId: metadata.exerciseLogId,
                  exerciseName: metadata.exerciseName,
                  routineExerciseId: metadata.routineExerciseId,
                  setCount: metadata.setCount,
                }]
              : []
          }),
        }
      : {}),
    sessionEndSource: windows.sessionEndSource,
  }

  // Se persiste solo el resumen; las muestras crudas permanecen en Health Connect.
  await db.workoutSessions.update(sessionId, {
    health: summary,
    updatedAt: summary.syncedAt,
  })
  return summary
}

// Actualiza sesiones históricas hasta hoy para recuperar datos que ya estén publicados.
export async function syncAllWorkoutHealth(syncTime = new Date()): Promise<{ syncedSessions: number }> {
  const settings = await getAppSettings()
  if (!settings?.healthIntegrationEnabled || !isHealthConnectNative()) return { syncedSessions: 0 }

  const sessions = await db.workoutSessions.orderBy('date').toArray()
  const currentDate = localDateKey(syncTime)
  let syncedSessions = 0

  for (const session of sessions) {
    if (session.date > currentDate) continue
    await syncWorkoutHealth(session.id, syncTime)
    syncedSessions += 1
  }

  return { syncedSessions }
}

function nativeWindowToSummary(window: NativeHealthReadResult['day']): HealthWindowSummary {
  return {
    metrics: window.metrics,
    rangeEnd: window.rangeEnd,
    rangeStart: window.rangeStart,
  }
}

function healthAvailabilityMessage(status: HealthAvailabilityStatus) {
  if (status === 'provider-update-required') return 'Health Connect necesita una actualización'
  return 'Health Connect no está disponible en este dispositivo'
}
