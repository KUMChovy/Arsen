import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createCatalogImageVerifier } from './verifyImage'

const origin = 'https://arsentest.public.blob.vercel-storage.com'
const bytes = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4)
const image = { url: `${origin}/exercise.png`, sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), mimeType: 'image/png' as const }
const response = (value = bytes, type = 'image/png') => new Response(value, { status: 200, headers: { 'content-type': type } })

describe('catalog image verification', () => {
  it('accepts only an exact approved Vercel Blob origin and checks bytes, size, and type', async () => {
    const fetcher = vi.fn(async () => response())
    const verify = createCatalogImageVerifier(origin, fetcher)
    expect(await verify(image)).toBe(true)
    expect(fetcher).toHaveBeenCalledWith(image.url, expect.objectContaining({ redirect: 'error', signal: expect.any(AbortSignal) }))
    expect(await verify({ ...image, url: 'https://example.com/image.png' })).toBe(false)
    expect(await verify({ ...image, url: `${origin}.evil.example/image.png` })).toBe(false)
    expect(await verify({ ...image, url: 'http://127.0.0.1/private' })).toBe(false)
    expect(await verify({ ...image, url: `${image.url}?token=secret` })).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('fails closed on content mismatch, truncated or oversized data and network errors', async () => {
    expect(await createCatalogImageVerifier(origin, async () => response(Uint8Array.of(9, 2, 3, 4)))(image)).toBe(false)
    expect(await createCatalogImageVerifier(origin, async () => response(Uint8Array.of(1, 2)))(image)).toBe(false)
    expect(await createCatalogImageVerifier(origin, async () => response(Uint8Array.of(1, 2, 3, 4, 5)))(image)).toBe(false)
    expect(await createCatalogImageVerifier(origin, async () => response(bytes, 'text/html'))(image)).toBe(false)
    expect(await createCatalogImageVerifier(origin, async () => new Response(null, { status: 302, headers: { location: 'https://example.com' } }))(image)).toBe(false)
    expect(await createCatalogImageVerifier(origin, async () => { throw new Error('timeout') })(image)).toBe(false)
  })
  it('rejects bytes that do not match the declared image format', async () => {
    const invalid = Uint8Array.of(1, 2, 3, 4)
    const metadata = { ...image, sizeBytes: invalid.length, sha256: createHash('sha256').update(invalid).digest('hex') }
    expect(await createCatalogImageVerifier(origin, async () => response(invalid))(metadata)).toBe(false)
  })
  it('recognizes JPEG and WebP signatures even when the stream splits them', async () => {
    for (const [mimeType, content] of [
      ['image/jpeg', Uint8Array.of(0xff, 0xd8, 0xff, 1)],
      ['image/webp', Uint8Array.of(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)],
    ] as const) {
      const metadata = { ...image, mimeType, sizeBytes: content.length, sha256: createHash('sha256').update(content).digest('hex') }
      const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(content.slice(0, 2)); controller.enqueue(content.slice(2)); controller.close() } })
      const verify = createCatalogImageVerifier(origin, async () => new Response(stream, { headers: { 'content-type': mimeType } }))
      expect(await verify(metadata)).toBe(true)
    }
  })
  it('rejects insecure or non-Blob configured origins before making requests', () => {
    for (const bad of ['http://arsentest.public.blob.vercel-storage.com', 'https://example.com', `${origin}/path`, 'https://user:pass@arsentest.public.blob.vercel-storage.com']) {
      expect(() => createCatalogImageVerifier(bad)).toThrow()
    }
  })
})
