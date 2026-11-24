import { describe, expect, it, vi } from 'vitest'
import { createPrivateBlobReader } from './blobReader'

describe('private backup object reader', () => {
  const backup = '8166d21c-bac3-497b-9d22-8492474c982b'
  const object = (bytes: number[], size = bytes.length) => ({ size, stream: new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(Uint8Array.from(bytes)); controller.close() } }) })
  it('derives different object keys for each owner, backup and component', async () => {
    const get = vi.fn(async (_pathname: string) => object([1, 2]))
    const a = createPrivateBlobReader('user-a', backup, get)
    const b = createPrivateBlobReader('user-b', backup, get)
    expect(await a('manifest', undefined, 2)).toEqual(Uint8Array.from([1, 2]))
    await a('asset', '../manifest', 2)
    await b('manifest', undefined, 2)
    const keys = get.mock.calls.map((call) => String(call[0]))
    expect(new Set(keys).size).toBe(3)
    expect(keys.every((key) => !key.includes('..') && !key.includes('user-'))).toBe(true)
  })
  it('rejects oversized and incomplete streams without returning partial bytes', async () => {
    await expect(createPrivateBlobReader('user-a', backup, async () => object([1, 2], 3))('manifest', undefined, 2)).rejects.toThrow()
    await expect(createPrivateBlobReader('user-a', backup, async () => object([1, 2], 1))('manifest', undefined, 2)).rejects.toThrow()
    await expect(createPrivateBlobReader('user-a', backup, async () => object([1], 2))('manifest', undefined, 2)).rejects.toThrow()
    await expect(createPrivateBlobReader('user-a', backup, async () => null)('manifest', undefined, 2)).resolves.toBeNull()
  })
  it('bounds streams when the provider does not report a length', async () => {
    const unknown = (bytes: number[]) => ({ ...object(bytes), size: null })
    await expect(createPrivateBlobReader('user-a', backup, async () => unknown([1, 2]))('manifest', undefined, 2)).resolves.toEqual(Uint8Array.of(1, 2))
    await expect(createPrivateBlobReader('user-a', backup, async () => unknown([1, 2, 3]))('manifest', undefined, 2)).rejects.toThrow()
  })
  it('uses the same object key for equivalent UUID casing', async () => {
    const get = vi.fn(async (_pathname: string) => object([1]))
    await createPrivateBlobReader('user-a', backup, get)('manifest', undefined, 1)
    await createPrivateBlobReader('user-a', backup.toUpperCase(), get)('manifest', undefined, 1)
    expect(get.mock.calls[0]?.[0]).toBe(get.mock.calls[1]?.[0])
  })
})
