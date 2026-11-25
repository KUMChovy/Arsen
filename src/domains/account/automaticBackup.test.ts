import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareAutomaticBackup, watchAutomaticBackup, enableAutomaticBackup, disableAutomaticBackup } from './automaticBackup'
import Dexie from 'dexie'
import { db } from '../../db/schema'
import { createRemoteContractBackup, getLocalRevision } from '../../db/contractBackup'
import { nativeBackup, isNativeAccount } from './native'
import { encodePendingBackup } from './pendingBackup'
import { queueManualBackup } from './backupService'

vi.mock('../../db/schema', () => ({ db: { localMetadata: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } } }))
vi.mock('../../db/contractBackup', () => ({ createRemoteContractBackup: vi.fn(), getLocalRevision: vi.fn() }))
vi.mock('./native', () => ({ isNativeAccount: vi.fn(), nativeBackup: { getAutomaticState: vi.fn(), prepareContext: vi.fn(), stage: vi.fn(), scheduleAutomatic: vi.fn(), cancelAutomatic: vi.fn() } }))
vi.mock('./pendingBackup', () => ({ encodePendingBackup: vi.fn() }))
vi.mock('./backupService', () => ({ queueManualBackup: vi.fn() }))

const config = { owner: 'user_abc', deviceId: '67c5f68b-13e4-48e7-9a64-2dc6dc68d905', baseBackupId: null, baselineConfirmedId: null, baselineEquivalentRevision: null }
const state = { owner: config.owner, preparedRevision: null, preparedDeviceId: null, confirmedRevision: null, confirmedBackupId: null, confirmedDeviceId: null, confirmedManifestSha256: null, equivalentRevision: null, equivalentBackupId: null, equivalentDeviceId: null }

describe('automatic preparation', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(isNativeAccount).mockReturnValue(true)
    vi.mocked(db.localMetadata.get).mockResolvedValue({ id: 'automaticBackup', value: config })
    vi.mocked(nativeBackup.getAutomaticState).mockResolvedValue(state)
    vi.mocked(nativeBackup.prepareContext).mockResolvedValue({ status: 'READY', ...config })
    vi.mocked(getLocalRevision).mockResolvedValue(8)
    vi.mocked(createRemoteContractBackup).mockResolvedValue({ revision: 8, manifest: '{}', manifestSha256: 'a'.repeat(64), binaries: [] })
    vi.mocked(encodePendingBackup).mockResolvedValue(new TextEncoder().encode('payload'))
    vi.mocked(nativeBackup.stage).mockResolvedValue({ status: 'STORED' })
    vi.mocked(nativeBackup.scheduleAutomatic).mockResolvedValue({ status: 'SCHEDULED' })
    vi.mocked(nativeBackup.cancelAutomatic).mockResolvedValue({ status: 'CANCELLED' })
    vi.mocked(db.localMetadata.put).mockResolvedValue('automaticBackup')
    vi.mocked(queueManualBackup).mockResolvedValue('queued')
  })
  it('stages changed data for periodic work without requesting immediate upload', async () => {
    await prepareAutomaticBackup()
    expect(nativeBackup.stage).toHaveBeenCalledWith(expect.objectContaining({ owner: config.owner, revision: 8, periodic: true }))
    expect(createRemoteContractBackup).toHaveBeenCalledWith({ healthConsent: false })
  })
  it('does not create identical snapshots or stage a different account', async () => {
    vi.mocked(nativeBackup.getAutomaticState).mockResolvedValueOnce({ ...state, preparedRevision: 8, preparedDeviceId: config.deviceId })
    await prepareAutomaticBackup()
    vi.mocked(nativeBackup.getAutomaticState).mockResolvedValueOnce({ ...state, owner: 'user_other' })
    await expect(prepareAutomaticBackup()).rejects.toThrow()
    expect(nativeBackup.stage).not.toHaveBeenCalled()
  })
  it('does not enable automatic backups when the account changes or the first backup fails', async () => {
    vi.mocked(nativeBackup.getAutomaticState).mockResolvedValueOnce({ ...state, owner: 'user_other' })
    await expect(enableAutomaticBackup(config)).rejects.toThrow()
    vi.mocked(queueManualBackup).mockRejectedValueOnce(new Error('offline'))
    await expect(enableAutomaticBackup(config)).rejects.toThrow()
    expect(db.localMetadata.put).not.toHaveBeenCalled()
  })
  it('persists permission only after the user-requested first copy was queued', async () => {
    await enableAutomaticBackup(config)
    expect(queueManualBackup).toHaveBeenCalledWith(expect.objectContaining({ owner: config.owner }))
    expect(db.localMetadata.put).toHaveBeenCalledWith({ id: 'automaticBackup', value: config })
    expect(nativeBackup.scheduleAutomatic).toHaveBeenCalledWith({ owner: config.owner })
  })
  it('does not remove authorization when cancelling periodic work fails', async () => {
    vi.mocked(nativeBackup.cancelAutomatic).mockRejectedValueOnce(new Error('unavailable'))
    await expect(disableAutomaticBackup()).rejects.toThrow()
    expect(db.localMetadata.delete).not.toHaveBeenCalled()
  })
  it('waits for an in-progress preparation before cancelling automatic work', async () => {
    let release!: () => void
    vi.mocked(nativeBackup.stage).mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ status: 'STORED' }) }))
    const preparing = prepareAutomaticBackup()
    await vi.waitFor(() => expect(nativeBackup.stage).toHaveBeenCalled())
    const disabling = disableAutomaticBackup()
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(nativeBackup.cancelAutomatic).not.toHaveBeenCalled()
    release()
    await preparing; await disabling
    expect(nativeBackup.cancelAutomatic).toHaveBeenCalledWith({ owner: config.owner })
    expect(db.localMetadata.delete).toHaveBeenCalledWith('automaticBackup')
  })
  it('leaves later edits pending rather than inventing a confirmation', async () => {
    vi.mocked(createRemoteContractBackup).mockResolvedValueOnce({ revision: 7, manifest: '{}', manifestSha256: 'a'.repeat(64), binaries: [] })
    await prepareAutomaticBackup()
    expect(nativeBackup.stage).toHaveBeenCalledWith(expect.objectContaining({ revision: 7 }))
  })
  it('does not use a previously confirmed copy from before explicit activation as the new base', async () => {
    const oldId = '0d788ece-c86a-4af8-9c99-38efb1662f0a'
    const remoteId = '8166d21c-bac3-497b-9d22-8492474c982b'
    vi.mocked(db.localMetadata.get).mockResolvedValueOnce({ id: 'automaticBackup', value: { ...config, baseBackupId: remoteId, baselineConfirmedId: oldId } })
    vi.mocked(nativeBackup.getAutomaticState).mockResolvedValueOnce({ ...state, confirmedRevision: 20, confirmedBackupId: oldId, confirmedDeviceId: config.deviceId, confirmedManifestSha256: 'b'.repeat(64) })
    await prepareAutomaticBackup()
    expect(encodePendingBackup).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ baseBackupId: remoteId }))
  })
  it('does not upload unchanged content after verifying that its confirmed copy is still latest', async () => {
    const id = '8166d21c-bac3-497b-9d22-8492474c982b'
    vi.mocked(db.localMetadata.get).mockResolvedValueOnce({ id: 'automaticBackup', value: { ...config, baseBackupId: id, baselineConfirmedId: id } })
    vi.mocked(nativeBackup.getAutomaticState).mockResolvedValueOnce({ ...state, confirmedRevision: 3, confirmedBackupId: id, confirmedDeviceId: config.deviceId, confirmedManifestSha256: 'a'.repeat(64) })
    vi.mocked(nativeBackup.prepareContext).mockResolvedValueOnce({ status: 'READY', ...config, baseBackupId: id })
    await prepareAutomaticBackup()
    expect(nativeBackup.stage).not.toHaveBeenCalled()
    expect(db.localMetadata.put).toHaveBeenCalledWith(expect.objectContaining({ value: expect.objectContaining({ equivalentRevision: 8, equivalentBackupId: id }) }))
  })
  it('does not treat identical local content as current when a different remote version is latest', async () => {
    const id = '8166d21c-bac3-497b-9d22-8492474c982b'
    vi.mocked(db.localMetadata.get).mockResolvedValueOnce({ id: 'automaticBackup', value: { ...config, baseBackupId: id, baselineConfirmedId: id } })
    vi.mocked(nativeBackup.getAutomaticState).mockResolvedValueOnce({ ...state, confirmedRevision: 3, confirmedBackupId: id, confirmedDeviceId: config.deviceId, confirmedManifestSha256: 'a'.repeat(64) })
    await expect(prepareAutomaticBackup()).rejects.toThrow(/remota cambió/i)
    expect(nativeBackup.stage).not.toHaveBeenCalled()
    expect(db.localMetadata.put).not.toHaveBeenCalled()
  })
  it('uses a newly reconfirmed equivalent version as the base for later edits', async () => {
    const id = '8166d21c-bac3-497b-9d22-8492474c982b'
    vi.mocked(nativeBackup.getAutomaticState).mockResolvedValueOnce({ ...state, equivalentRevision: 7, equivalentBackupId: id, equivalentDeviceId: config.deviceId })
    await prepareAutomaticBackup()
    expect(encodePendingBackup).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ baseBackupId: id }))
    expect(nativeBackup.stage).toHaveBeenCalledWith(expect.objectContaining({ revision: 8 }))
  })
  it('observes subsequent database writes while the app remains open', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('window', new EventTarget())
    vi.stubGlobal('document', new EventTarget())
    try {
      const stop = watchAutomaticBackup()
      await vi.advanceTimersByTimeAsync(5000)
      expect(nativeBackup.stage).toHaveBeenCalledTimes(1)
      vi.mocked(getLocalRevision).mockResolvedValue(9)
      vi.mocked(createRemoteContractBackup).mockResolvedValue({ revision: 9, manifest: '{}', manifestSha256: 'a'.repeat(64), binaries: [] })
      Dexie.on.storagemutated.fire({})
      await vi.advanceTimersByTimeAsync(5000)
      expect(nativeBackup.stage).toHaveBeenCalledTimes(2)
      expect(nativeBackup.stage).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 9 }))
      stop()
    } finally { vi.useRealTimers(); vi.unstubAllGlobals() }
  })
})
