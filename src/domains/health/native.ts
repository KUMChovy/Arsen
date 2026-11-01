import { Capacitor, registerPlugin } from '@capacitor/core'
import type { HealthMetricSummary } from './types'

export type HealthAvailabilityStatus = 'available' | 'unavailable' | 'provider-update-required'

export const HEALTH_CONNECT_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'

export type NativeHealthWindow = {
  rangeStart: string
  rangeEnd: string
  metrics: HealthMetricSummary
  missingPermissions: string[]
}

export type NativeHealthReadResult = {
  day: NativeHealthWindow
  exercises?: Array<NativeHealthWindow & { id: string }>
  session?: NativeHealthWindow
}

export type NativeHealthReadRange = {
  id: string
  rangeStart: string
  rangeEnd: string
}

export type NativeHealthPermissions = {
  requested: string[]
  granted: string[]
}

export type HealthConnectPlugin = {
  getAvailability(): Promise<{ status: HealthAvailabilityStatus }>
  getPermissions(): Promise<NativeHealthPermissions>
  openHealthConnectAccess(): Promise<void>
  openHealthConnectInstall(): Promise<void>
  requestHealthPermissions(): Promise<NativeHealthPermissions>
  readDayHealth(input: {
    dayEnd: string
    dayStart: string
    exercises?: NativeHealthReadRange[]
    session?: {
      rangeStart: string
      rangeEnd: string
    }
  }): Promise<NativeHealthReadResult>
}

// Capacitor convierte estas operaciones de TypeScript en llamadas al plugin Kotlin de Android.
export const healthConnect = registerPlugin<HealthConnectPlugin>('HealthConnect')

// La integración solo puede leer Health Connect cuando Arsen se ejecuta como app Android nativa.
export function isHealthConnectNative() {
  return Capacitor.isNativePlatform()
}
