import { z } from 'zod'
import { createRemoteContractBackup } from '../../db/contractBackup'
import { isNativeAccount, nativeBackup } from './native'
import { encodePendingBackup } from './pendingBackup'

const contextSchema = z.object({ status: z.literal('READY'), owner: z.string().regex(/^user_[A-Za-z0-9]{1,123}$/), deviceId: z.string().uuid(), baseBackupId: z.string().uuid().nullable() })
type BackupContext = z.infer<typeof contextSchema>
const maxBytes = 16 * 1024 * 1024

export async function prepareManualBackup(): Promise<BackupContext> {
  if (!isNativeAccount()) throw new Error('El respaldo está disponible en Android')
  const result = contextSchema.safeParse(await nativeBackup.prepareContext())
  if (!result.success) throw new Error('No se pudo consultar la cuenta y el respaldo')
  return result.data
}

export async function queueManualBackup(context: BackupContext): Promise<void> {
  const checked = contextSchema.parse(context)
  const pending = await nativeBackup.getPending()
  if (pending.pending) {
    const retried = await nativeBackup.retryPending({ owner: checked.owner })
    if (retried.status !== 'QUEUED') throw new Error('No se pudo reintentar la copia pendiente')
    return
  }
  const snapshot = await createRemoteContractBackup({ healthConsent: false })
  const payload = await encodePendingBackup(snapshot, {
    backupId: crypto.randomUUID(), deviceId: checked.deviceId, baseBackupId: checked.baseBackupId,
    healthConsent: false, maxBytes,
  })
  const result = await nativeBackup.stage({ owner: checked.owner, revision: snapshot.revision, payload: new TextDecoder().decode(payload), periodic: false })
  if (result.status !== 'STORED') throw new Error('No se pudo preparar la copia')
}
