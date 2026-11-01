import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import type { AppSettings } from '../settings/types'
import { enableHealthIntegration, openHealthConnectAccess, openHealthConnectInstall, syncAllWorkoutHealth, syncWorkoutHealth } from './services'

const native = vi.hoisted(() => ({
  HEALTH_CONNECT_PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata',
  healthConnect: {
    getAvailability: vi.fn(),
    getPermissions: vi.fn(),
    openHealthConnectAccess: vi.fn(),
    openHealthConnectInstall: vi.fn(),
    readDayHealth: vi.fn(),
    requestHealthPermissions: vi.fn(),
  },
  isHealthConnectNative: vi.fn(() => true),
}))

vi.mock('./native', () => native)

describe('health services', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    native.isHealthConnectNative.mockReturnValue(true)
    await Promise.all([
      db.settings.clear(),
      db.workoutSessions.clear(),
      db.exerciseLogs.clear(),
      db.setLogs.clear(),
    ])
    await db.settings.put(appSettings())
    native.healthConnect.getAvailability.mockResolvedValue({ status: 'available' })
    native.healthConnect.getPermissions.mockResolvedValue({ granted: ['heart-rate'] })
    native.healthConnect.requestHealthPermissions.mockResolvedValue({ granted: ['heart-rate'] })
  })

  it('activates only after an explicit permission request', async () => {
    await enableHealthIntegration()

    expect(native.healthConnect.requestHealthPermissions).toHaveBeenCalledOnce()
    await expect(db.settings.get('app')).resolves.toMatchObject({
      healthIntegrationEnabled: true,
      healthIntegrationFirstConnectedAt: expect.any(String),
    })
  })

  it('exposes an actionable unavailable state without activating the integration', async () => {
    native.healthConnect.getAvailability.mockResolvedValue({ status: 'unavailable' })

    await expect(enableHealthIntegration()).rejects.toMatchObject({
      name: 'HealthConnectAvailabilityError',
      status: 'unavailable',
    })

    expect(native.healthConnect.requestHealthPermissions).not.toHaveBeenCalled()
    await expect(db.settings.get('app')).resolves.not.toMatchObject({ healthIntegrationEnabled: true })
  })

  it('opens the Health Connect installation flow through the native adapter', async () => {
    await openHealthConnectInstall()

    expect(native.healthConnect.openHealthConnectInstall).toHaveBeenCalledOnce()
  })

  it('opens the app-specific Health Connect access screen through the native adapter', async () => {
    await openHealthConnectAccess()

    expect(native.healthConnect.openHealthConnectAccess).toHaveBeenCalledOnce()
  })

  it('opens the Play Store web page when running outside Android', async () => {
    native.isHealthConnectNative.mockReturnValue(false)
    const open = vi.fn(() => null)
    vi.stubGlobal('open', open)

    await openHealthConnectInstall()

    expect(open).toHaveBeenCalledWith(
      'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata',
      '_blank',
      'noopener,noreferrer',
    )
    vi.unstubAllGlobals()
  })

  it('saves daily, session and exercise summaries using their own ranges', async () => {
    await db.settings.update('app', {
      healthIntegrationEnabled: true,
      healthIntegrationFirstConnectedAt: '2026-07-20T16:00:00.000Z',
    })
    await db.workoutSessions.put({
      createdAt: '2026-07-20T16:42:00.000Z',
      date: '2026-07-20',
      dayId: 'day-1',
      displayUnit: 'kg',
      id: 'session-1',
      notes: '',
      routineId: 'routine-1',
      startedAt: '2026-07-20T16:42:00.000Z',
      completedAt: '2026-07-20T18:30:00.000Z',
      status: 'completed',
      updatedAt: '2026-07-20T18:40:00.000Z',
    })
    await db.exerciseLogs.put({
      createdAt: '2026-07-20T16:45:00.000Z',
      id: 'exercise-log-1',
      routineExerciseId: 'exercise-1',
      sessionId: 'session-1',
      snapshot: {
        canonicalName: 'press-inclinado',
        equipment: 'machine',
        mainMuscle: 'chest',
        name: 'Press inclinado',
        recommendedRir: 2,
        repsMax: 12,
        repsMin: 8,
        restSeconds: 90,
        targetSets: 3,
      },
      state: 'done',
      notes: '',
      updatedAt: '2026-07-20T17:00:00.000Z',
    })
    await db.setLogs.put({
      createdAt: '2026-07-20T16:45:00.000Z',
      displayUnit: 'kg',
      exerciseLogId: 'exercise-log-1',
      id: 'set-1',
      kind: 'main',
      order: 0,
      reps: 12,
      rir: 2,
      updatedAt: '2026-07-20T16:45:00.000Z',
      weightKg: 50,
    })
    await db.setLogs.put({
      createdAt: '2026-07-20T17:00:00.000Z',
      displayUnit: 'kg',
      exerciseLogId: 'exercise-log-1',
      id: 'set-2',
      kind: 'main',
      order: 1,
      reps: 12,
      rir: 2,
      updatedAt: '2026-07-20T17:00:00.000Z',
      weightKg: 50,
    })
    const now = new Date('2026-07-20T20:04:00.000Z')
    native.healthConnect.readDayHealth.mockResolvedValue({
      day: {
        metrics: metrics({ activeCaloriesKcal: 800, steps: 7000 }),
        missingPermissions: ['oxygenSaturation'],
        rangeEnd: now.toISOString(),
        rangeStart: '2026-07-20T00:00:00.000Z',
      },
      session: {
        metrics: metrics({ activeCaloriesKcal: 260, steps: 1500 }),
        missingPermissions: [],
        rangeEnd: '2026-07-20T17:00:00.000Z',
        rangeStart: '2026-07-20T16:45:00.000Z',
      },
      exercises: [
        {
          id: 'exercise-log-1',
          metrics: metrics({ activeCaloriesKcal: 40, steps: 200 }),
          missingPermissions: [],
          rangeEnd: '2026-07-20T17:00:00.000Z',
          rangeStart: '2026-07-20T16:45:00.000Z',
        },
      ],
    })

    const summary = await syncWorkoutHealth('session-1', now)
    const stored = await db.workoutSessions.get('session-1')

    expect(native.healthConnect.readDayHealth).toHaveBeenCalledWith({
      dayEnd: now.toISOString(),
      dayStart: new Date(2026, 6, 20).toISOString(),
      session: {
        rangeEnd: '2026-07-20T17:00:00.000Z',
        rangeStart: '2026-07-20T16:45:00.000Z',
      },
      exercises: [
        {
          id: 'exercise-log-1',
          rangeEnd: '2026-07-20T17:00:00.000Z',
          rangeStart: '2026-07-20T16:45:00.000Z',
        },
      ],
    })
    expect(summary).toMatchObject({ syncedAt: now.toISOString() })
    expect(summary?.session).toMatchObject({
      rangeEnd: '2026-07-20T17:00:00.000Z',
      rangeStart: '2026-07-20T16:45:00.000Z',
    })
    expect(summary?.exercises).toEqual([
      expect.objectContaining({
        canonicalName: 'press-inclinado',
        exerciseLogId: 'exercise-log-1',
        exerciseName: 'Press inclinado',
        metrics: expect.anything(),
        setCount: 2,
      }),
    ])
    expect(stored?.health).toEqual(summary)
  })

  it('reads the complete historical day even when the integration was connected later', async () => {
    await db.settings.update('app', {
      healthIntegrationEnabled: true,
      healthIntegrationFirstConnectedAt: '2026-07-20T16:00:00.000Z',
    })
    await db.workoutSessions.put({
      createdAt: '2026-07-20T16:42:00.000Z',
      date: '2026-07-20',
      dayId: 'day-1',
      displayUnit: 'kg',
      id: 'session-1',
      notes: '',
      routineId: 'routine-1',
      startedAt: '2026-07-20T16:42:00.000Z',
      completedAt: '2026-07-20T18:30:00.000Z',
      status: 'completed',
      updatedAt: '2026-07-20T18:40:00.000Z',
    })
    native.healthConnect.readDayHealth.mockResolvedValue({
      day: {
        metrics: metrics(),
        missingPermissions: [],
        rangeEnd: '2026-07-20T20:04:00.000Z',
        rangeStart: '2026-07-20T00:00:00.000Z',
      },
    })

    await syncWorkoutHealth('session-1', new Date('2026-07-20T20:04:00.000Z'))

    expect(native.healthConnect.readDayHealth).toHaveBeenCalledWith(expect.objectContaining({
      dayStart: new Date(2026, 6, 20).toISOString(),
    }))
  })

  it('can refresh every stored workout session for historical health data', async () => {
    await db.settings.update('app', { healthIntegrationEnabled: true })
    await db.workoutSessions.bulkPut([
      workoutSession('session-1', '2026-07-18'),
      workoutSession('session-2', '2026-07-20'),
    ])
    native.healthConnect.readDayHealth.mockResolvedValue({
      day: {
        metrics: metrics(),
        missingPermissions: [],
        rangeEnd: '2026-07-20T23:59:59.999Z',
        rangeStart: '2026-07-20T00:00:00.000Z',
      },
    })

    await expect(syncAllWorkoutHealth(new Date('2026-07-20T20:04:00.000Z'))).resolves.toMatchObject({ syncedSessions: 2 })
    expect(native.healthConnect.readDayHealth).toHaveBeenCalledTimes(2)
    await expect(db.workoutSessions.get('session-1')).resolves.toMatchObject({ health: expect.anything() })
    await expect(db.workoutSessions.get('session-2')).resolves.toMatchObject({ health: expect.anything() })
  })

  it('does nothing when the optional module is disabled', async () => {
    await expect(syncWorkoutHealth('missing-session', new Date('2026-07-20T20:04:00.000Z'))).resolves.toBeNull()
    expect(native.healthConnect.getAvailability).not.toHaveBeenCalled()
    expect(native.healthConnect.readDayHealth).not.toHaveBeenCalled()
  })
})

function appSettings(): AppSettings {
  return {
    activeRoutineId: null,
    createdAt: '2026-07-20T00:00:00.000Z',
    deloadNotifications: false,
    id: 'app',
    preferredUnit: 'kg',
    schemaVersion: 7,
    storagePersisted: null,
    updatedAt: '2026-07-20T00:00:00.000Z',
  }
}

function metrics(overrides: Partial<Record<string, number | null>> = {}) {
  return {
    activeCaloriesKcal: null,
    heartRateAvgBpm: 120,
    heartRateMaxBpm: 160,
    heartRateMinBpm: 80,
    oxygenSaturationAvgPercent: null,
    steps: null,
    ...overrides,
  }
}

function workoutSession(id: string, date: string) {
  return {
    createdAt: `${date}T16:42:00.000Z`,
    date,
    dayId: 'day-1',
    displayUnit: 'kg' as const,
    id,
    notes: '',
    routineId: 'routine-1',
    startedAt: `${date}T16:42:00.000Z`,
    completedAt: `${date}T18:30:00.000Z`,
    status: 'completed' as const,
    updatedAt: `${date}T18:40:00.000Z`,
  }
}
