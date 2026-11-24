import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { del, list } from '@vercel/blob'
import { createVercelCleanup } from './vercelCleanup'

vi.mock('@vercel/blob', () => ({ del: vi.fn(), list: vi.fn() }))

describe('Vercel cleanup adapter', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'private-test-token') })
  afterEach(() => vi.unstubAllEnvs())
  it('lists a bounded prefix and removes only the requested paths', async () => {
    vi.mocked(list).mockResolvedValue({ blobs: [{ pathname: 'backups/safe/file' }], hasMore: false } as never)
    vi.mocked(del).mockResolvedValue(undefined)
    const cleanup = createVercelCleanup()
    expect(await cleanup.list('backups/safe/', 100)).toEqual(['backups/safe/file'])
    expect(vi.mocked(list).mock.calls[0]?.[0]).toMatchObject({ token: 'private-test-token', prefix: 'backups/safe/', limit: 100, mode: 'expanded' })
    await cleanup.remove(['backups/safe/file'])
    expect(vi.mocked(del).mock.calls[0]?.[0]).toEqual(['backups/safe/file'])
    expect(vi.mocked(del).mock.calls[0]?.[1]).toMatchObject({ token: 'private-test-token' })
  })
  it('does not claim an empty prefix when a further page is reported', async () => {
    vi.mocked(list).mockResolvedValue({ blobs: [], hasMore: true } as never)
    await expect(createVercelCleanup().list('backups/safe/', 100)).rejects.toThrow()
  })
})
