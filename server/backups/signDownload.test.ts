import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { issueSignedToken, presignUrl } from '@vercel/blob'
import { signPrivateBackupDownload } from './signDownload'

vi.mock('@vercel/blob', () => ({ issueSignedToken: vi.fn(), presignUrl: vi.fn() }))

describe('private backup download signing', () => {
  beforeEach(() => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'private-test-token')
    vi.resetAllMocks()
    vi.mocked(issueSignedToken).mockResolvedValue({ delegationToken: 'delegation', clientSigningToken: 'signing', validUntil: Date.now() + 120_000 })
    vi.mocked(presignUrl).mockResolvedValue({ presignedUrl: 'https://storage.example.test/download' })
  })
  afterEach(() => vi.unstubAllEnvs())
  it('issues only a short-lived private GET URL with a derived path', async () => {
    const result = await signPrivateBackupDownload({ userId: 'user-a', backupId: '8166d21c-bac3-497b-9d22-8492474c982b', kind: 'asset', assetId: '../outside' })
    expect(result).toBe('https://storage.example.test/download')
    const delegation = vi.mocked(issueSignedToken).mock.calls[0]![0]
    expect(delegation).toMatchObject({ token: 'private-test-token', operations: ['get'] })
    expect(delegation.pathname).not.toContain('..')
    expect(delegation.validUntil! - Date.now()).toBeLessThanOrEqual(120_000)
    expect(vi.mocked(presignUrl).mock.calls[0]![1]).toMatchObject({ pathname: delegation.pathname, operation: 'get', access: 'private', useCache: false })
  })
})
