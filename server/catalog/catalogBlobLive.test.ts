import { createHash, randomUUID } from 'node:crypto'
import { del, put } from '@vercel/blob'
import { describe, expect, it } from 'vitest'
import { createCatalogImageSigner } from './signImageUpload'
import { createCatalogImageVerifier } from './verifyImage'

describe.skipIf(process.env.RUN_PUBLIC_BLOB_LIVE_CHECK !== '1')('public catalog development store', () => {
  it('signs, uploads, verifies and removes only isolated test images', async () => {
    const token = process.env.CATALOG_BLOB_READ_WRITE_TOKEN
    expect(token && token !== process.env.BLOB_READ_WRITE_TOKEN).toBeTruthy()
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlJ5QAAAABJRU5ErkJggg==', 'base64')
    const first = `catalog/images/${randomUUID()}.png`
    const second = `catalog/images/${randomUUID()}.png`
    let attemptedFirst = false
    let attemptedSecond = false
    try {
      attemptedFirst = true
      const uploaded = await put(first, png, { access: 'public', token, addRandomSuffix: false, contentType: 'image/png', abortSignal: AbortSignal.timeout(15000) })
      const origin = new URL(uploaded.url).origin
      const signer = createCatalogImageSigner(origin, token!)
      const signed = await signer({ pathname: second, mimeType: 'image/png', sizeBytes: png.length })
      attemptedSecond = true
      const response = await fetch(signed.uploadUrl, { method: 'PUT', headers: { 'content-type': 'image/png' }, body: png, signal: AbortSignal.timeout(15000) })
      expect(response.ok).toBe(true)
      const verify = createCatalogImageVerifier(origin)
      const image = { url: signed.imageUrl, mimeType: 'image/png' as const, sha256: createHash('sha256').update(png).digest('hex'), sizeBytes: png.length }
      expect(await verify(image)).toBe(true)
      expect(await verify({ ...image, sha256: '0'.repeat(64) })).toBe(false)
    } finally {
      if (attemptedFirst) await del(first, { token, abortSignal: AbortSignal.timeout(15000) })
      if (attemptedSecond) await del(second, { token, abortSignal: AbortSignal.timeout(15000) })
    }
  }, 90000)
})
