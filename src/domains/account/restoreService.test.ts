import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyRestorePreview, prepareRestorePreview } from './restoreService'
import { nativeBackup, isNativeAccount } from './native'
import { getLocalRevision, restoreRemoteContractBackup } from '../../db/contractBackup'

vi.mock('./native', () => ({ isNativeAccount: vi.fn(), nativeBackup: { prepareContext: vi.fn(), getPending: vi.fn(), download: vi.fn() } }))
vi.mock('../../db/contractBackup', () => ({ getLocalRevision: vi.fn(), restoreRemoteContractBackup: vi.fn() }))

const id = '8166d21c-bac3-497b-9d22-8492474c982b'
const deviceId = '67c5f68b-13e4-48e7-9a64-2dc6dc68d905'
const context = { status: 'READY', owner: 'user_abc', deviceId, baseBackupId: id, summary: { id, deviceId, localRevision: 3, contractVersion: 1, sizeBytes: 5, includesHealth: false, confirmedAt: '2026-11-23T12:00:00.000Z' } }

describe('restore preview', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(isNativeAccount).mockReturnValue(true)
    vi.mocked(nativeBackup.prepareContext).mockResolvedValue(context)
    vi.mocked(nativeBackup.getPending).mockResolvedValue({ pending: false })
    vi.mocked(nativeBackup.download).mockResolvedValue({ manifest: '{}', manifestSha256: 'a'.repeat(64), binaries: [{ id: 'image', base64: 'AQID' }] })
    vi.mocked(getLocalRevision).mockResolvedValue(7)
    vi.mocked(restoreRemoteContractBackup).mockResolvedValue(undefined)
  })
  it('downloads a preview without changing local data, then applies only after confirmation', async () => {
    const preview = await prepareRestorePreview()
    expect(restoreRemoteContractBackup).not.toHaveBeenCalled()
    expect(preview.summary.sizeBytes).toBe(5)
    await applyRestorePreview(preview)
    expect(restoreRemoteContractBackup).toHaveBeenCalledWith(expect.objectContaining({ revision: 3, binaries: [{ id: 'image', bytes: Uint8Array.of(1, 2, 3) }] }), 7)
  })
  it('refuses restoration while a backup is pending or the selected remote version changes', async () => {
    vi.mocked(nativeBackup.getPending).mockResolvedValueOnce({ pending: true })
    await expect(prepareRestorePreview()).rejects.toThrow(/pendiente/i)
    const preview = await prepareRestorePreview()
    vi.mocked(nativeBackup.prepareContext).mockResolvedValueOnce({ ...context, owner: 'user_other' })
    await expect(applyRestorePreview(preview)).rejects.toThrow()
    expect(restoreRemoteContractBackup).not.toHaveBeenCalled()
  })
  it('rejects incomplete or incompatible downloads', async () => {
    vi.mocked(nativeBackup.download).mockResolvedValueOnce({ manifest: '{}', manifestSha256: 'a'.repeat(64), binaries: [{ id: 'image', base64: 'AQI=' }] })
    await expect(prepareRestorePreview()).rejects.toThrow()
    vi.mocked(nativeBackup.prepareContext).mockResolvedValueOnce({ ...context, summary: { ...context.summary, contractVersion: 2 } })
    await expect(prepareRestorePreview()).rejects.toThrow()
  })
})
