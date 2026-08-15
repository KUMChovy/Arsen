// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import type { AppSettings } from './types'
import { notifyDeloadIfNeeded } from './notifications'

const now = '2026-08-14T12:00:00.000Z'
const notifications: Array<{ body?: string; title: string }> = []

class TestNotification {
  static permission: NotificationPermission = 'granted'

  constructor(title: string, options?: NotificationOptions) {
    notifications.push({ body: options?.body, title })
  }
}

describe('deload notifications', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(now))
    notifications.length = 0
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: TestNotification,
    })
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: TestNotification,
    })
    await resetDb()
    await db.settings.put(appSettings())
  })

  afterEach(async () => {
    vi.useRealTimers()
    await resetDb()
  })

  it('uses the last completed deload as the notification anchor', async () => {
    await db.workoutSessions.put({
      createdAt: now,
      date: '2026-01-01',
      dayId: 'day-1',
      displayUnit: 'kg',
      id: 'session-1',
      notes: '',
      routineId: 'routine-1',
      status: 'completed',
      updatedAt: now,
    })
    await db.deloadCycles.put({
      completedAt: '2026-07-10',
      createdAt: now,
      id: 'deload-1',
      scheduledStartDate: null,
      skippedAt: null,
      startedAt: '2026-07-03',
      status: 'completed',
      suggestedAt: null,
      updatedAt: now,
    })

    await expect(notifyDeloadIfNeeded()).resolves.toBe(true)

    expect(notifications).toEqual([
      {
        body: 'Van 5 semanas desde tu ultima referencia. Considera una semana de descarga.',
        title: 'Arsen: semana de deload',
      },
    ])
  })
})

async function resetDb() {
  db.close()
  await db.delete()
  await db.open()
}

function appSettings(): AppSettings {
  return {
    activeRoutineId: 'routine-1',
    createdAt: now,
    deloadNotifications: true,
    id: 'app',
    lastDeloadNotificationDate: null,
    notificationPermission: 'default',
    preferredUnit: 'kg',
    schemaVersion: 7,
    storagePersisted: null,
    updatedAt: now,
  }
}