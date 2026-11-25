import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureCatalogImage, readCatalogImage, recoverCatalogImage } from '../../shared/assets/catalogImages'

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
  it('recovers an archived image by its verified historical reference', async () => {
    installCache()
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => String(url).includes('/api/v1/catalog/images/')
      ? Response.json({ image })
      : new Response(bytes, { headers: { 'content-type': 'image/png' } })))
    const reference = { ...image, url: 'https://arsen.invalid/image' }
    const blob = await recoverCatalogImage(reference, 'https://api.example.test')
    expect([...new Uint8Array(await blob!.arrayBuffer())]).toEqual([...bytes])
    expect(await readCatalogImage(reference)).not.toBeNull()
  })
  it('rejects historical metadata that does not match the saved reference', async () => {
    installCache()
    const fetcher = vi.fn(async () => Response.json({ image: { ...image, sha256: 'b'.repeat(64) } }))
    vi.stubGlobal('fetch', fetcher)
    expect(await recoverCatalogImage({ ...image, url: 'https://arsen.invalid/image' }, 'https://api.example.test')).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('accepts the configured HTTPS origin with a trailing slash', async () => {
    installCache()
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL) => String(url).includes('/api/v1/catalog/images/')
      ? Response.json({ image }) : new Response(bytes, { headers: { 'content-type': 'image/png' } })))
    expect(await recoverCatalogImage({ ...image, url: 'https://arsen.invalid/image' }, 'https://api.example.test/')).not.toBeNull()
  })
})
