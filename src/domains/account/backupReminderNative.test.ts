import { beforeEach, expect, it, vi } from 'vitest'
import { consumeBackupReminder, scheduleBackupReminder } from './backupReminder'
import { isNativeAccount, nativeBackup } from './native'

vi.mock('./native', () => ({ isNativeAccount: vi.fn(), nativeBackup: { scheduleManualReminder: vi.fn(), consumeManualReminder: vi.fn() } }))
beforeEach(() => { vi.resetAllMocks() })
it('schedules only on Android and consumes the reminder navigation once', async () => {
  vi.mocked(isNativeAccount).mockReturnValue(false)
  await scheduleBackupReminder('2026-11-25')
  expect(nativeBackup.scheduleManualReminder).not.toHaveBeenCalled()
  expect(await consumeBackupReminder()).toBe(false)
  vi.mocked(isNativeAccount).mockReturnValue(true)
  vi.mocked(nativeBackup.consumeManualReminder).mockResolvedValue({ open: true })
  await scheduleBackupReminder('2026-11-25')
  expect(nativeBackup.scheduleManualReminder).toHaveBeenCalledWith({ date: '2026-11-25' })
  expect(await consumeBackupReminder()).toBe(true)
})
