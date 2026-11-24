import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { issueSignedToken, presignUrl } from '@vercel/blob'
import { signPrivateBackupUpload } from './signUpload'

vi.mock('@vercel/blob', () => ({ issueSignedToken: vi.fn(), presignUrl: vi.fn() }))

describe('private backup upload signing', () => {
  const backupId = '8166d21c-bac3-497b-9d22-8492474c982b'
  beforeEach(() => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'private-test-token')
    vi.resetAllMocks()
    vi.mocked(issueSignedToken).mockResolvedValue({ delegationToken: 'delegation', clientSigningToken: 'signing', validUntil: Date.now() + 300_000 })
    vi.mocked(presignUrl).mockResolvedValue({ presignedUrl: 'https://storage.example.test/upload' })
  })
  afterEach(() => vi.unstubAllEnvs())
  it('restricts upload to one derived private path, size, content type and no overwrites', async () => {
    const url = await signPrivateBackupUpload({ userId: 'user-a', backupId, kind: 'manifest', maxBytes: 1000, serverLimitBytes: 2000 })
    expect(url).toBe('https://storage.example.test/upload')
    const delegation = vi.mocked(issueSignedToken).mock.calls[0]![0]
    const options = vi.mocked(presignUrl).mock.calls[0]![1]
    expect(delegation).toMatchObject({ token: 'private-test-token', operations: ['put'], maximumSizeInBytes: 1000, allowedContentTypes: ['application/json'] })
    expect(options).toMatchObject({ access: 'private', operation: 'put', pathname: delegation.pathname, maximumSizeInBytes: 1000, allowOverwrite: false, addRandomSuffix: false })
    expect(options.pathname).not.toContain('user-a')
    expect(delegation.validUntil! - Date.now()).toBeLessThanOrEqual(300_000)
  })
  it('rejects invalid sizes and missing asset identifiers before calling storage', async () => {
    await expect(signPrivateBackupUpload({ userId: 'user-a', backupId, kind: 'asset', maxBytes: 2001, serverLimitBytes: 2000 })).rejects.toThrow()
    await expect(signPrivateBackupUpload({ userId: 'user-a', backupId, kind: 'asset', maxBytes: 1, serverLimitBytes: 2000 })).rejects.toThrow()
    expect(issueSignedToken).not.toHaveBeenCalled()
  })
  it('does not fall back to an OIDC store when the private token is missing', async () => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', '')
    await expect(signPrivateBackupUpload({ userId: 'user-a', backupId, kind: 'manifest', maxBytes: 1, serverLimitBytes: 2000 })).rejects.toThrow()
    expect(issueSignedToken).not.toHaveBeenCalled()
  })
  it('signs a binary component under a derived asset path', async () => {
    await signPrivateBackupUpload({ userId: 'user-a', backupId, kind: 'asset', assetId: '../outside', maxBytes: 10, serverLimitBytes: 2000 })
    const delegation = vi.mocked(issueSignedToken).mock.calls[0]![0]
    expect(delegation.allowedContentTypes).toEqual(['application/octet-stream'])
    expect(delegation.pathname).toContain('/assets/')
    expect(delegation.pathname).not.toContain('..')
  })
})
