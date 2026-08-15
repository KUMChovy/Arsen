import type { WeightUnit } from '../workout/types'

export type DeloadCycleStatus = 'suggested' | 'scheduled' | 'active' | 'completed' | 'skipped'

export type DeloadCycle = {
  id: string
  status: DeloadCycleStatus
  suggestedAt: string | null
  scheduledStartDate: string | null
  startedAt: string | null
  completedAt: string | null
  skippedAt: string | null
  createdAt: string
  updatedAt: string
}

export type DeloadPhase = 'idle' | 'suggested' | 'scheduled' | 'active' | 'completed'

export type DeloadOverview = {
  phase: DeloadPhase
  currentCycle: DeloadCycle | null
  anchorDate: string | null
  firstLogDate: string | null
  lastCompletedDate: string | null
  weeksSinceAnchor: number
  seriesReductionPercent: number
  weightReductionPercent: number
  cooldownUntil: string | null
  daysRemaining: number | null
  shouldNotify: boolean
}

export type AppSettings = {
  id: 'app'
  schemaVersion: number
  activeRoutineId: string | null
  preferredUnit: WeightUnit
  availablePlateWeightsKg?: number[]
  deloadNotifications: boolean
  deloadSeriesReductionPercent?: number
  deloadWeightReductionPercent?: number
  lastDeloadNotificationDate?: string | null
  notificationPermission?: NotificationPermission | 'unsupported'
  storagePersisted: boolean | null
  createdAt: string
  updatedAt: string
}