import { db } from '../../db/schema'

export type AppNotice = { id: string; title: string; body: string; createdAt: string; dismissed: boolean }

export async function getNoticeCenterEnabled(): Promise<boolean> {
  const record = await db.localMetadata.get('noticeCenterEnabled')
  return record?.id === 'noticeCenterEnabled' ? record.value : true
}
export async function setNoticeCenterEnabled(enabled: boolean): Promise<void> {
  await db.localMetadata.put({ id: 'noticeCenterEnabled', value: enabled })
}

export function currentWeekStart(now = new Date()): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setDate(start.getDate() - (start.getDay() + 6) % 7)
  return start
}

export async function pruneNoticeHistory(now = new Date()): Promise<void> {
  await db.transaction('rw', db.localMetadata, async () => {
    const items = await getNotices()
    const start = currentWeekStart(now).getTime()
    const retained = items.filter((item) => !item.dismissed || !Number.isFinite(Date.parse(item.createdAt)) || Date.parse(item.createdAt) >= start)
    if (retained.length !== items.length) await db.localMetadata.put({ id: 'notificationCenter', value: retained })
  })
}

export async function getNotices(): Promise<AppNotice[]> {
  const record = await db.localMetadata.get('notificationCenter')
  return record?.id === 'notificationCenter' ? record.value : []
}

export async function addNotice(notice: Pick<AppNotice, 'id' | 'title' | 'body'>): Promise<void> {
  await db.transaction('rw', db.localMetadata, async () => {
    const items = await getNotices()
    if (items.some((item) => item.id === notice.id)) return
    await db.localMetadata.put({ id: 'notificationCenter', value: [{ ...notice, createdAt: new Date().toISOString(), dismissed: false }, ...items] })
  })
}

export async function dismissNotice(id: string): Promise<void> {
  await db.transaction('rw', db.localMetadata, async () => {
    const items = await getNotices()
    if (!items.some((item) => item.id === id && !item.dismissed)) return
    await db.localMetadata.put({ id: 'notificationCenter', value: items.map((item) => item.id === id ? { ...item, dismissed: true } : item) })
  })
}

export async function syncNotices(prefix: string, current: Array<Pick<AppNotice, 'id' | 'title' | 'body'>>): Promise<void> {
  await db.transaction('rw', db.localMetadata, async () => {
    const items = await getNotices()
    const currentIds = new Set(current.map((item) => item.id))
    const existing = new Set(items.map((item) => item.id))
    const newItems = current.filter((item) => !existing.has(item.id)).map((item) => ({ ...item, createdAt: new Date().toISOString(), dismissed: false }))
    const changed = items.some((item) => item.id.startsWith(prefix) && !item.dismissed && !currentIds.has(item.id))
    if (!changed && !newItems.length) return
    await db.localMetadata.put({ id: 'notificationCenter', value: [...newItems, ...items.map((item) => item.id.startsWith(prefix) && !currentIds.has(item.id) ? { ...item, dismissed: true } : item)] })
  })
}
