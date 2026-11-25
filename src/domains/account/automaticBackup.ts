import Dexie from 'dexie'
import { z } from 'zod'
import { db } from '../../db/schema'
import { createRemoteContractBackup, getLocalRevision } from '../../db/contractBackup'
import { isNativeAccount, nativeBackup } from './native'
import { encodePendingBackup } from './pendingBackup'
import { queueManualBackup } from './backupService'

const configSchema = z.object({ owner: z.string().regex(/^user_[A-Za-z0-9]{1,123}$/), deviceId: z.string().uuid(), baseBackupId: z.string().uuid().nullable() })
const savedConfigSchema = configSchema.extend({ baselineConfirmedId: z.string().uuid().nullable(), baselineEquivalentRevision: z.number().int().safe().nonnegative().nullable().optional(), equivalentRevision: z.number().int().safe().nonnegative().optional(), equivalentBackupId: z.string().uuid().optional() })
const revision = z.number().int().safe().nonnegative().nullable()
const stateSchema = z.object({ owner: z.string(), preparedRevision: revision, preparedDeviceId: z.string().uuid().nullable(), confirmedRevision: revision, confirmedBackupId: z.string().uuid().nullable(), confirmedDeviceId: z.string().uuid().nullable(), confirmedManifestSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(), equivalentRevision: revision, equivalentBackupId: z.string().uuid().nullable(), equivalentDeviceId: z.string().uuid().nullable() })
type PreparationState = 'idle' | 'preparing' | 'error'
let preparationState: PreparationState = 'idle'
let activePreparation: Promise<void> | null = null
let disabling = false
const observers = new Set<(state: PreparationState) => void>()
function reportPreparation(state: PreparationState) { preparationState = state; observers.forEach((observer) => observer(state)) }
export function observeAutomaticPreparation(observer: (state: PreparationState) => void): () => void {
  observers.add(observer); observer(preparationState)
  return () => { observers.delete(observer) }
}

export async function enableAutomaticBackup(context: z.infer<typeof configSchema>): Promise<'queued' | 'unchanged'> {
  const config = configSchema.parse(context)
  const state = stateSchema.parse(await nativeBackup.getAutomaticState())
  if (state.owner !== config.owner) throw new Error('La cuenta vinculada cambió')
  const result = await queueManualBackup({ ...config, status: 'READY' })
  if ((await nativeBackup.scheduleAutomatic({ owner: config.owner })).status !== 'SCHEDULED') throw new Error('No se pudo programar el respaldo')
  await db.localMetadata.put({ id: 'automaticBackup', value: { ...config, baselineConfirmedId: state.confirmedBackupId, baselineEquivalentRevision: state.equivalentRevision } })
  return result
}

export async function getAutomaticBackupConfig() {
  const record = await db.localMetadata.get('automaticBackup')
  return record?.id === 'automaticBackup' ? savedConfigSchema.parse(record.value) : null
}

export async function isAutomaticBackupEnabled(): Promise<boolean> {
  const config = await getAutomaticBackupConfig()
  if (!config || !isNativeAccount()) return false
  return stateSchema.parse(await nativeBackup.getAutomaticState()).owner === config.owner
}

export async function getAutomaticBackupSchedule() {
  const config = await getAutomaticBackupConfig()
  if (!config || !isNativeAccount()) return null
  return z.object({ state: z.enum(['ENQUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'BLOCKED', 'CANCELLED', 'NOT_SCHEDULED']), nextCheckAt: z.number().int().safe().positive().nullable() }).parse(await nativeBackup.getAutomaticSchedule({ owner: config.owner }))
}

export async function disableAutomaticBackup(): Promise<void> {
  disabling = true
  try {
    await activePreparation?.catch(() => undefined)
    const config = await getAutomaticBackupConfig()
    if (!config) return
    if ((await nativeBackup.cancelAutomatic({ owner: config.owner })).status !== 'CANCELLED') throw new Error('No se pudo detener el respaldo automático')
    await db.localMetadata.delete('automaticBackup')
  } finally { disabling = false }
}

export function prepareAutomaticBackup(): Promise<void> {
  if (disabling) return Promise.resolve()
  if (activePreparation) return activePreparation
  activePreparation = prepareAutomaticBackupOnce().finally(() => { activePreparation = null })
  return activePreparation
}

async function prepareAutomaticBackupOnce(): Promise<void> {
  if (!isNativeAccount()) return
  const config = await getAutomaticBackupConfig()
  if (!config) return
  const state = stateSchema.parse(await nativeBackup.getAutomaticState())
  if (state.owner !== config.owner) throw new Error('La cuenta vinculada cambió')
  if ((state.preparedRevision === null) !== (state.preparedDeviceId === null) || (state.preparedDeviceId !== null && state.preparedDeviceId !== config.deviceId)) throw new Error('Cambió el dispositivo de la copia preparada')
  if ((state.equivalentRevision === null) !== (state.equivalentBackupId === null) || (state.equivalentRevision === null) !== (state.equivalentDeviceId === null) || (state.equivalentDeviceId !== null && state.equivalentDeviceId !== config.deviceId)) throw new Error('Estado de equivalencia incompatible')
  if ((state.confirmedBackupId === null) !== (state.confirmedRevision === null) || (state.confirmedBackupId === null) !== (state.confirmedDeviceId === null) || (state.confirmedBackupId === null) !== (state.confirmedManifestSha256 === null)) throw new Error('Estado de confirmación incompleto')
  if (state.confirmedDeviceId !== null && state.confirmedDeviceId !== config.deviceId) throw new Error('Cambió el dispositivo de respaldo')
  if ((await nativeBackup.scheduleAutomatic({ owner: config.owner })).status !== 'SCHEDULED') throw new Error('No se pudo programar el respaldo')
  const confirmedIsTrusted = state.confirmedBackupId !== null && (state.confirmedBackupId === config.baseBackupId || state.confirmedBackupId !== config.baselineConfirmedId)
  const equivalentIsTrusted = state.equivalentBackupId !== null && (state.equivalentBackupId === config.baseBackupId || (state.equivalentRevision ?? -1) > (config.baselineEquivalentRevision ?? -1))
  const covered = Math.max(state.preparedRevision ?? -1, confirmedIsTrusted ? state.confirmedRevision ?? -1 : -1, equivalentIsTrusted ? state.equivalentRevision ?? -1 : -1, confirmedIsTrusted && config.equivalentBackupId === state.confirmedBackupId ? config.equivalentRevision ?? -1 : -1)
  if (await getLocalRevision() <= covered) return
  const snapshot = await createRemoteContractBackup({ healthConsent: false })
  if (snapshot.revision <= covered) return
  if (state.preparedRevision === null && confirmedIsTrusted && snapshot.manifestSha256 === state.confirmedManifestSha256) {
    const remote = configSchema.extend({ status: z.literal('READY') }).parse(await nativeBackup.prepareContext())
    if (remote.owner !== config.owner || remote.deviceId !== config.deviceId || remote.baseBackupId !== state.confirmedBackupId) throw new Error('La copia remota cambió')
    await db.localMetadata.put({ id: 'automaticBackup', value: { ...config, equivalentRevision: snapshot.revision, equivalentBackupId: state.confirmedBackupId! } })
    return
  }
  const payload = await encodePendingBackup(snapshot, {
    backupId: crypto.randomUUID(), deviceId: config.deviceId, baseBackupId: equivalentIsTrusted && (state.equivalentRevision ?? -1) >= (confirmedIsTrusted ? state.confirmedRevision ?? -1 : -1) ? state.equivalentBackupId : confirmedIsTrusted ? state.confirmedBackupId : config.baseBackupId,
    healthConsent: false, maxBytes: 16 * 1024 * 1024,
  })
  const result = await nativeBackup.stage({ owner: config.owner, revision: snapshot.revision, payload: new TextDecoder().decode(payload), periodic: true })
  if (result.status !== 'STORED') throw new Error('No se pudo preparar la copia automática')
}

export function watchAutomaticBackup(): () => void {
  if (!isNativeAccount()) return () => undefined
  let stopped = false
  let running = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const schedule = () => {
    if (stopped) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      if (stopped) return
      if (running) { schedule(); return }
      running = true
      reportPreparation('preparing')
      void prepareAutomaticBackup().then(() => reportPreparation('idle')).catch(() => reportPreparation('error')).finally(() => { running = false })
    }, 5000)
  }
  Dexie.on('storagemutated', schedule)
  window.addEventListener('online', schedule)
  document.addEventListener('visibilitychange', schedule)
  const retry = setInterval(schedule, 5 * 60 * 1000)
  schedule()
  return () => { stopped = true; if (timer) clearTimeout(timer); clearInterval(retry); Dexie.on.storagemutated.unsubscribe(schedule); window.removeEventListener('online', schedule); document.removeEventListener('visibilitychange', schedule) }
}
