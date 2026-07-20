import type { WeightUnit } from '../workout/types'

export type AppSettings = {
  id: 'app'
  schemaVersion: number
  activeRoutineId: string | null
  preferredUnit: WeightUnit
  deloadNotifications: boolean
  storagePersisted: boolean | null
  createdAt: string
  updatedAt: string
}
