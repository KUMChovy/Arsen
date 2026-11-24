import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { get } from '@vercel/blob'
import { createVercelBackupReader } from './vercelBlobReader'

vi.mock('@vercel/blob', () => ({ get: vi.fn() }))

describe('Vercel private object adapter', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'private-test-token') })
  afterEach(() => vi.unstubAllEnvs())
  it('reads only from the private store without the CDN cache', async () => {
    vi.mocked(get).mockImplementation(async (pathname) => ({ statusCode: 200, blob: { pathname, size: 1 }, stream: new ReadableStream({ start(controller) { controller.enqueue(Uint8Array.of(7)); controller.close() } }) }) as never)
    const reader = createVercelBackupReader('user-a', '8166d21c-bac3-497b-9d22-8492474c982b')
    expect(await reader('manifest', undefined, 1)).toEqual(Uint8Array.of(7))
    expect(vi.mocked(get).mock.calls[0]?.[1]).toEqual({ token: 'private-test-token', access: 'private', useCache: false })
  })
  it('rejects an object returned under a different pathname', async () => {
    vi.mocked(get).mockResolvedValue({ statusCode: 200, blob: { pathname: 'wrong', size: 0 }, stream: new ReadableStream() } as never)
    const reader = createVercelBackupReader('user-a', '8166d21c-bac3-497b-9d22-8492474c982b')
    await expect(reader('manifest', undefined, 1)).rejects.toThrow()
  })
  it('handles the SDK reporting zero when a compressed response has no content length', async () => {
    vi.mocked(get).mockImplementation(async (pathname) => ({ statusCode: 200, blob: { pathname, size: 0 }, stream: new ReadableStream({ start(controller) { controller.enqueue(Uint8Array.of(7)); controller.close() } }) }) as never)
    const reader = createVercelBackupReader('user-a', '8166d21c-bac3-497b-9d22-8492474c982b')
    expect(await reader('manifest', undefined, 1)).toEqual(Uint8Array.of(7))
  })
  it('bounds decoded data even when the SDK reports a smaller transfer size', async () => {
    vi.mocked(get).mockImplementation(async (pathname) => ({ statusCode: 200, blob: { pathname, size: 1 }, stream: new ReadableStream({ start(controller) { controller.enqueue(Uint8Array.of(1, 2)); controller.close() } }) }) as never)
    const reader = createVercelBackupReader('user-a', '8166d21c-bac3-497b-9d22-8492474c982b')
    expect(await reader('manifest', undefined, 2)).toEqual(Uint8Array.of(1, 2))
    await expect(reader('manifest', undefined, 1)).rejects.toThrow()
  })
})
