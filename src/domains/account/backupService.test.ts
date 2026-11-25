import { beforeEach, describe, expect, it, vi } from 'vitest'
import { prepareManualBackup, queueManualBackup, getBackupStatus } from './backupService'
import { nativeBackup, isNativeAccount } from './native'
import { createRemoteContractBackup, getLocalRevision } from '../../db/contractBackup'
import { encodePendingBackup } from './pendingBackup'

vi.mock('./native', () => ({ isNativeAccount: vi.fn(), nativeBackup: { prepareContext: vi.fn(), stage: vi.fn(), getPending: vi.fn(), retryPending: vi.fn(), getAutomaticState: vi.fn() } }))
vi.mock('../../db/contractBackup', () => ({ createRemoteContractBackup: vi.fn(), getLocalRevision: vi.fn().mockResolvedValue(8) }))
vi.mock('./pendingBackup', () => ({ encodePendingBackup: vi.fn() }))

const deviceId = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
const backupId = '8166d21c-bac3-497b-9d22-8492474c982b'
const context = { status: 'READY', owner: 'user_abc', deviceId, baseBackupId: null } as const

describe('manual backup', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(isNativeAccount).mockReturnValue(true)
    vi.mocked(getLocalRevision).mockResolvedValue(8)
    vi.mocked(nativeBackup.prepareContext).mockResolvedValue(context)
    vi.mocked(createRemoteContractBackup).mockResolvedValue({ manifest: '{}', manifestSha256: 'a'.repeat(64), binaries: [], revision: 8 })
    vi.mocked(encodePendingBackup).mockResolvedValue(new TextEncoder().encode('payload'))
    vi.mocked(nativeBackup.stage).mockResolvedValue({ status: 'STORED' })
    vi.mocked(nativeBackup.getPending).mockResolvedValue({ pending: false })
    vi.mocked(nativeBackup.getAutomaticState).mockResolvedValue({ owner: context.owner, preparedRevision: null, preparedDeviceId: null, confirmedRevision: null, confirmedBackupId: null, confirmedDeviceId: null, confirmedManifestSha256: null, equivalentRevision: null, equivalentBackupId: null, equivalentDeviceId: null })
    vi.mocked(nativeBackup.retryPending).mockResolvedValue({ status: 'QUEUED' })
  })
  it('only stages a user-requested snapshot and never claims that it was uploaded', async () => {
    const prepared = await prepareManualBackup()
    await queueManualBackup(prepared)
    expect(createRemoteContractBackup).toHaveBeenCalledWith({ healthConsent: false })
    expect(encodePendingBackup).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ deviceId, baseBackupId: null, healthConsent: false }))
    expect(nativeBackup.stage).toHaveBeenCalledWith(expect.objectContaining({ owner: 'user_abc', revision: 8, payload: 'payload', periodic: false }))
  })
  it('rejects unavailable or malformed native context and staging errors', async () => {
    vi.mocked(nativeBackup.prepareContext).mockResolvedValueOnce({ status: 'UNAVAILABLE' })
    await expect(prepareManualBackup()).rejects.toThrow()
    vi.mocked(nativeBackup.prepareContext).mockResolvedValueOnce({ ...context, baseBackupId: 'invalid' })
    await expect(prepareManualBackup()).rejects.toThrow()
    const prepared = await prepareManualBackup()
    vi.mocked(nativeBackup.stage).mockResolvedValueOnce({ status: 'OTHER_ACCOUNT' })
    await expect(queueManualBackup(prepared)).rejects.toThrow()
  })
  it('retains the server base for an explicit decision before replacing remote history', async () => {
    vi.mocked(nativeBackup.prepareContext).mockResolvedValueOnce({ ...context, baseBackupId: backupId })
    const prepared = await prepareManualBackup()
    expect(prepared.baseBackupId).toBe(backupId)
    expect(nativeBackup.stage).not.toHaveBeenCalled()
  })
  it('retries an existing pending copy instead of replacing it with another identifier', async () => {
    vi.mocked(nativeBackup.getPending).mockResolvedValue({ pending: true })
    await queueManualBackup(await prepareManualBackup())
    expect(nativeBackup.retryPending).toHaveBeenCalledWith({ owner: 'user_abc' })
    expect(createRemoteContractBackup).not.toHaveBeenCalled()
    expect(nativeBackup.stage).not.toHaveBeenCalled()
  })
  it('prepares newer changes when a manual backup is requested while an older copy is pending', async () => {
    vi.mocked(nativeBackup.getPending).mockResolvedValue({ pending: true })
    vi.mocked(nativeBackup.getAutomaticState).mockResolvedValue({ owner: context.owner, preparedRevision: 7, preparedDeviceId: deviceId, confirmedRevision: null, confirmedBackupId: null, confirmedDeviceId: null, confirmedManifestSha256: null, equivalentRevision: null, equivalentBackupId: null, equivalentDeviceId: null })
    await queueManualBackup(await prepareManualBackup())
    expect(nativeBackup.stage).toHaveBeenCalledWith(expect.objectContaining({ revision: 8, periodic: false }))
  })
  it('reports unchanged content when the latest confirmed copy has the same manifest', async () => {
    vi.mocked(nativeBackup.getAutomaticState).mockResolvedValue({ owner: context.owner, preparedRevision: null, preparedDeviceId: null, confirmedRevision: 3, confirmedBackupId: backupId, confirmedDeviceId: deviceId, confirmedManifestSha256: 'a'.repeat(64), equivalentRevision: null, equivalentBackupId: null, equivalentDeviceId: null })
    vi.mocked(nativeBackup.prepareContext).mockResolvedValue({ ...context, baseBackupId: backupId })
    expect(await queueManualBackup({ ...context, baseBackupId: backupId })).toBe('unchanged')
    expect(nativeBackup.stage).not.toHaveBeenCalled()
  })
  it('does not report unchanged if the remote latest copy changed', async () => {
    vi.mocked(nativeBackup.getAutomaticState).mockResolvedValue({ owner: context.owner, preparedRevision: null, preparedDeviceId: null, confirmedRevision: 3, confirmedBackupId: backupId, confirmedDeviceId: deviceId, confirmedManifestSha256: 'a'.repeat(64), equivalentRevision: null, equivalentBackupId: null, equivalentDeviceId: null })
    await expect(queueManualBackup({ ...context, baseBackupId: backupId })).rejects.toThrow()
    expect(nativeBackup.stage).not.toHaveBeenCalled()
  })
  it('reports server confirmation and a pending prepared copy without treating it as confirmed', async () => {
    vi.mocked(nativeBackup.prepareContext).mockResolvedValueOnce({ ...context, baseBackupId: backupId, summary: { id: backupId, deviceId, localRevision: 3, contractVersion: 1, sizeBytes: 1024, includesHealth: false, confirmedAt: '2026-11-23T12:00:00.000Z' } })
    vi.mocked(nativeBackup.getPending).mockResolvedValueOnce({ pending: true })
    const status = await getBackupStatus()
    expect(status.pending).toBe(true)
    expect(status.confirmed?.id).toBe(backupId)
    expect(status.confirmed?.localRevision).toBe(3)
  })
  it('keeps later local edits pending after the server confirms an older revision', async () => {
    const summary = { id: backupId, deviceId, localRevision: 3, contractVersion: 1, sizeBytes: 1024, includesHealth: false, confirmedAt: '2026-11-23T12:00:00.000Z' }
    vi.mocked(nativeBackup.prepareContext).mockResolvedValueOnce({ ...context, baseBackupId: backupId, summary })
    vi.mocked(nativeBackup.getAutomaticState).mockResolvedValueOnce({ owner: context.owner, preparedRevision: null, preparedDeviceId: null, confirmedRevision: 3, confirmedBackupId: backupId, confirmedDeviceId: deviceId, confirmedManifestSha256: 'a'.repeat(64), equivalentRevision: null, equivalentBackupId: null, equivalentDeviceId: null })
    expect((await getBackupStatus()).unpreparedChanges).toBe(true)
  })
})
