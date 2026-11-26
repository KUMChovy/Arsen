import { describe, expect, it } from 'vitest'
import { shouldRemindBackup } from './backupReminder'

describe('recordatorio de respaldo', () => {
  const days = [{ id: 'b', order: 2 }, { id: 'a', order: 0 }, { id: 'c', order: 1 }]
  it('recognizes the last day by routine order, independent of weekday', () => {
    expect(shouldRemindBackup(days, 'b', '2026-11-25', '2026-11-25')).toBe(true)
    expect(shouldRemindBackup(days, 'b', '2026-11-28', '2026-11-28')).toBe(true)
    expect(shouldRemindBackup(days, 'a', '2026-11-25', '2026-11-25')).toBe(false)
  })
  it('ignores historic selections, missing days and empty routines', () => {
    expect(shouldRemindBackup(days, 'b', '2026-11-24', '2026-11-25')).toBe(false)
    expect(shouldRemindBackup([], 'b', '2026-11-25', '2026-11-25')).toBe(false)
    expect(shouldRemindBackup(days, null, '2026-11-25', '2026-11-25')).toBe(false)
  })
})
