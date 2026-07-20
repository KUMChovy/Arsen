import { db } from '../../db/schema'
import { shouldNotifyDeload, weeksSince } from '../../shared/calculations/workout'
import { localDateKey } from '../../shared/utils/date'

export async function getDeloadOverview() {
  const firstSession = await db.workoutSessions.orderBy('date').first()
  const today = localDateKey(new Date())
  const weeks = firstSession ? weeksSince(firstSession.date, today) : 0

  return {
    firstLogDate: firstSession?.date ?? null,
    shouldNotify: shouldNotifyDeload(firstSession?.date ?? null, today),
    weeks,
  }
}

export async function requestDeloadNotifications() {
  const permission = await getNotificationPermission(true)

  await db.settings.update('app', {
    deloadNotifications: permission === 'granted',
    notificationPermission: permission,
    updatedAt: new Date().toISOString(),
  })

  return permission
}

export async function notifyDeloadIfNeeded() {
  const settings = await db.settings.get('app')
  if (!settings?.deloadNotifications) return false

  const today = localDateKey(new Date())
  if (settings.lastDeloadNotificationDate === today) return false

  const deload = await getDeloadOverview()
  if (!deload.shouldNotify) return false

  const permission = await getNotificationPermission(false)
  if (permission !== 'granted') {
    await db.settings.update('app', { notificationPermission: permission, updatedAt: new Date().toISOString() })
    return false
  }

  new Notification('Arsen: semana de deload', {
    body: `Van ${deload.weeks} semanas desde tu primer registro. Considera una semana de descarga.`,
    icon: '/icon.svg',
  })
  await db.settings.update('app', {
    lastDeloadNotificationDate: today,
    notificationPermission: permission,
    updatedAt: new Date().toISOString(),
  })

  return true
}

async function getNotificationPermission(request: boolean): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported'
  if (request && Notification.permission === 'default') return Notification.requestPermission()

  return Notification.permission
}
