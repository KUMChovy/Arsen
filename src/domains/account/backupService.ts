import { z } from 'zod'
import { createRemoteContractBackup, getLocalRevision } from '../../db/contractBackup'
import { db } from '../../db/schema'
import { isNativeAccount, nativeBackup } from './native'
import { encodePendingBackup } from './pendingBackup'
import { summarySchema } from './restoreService'

const contextSchema = z.object({ status: z.literal('READY'), owner: z.string().regex(/^user_[A-Za-z0-9]{1,123}$/), deviceId: z.string().uuid(), baseBackupId: z.string().uuid().nullable() })
type BackupContext = z.infer<typeof contextSchema>
const maxBytes = 16 * 1024 * 1024

export async function getBackupStatus() {
  if (!isNativeAccount()) throw new Error('El respaldo está disponible en Android')
  const [raw, pending, localRevision, rawLocal, configRecord] = await Promise.all([nativeBackup.prepareContext(), nativeBackup.getPending(), getLocalRevision(), nativeBackup.getAutomaticState().catch(() => null), db.localMetadata.get('automaticBackup').catch(() => undefined)])
  const context = contextSchema.extend({ summary: summarySchema.optional() }).parse(raw)
  if ((context.summary?.id ?? null) !== context.baseBackupId) throw new Error('El estado del respaldo no coincide')
  const state = z.object({ owner: z.string(), preparedRevision: z.number().int().safe().nonnegative().nullable(), preparedDeviceId: z.string().uuid().nullable(), confirmedRevision: z.number().int().safe().nonnegative().nullable(), confirmedBackupId: z.string().uuid().nullable(), confirmedDeviceId: z.string().uuid().nullable(), equivalentRevision: z.number().int().safe().nonnegative().nullable(), equivalentBackupId: z.string().uuid().nullable(), equivalentDeviceId: z.string().uuid().nullable() }).safeParse(rawLocal)
  let unpreparedChanges: boolean | null = null
  if (state.success && state.data.owner === context.owner && (state.data.preparedDeviceId === null || state.data.preparedDeviceId === context.deviceId)) {
    const local = state.data
    const confirmed = local.confirmedBackupId === context.baseBackupId && local.confirmedDeviceId === context.deviceId ? local.confirmedRevision : null
    const equivalent = configRecord?.id === 'automaticBackup' && configRecord.value.owner === context.owner && configRecord.value.deviceId === context.deviceId && configRecord.value.equivalentBackupId === context.baseBackupId && Number.isSafeInteger(configRecord.value.equivalentRevision) && (configRecord.value.equivalentRevision ?? -1) >= 0 ? configRecord.value.equivalentRevision ?? -1 : -1
    const nativeEquivalent = local.equivalentBackupId === context.baseBackupId && local.equivalentDeviceId === context.deviceId ? local.equivalentRevision : null
    const knownRevision = Math.max(local.preparedRevision ?? -1, confirmed ?? -1, equivalent, nativeEquivalent ?? -1)
    if (knownRevision >= 0) unpreparedChanges = localRevision > knownRevision
    else if (context.baseBackupId === null) unpreparedChanges = true
  }
  return { owner: context.owner, localRevision, pending: pending.pending, confirmed: context.summary ?? null, unpreparedChanges }
}

export async function requestBackupNotifications(): Promise<boolean> {
  if (!isNativeAccount()) return false
  return (await nativeBackup.requestBackupNotifications()).enabled === true
}

export async function prepareManualBackup(): Promise<BackupContext> {
  if (!isNativeAccount()) throw new Error('El respaldo está disponible en Android')
  const result = contextSchema.safeParse(await nativeBackup.prepareContext())
  if (!result.success) throw new Error('No se pudo consultar la cuenta y el respaldo')
  return result.data
}

export async function queueManualBackup(context: BackupContext): Promise<'queued' | 'unchanged'> {
  const checked = contextSchema.parse(context)
  const pending = await nativeBackup.getPending()
  if (pending.pending) {
    const state = await nativeBackup.getAutomaticState()
    if (state.owner !== checked.owner || (state.preparedDeviceId !== null && state.preparedDeviceId !== checked.deviceId)) throw new Error('La cuenta o el dispositivo cambiaron')
    if (state.preparedRevision === null || await getLocalRevision() <= state.preparedRevision) {
      const retried = await nativeBackup.retryPending({ owner: checked.owner })
      if (retried.status !== 'QUEUED') throw new Error('No se pudo reintentar la copia pendiente')
      return 'queued'
    }
  }
  const snapshot = await createRemoteContractBackup({ healthConsent: false })
  if (!pending.pending) {
    const state = await nativeBackup.getAutomaticState()
    if (state.owner !== checked.owner) throw new Error('La cuenta cambió')
    if (state.confirmedBackupId === checked.baseBackupId && checked.baseBackupId !== null && state.confirmedDeviceId === checked.deviceId && state.confirmedManifestSha256 === snapshot.manifestSha256) {
      const current = contextSchema.parse(await nativeBackup.prepareContext())
      if (current.owner !== checked.owner || current.deviceId !== checked.deviceId || current.baseBackupId !== checked.baseBackupId) throw new Error('La cuenta o la copia remota cambió')
      return 'unchanged'
    }
  }
  const payload = await encodePendingBackup(snapshot, {
    backupId: crypto.randomUUID(), deviceId: checked.deviceId, baseBackupId: checked.baseBackupId,
    healthConsent: false, maxBytes,
  })
  const result = await nativeBackup.stage({ owner: checked.owner, revision: snapshot.revision, payload: new TextDecoder().decode(payload), periodic: false })
  if (result.status !== 'STORED') throw new Error('No se pudo preparar la copia')
  return 'queued'
}
