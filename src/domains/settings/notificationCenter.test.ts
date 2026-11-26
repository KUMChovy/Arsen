import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../db/schema'
import { addNotice, dismissNotice, getNotices, getNoticeCenterEnabled, pruneNoticeHistory, setNoticeCenterEnabled, syncNotices } from './notificationCenter'

describe('local notification center', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open() })
  afterEach(async () => { db.close(); await db.delete() })
  it('deduplicates notices and retains dismissed history', async () => {
    const notice = { id: 'pending:test', title: 'Sesión pendiente', body: 'Continúa tu sesión.' }
    await addNotice(notice)
    await dismissNotice(notice.id)
    await addNotice(notice)
    const stored = await getNotices()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ ...notice, dismissed: true })
  })
  it('keeps distinct notices independently dismissible', async () => {
    await addNotice({ id: 'a', title: 'A', body: 'Uno' })
    await addNotice({ id: 'b', title: 'B', body: 'Dos' })
    await dismissNotice('a')
    expect((await getNotices()).find((item) => item.id === 'a')?.dismissed).toBe(true)
    expect((await getNotices()).find((item) => item.id === 'b')?.dismissed).toBe(false)
  })
  it('archives resolved notices while preserving dismissed history', async () => {
    await syncNotices('pending:', [{ id: 'pending:a', title: 'Pendiente', body: 'Sesión' }])
    await syncNotices('pending:', [])
    expect((await getNotices())[0]).toMatchObject({ id: 'pending:a', dismissed: true })
  })
  it('removes dismissed notices before this local week but preserves older active alerts', async () => {
    const now = new Date(2026, 10, 25, 12)
    const item = (id: string, date: Date, dismissed: boolean) => ({ id, title: id, body: '', createdAt: date.toISOString(), dismissed })
    await db.localMetadata.put({ id: 'notificationCenter', value: [item('old', new Date(2026, 10, 22, 23, 59), true), item('current', new Date(2026, 10, 23, 0, 0), true), item('active', new Date(2026, 10, 1), false)] })
    await pruneNoticeHistory(now)
    expect((await getNotices()).map((notice) => notice.id)).toEqual(['current', 'active'])
  })
  it('stores the display preference without deleting active or past notices', async () => {
    await addNotice({ id: 'a', title: 'A', body: 'B' })
    expect(await getNoticeCenterEnabled()).toBe(true)
    await setNoticeCenterEnabled(false)
    expect(await getNoticeCenterEnabled()).toBe(false)
    expect(await getNotices()).toHaveLength(1)
  })
})
