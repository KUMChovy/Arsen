import { createHash } from 'node:crypto'
import { z } from 'zod'
import { catalogImageSchema } from '../../src/shared/validation/remoteCatalog'
import { matchesImageSignature } from '../../src/shared/utils/imageSignature'

type CatalogImage = z.infer<typeof catalogImageSchema>

export function parseCatalogImageOrigin(configuredOrigin: string): URL {
  const origin = new URL(configuredOrigin)
  if (origin.protocol !== 'https:' || origin.origin !== configuredOrigin || origin.username || origin.password || !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/.test(origin.hostname)) throw new Error('Origen de imágenes inválido')
  return origin
}

export function createCatalogImageVerifier(configuredOrigin: string, fetcher: typeof fetch = fetch) {
  const origin = parseCatalogImageOrigin(configuredOrigin)
  return async (input: CatalogImage): Promise<boolean> => {
    const parsed = catalogImageSchema.safeParse(input)
    if (!parsed.success) return false
    const image = parsed.data
    const url = new URL(image.url)
    if (url.origin !== origin.origin || url.username || url.password || url.search || url.hash) return false
    try {
      const response = await fetcher(image.url, { redirect: 'error', signal: AbortSignal.timeout(10_000) })
      if (!response.ok || response.redirected || !response.body || response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== image.mimeType) {
        await response.body?.cancel()
        return false
      }
      const reader = response.body.getReader()
      const digest = createHash('sha256')
      const header = new Uint8Array(12)
      let headerSize = 0
      let size = 0
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          size += value.byteLength
          if (size > image.sizeBytes) { await reader.cancel(); return false }
          const prefix = value.subarray(0, header.length - headerSize)
          header.set(prefix, headerSize)
          headerSize += prefix.length
          digest.update(value)
        }
      } finally { reader.releaseLock() }
      return size === image.sizeBytes && matchesImageSignature(image.mimeType, header.subarray(0, headerSize)) && digest.digest('hex') === image.sha256
    } catch { return false }
  }
}
