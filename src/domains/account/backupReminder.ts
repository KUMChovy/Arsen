import { isNativeAccount, nativeBackup } from './native'

export function shouldRemindBackup(days: ReadonlyArray<{ id: string; order: number }>, selectedDayId: string | null, date: string, today: string): boolean {
  if (!selectedDayId || date !== today || !days.length) return false
  const last = [...days].sort((a, b) => a.order - b.order).at(-1)
  return last?.id === selectedDayId
}

export async function scheduleBackupReminder(date: string): Promise<void> {
  if (!isNativeAccount()) return
  await nativeBackup.scheduleManualReminder({ date })
}

export async function consumeBackupReminder(): Promise<boolean> {
  if (!isNativeAccount()) return false
  return (await nativeBackup.consumeManualReminder()).open === true
}
