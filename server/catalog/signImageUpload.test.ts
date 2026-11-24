import { beforeEach, describe, expect, it, vi } from 'vitest'
import { issueSignedToken, presignUrl } from '@vercel/blob'
import { createCatalogImageSigner } from './signImageUpload'

vi.mock('@vercel/blob', () => ({ issueSignedToken: vi.fn(), presignUrl: vi.fn() }))

describe('catalog image signing', () => {
  const origin = 'https://arsentest.public.blob.vercel-storage.com'
  const path = 'catalog/images/8166d21c-bac3-497b-9d22-8492474c982b.png'
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(issueSignedToken).mockResolvedValue({ delegationToken: 'delegation', clientSigningToken: 'signing', validUntil: Date.now() + 300_000 })
    vi.mocked(presignUrl).mockResolvedValue({ presignedUrl: 'https://signed.example.test/upload' })
  })
  it('scopes a public no-overwrite upload to the generated path, size, type and dedicated token', async () => {
    const sign = createCatalogImageSigner(origin, 'vercel_blob_rw_public_example')
    const result = await sign({ pathname: path, mimeType: 'image/png', sizeBytes: 64 })
    expect(result).toEqual({ uploadUrl: 'https://signed.example.test/upload', imageUrl: `${origin}/${path}` })
    expect(vi.mocked(issueSignedToken).mock.calls[0]![0]).toMatchObject({ token: 'vercel_blob_rw_public_example', pathname: path, operations: ['put'], allowedContentTypes: ['image/png'], maximumSizeInBytes: 64 })
    expect(vi.mocked(presignUrl).mock.calls[0]![1]).toMatchObject({ access: 'public', operation: 'put', pathname: path, allowOverwrite: false, addRandomSuffix: false })
  })
  it('rejects wrong origins, paths and file metadata before requesting a token', async () => {
    expect(() => createCatalogImageSigner('https://example.com', 'vercel_blob_rw_public_example')).toThrow()
    const sign = createCatalogImageSigner(origin, 'vercel_blob_rw_public_example')
    await expect(sign({ pathname: '../private', mimeType: 'image/png', sizeBytes: 1 })).rejects.toThrow()
    await expect(sign({ pathname: path, mimeType: 'image/jpeg', sizeBytes: 1 })).rejects.toThrow()
    await expect(sign({ pathname: path, mimeType: 'image/png', sizeBytes: 0 })).rejects.toThrow()
    expect(issueSignedToken).not.toHaveBeenCalled()
  })
})
