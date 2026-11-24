import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureCatalogImage, readCatalogImage } from '../../shared/assets/catalogImages'

const bytes = new Uint8Array([1, 2, 3, 4])
const image = { url: 'https://assets.example.test/image.png', sha256: createHash('sha256').update(bytes).digest('hex'), sizeBytes: bytes.length, mimeType: 'image/png' as const }

function installCache() {
  const values = new Map<string, Response>()
  vi.stubGlobal('caches', { open: async () => ({
    match: async (key: string) => values.get(key)?.clone(),
    put: async (key: string, value: Response) => { values.set(key, value.clone()) },
    delete: async (key: string) => values.delete(key),
  }) })
  return values
}

describe('offline catalog image cache', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('verifies bytes and serves the stored image when offline', async () => {
    installCache()
    const fetchImage = vi.fn(async () => new Response(bytes, { headers: { 'content-type': 'image/png' } }))
    vi.stubGlobal('fetch', fetchImage)
    expect(await ensureCatalogImage(image)).toBe(true)
    expect([...new Uint8Array(await (await readCatalogImage(image))!.arrayBuffer())]).toEqual([...bytes])
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await ensureCatalogImage(image)).toBe(true)
  })

  it('rejects wrong bytes, wrong mime type and interrupted downloads without caching', async () => {
    const stored = installCache()
    for (const response of [
      new Response(new Uint8Array([1, 2, 3, 5]), { headers: { 'content-type': 'image/png' } }),
      new Response(bytes, { headers: { 'content-type': 'image/jpeg' } }),
      new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }),
    ]) {
      vi.stubGlobal('fetch', async () => response)
      expect(await ensureCatalogImage(image)).toBe(false)
      expect(stored.size).toBe(0)
    }
  })
})
