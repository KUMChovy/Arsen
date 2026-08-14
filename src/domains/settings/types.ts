import type { WeightUnit } from '../workout/types'

export type AppSettings = {
  id: 'app'
  schemaVersion: number
  activeRoutineId: string | null
  preferredUnit: WeightUnit
  availablePlateWeightsKg?: number[]
  deloadNotifications: boolean
  lastDeloadNotificationDate?: string | null
  notificationPermission?: NotificationPermission | 'unsupported'
  storagePersisted: boolean | null
  createdAt: string
  updatedAt: string
}
