import { catalogImageSchema, type PublishedCatalog } from '../validation/remoteCatalog'

type Image = PublishedCatalog['exercises'][number]['image']
const cacheName = 'arsen-catalog-images-v1'
const cacheKey = (image: Image) => `https://arsen.invalid/catalog-images/${image.sha256}`

async function checkedBlob(response: Response, image: Image): Promise<Blob | null> {
  if (!response.ok || response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== image.mimeType || !response.body) return null
  const length = response.headers.get('content-length')
  if (length !== null && (!/^\d+$/.test(length) || Number(length) !== image.sizeBytes)) return null
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > image.sizeBytes) { await reader.cancel(); return null }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  if (size !== image.sizeBytes) return null
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  const digest = await crypto.subtle.digest('SHA-256', bytes.buffer)
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return hash === image.sha256 ? new Blob([bytes.buffer], { type: image.mimeType }) : null
}

export async function readCatalogImage(raw: Image): Promise<Blob | null> {
  const parsed = catalogImageSchema.safeParse(raw)
  if (!parsed.success) return null
  try {
    const cache = await caches.open(cacheName)
    const response = await cache.match(cacheKey(parsed.data))
    if (!response) return null
    const blob = await checkedBlob(response, parsed.data)
    if (!blob) await cache.delete(cacheKey(parsed.data))
    return blob
  } catch {
    return null
  }
}

export async function ensureCatalogImage(raw: Image): Promise<boolean> {
  const parsed = catalogImageSchema.safeParse(raw)
  if (!parsed.success) return false
  const image = parsed.data
  if (await readCatalogImage(image)) return true
  try {
    const response = await fetch(image.url, { credentials: 'omit', cache: 'no-store' })
    const blob = await checkedBlob(response, image)
    if (!blob) return false
    const cache = await caches.open(cacheName)
    await cache.put(cacheKey(image), new Response(blob, { headers: { 'content-type': image.mimeType } }))
    return true
  } catch {
    return false
  }
}

export async function recoverCatalogImage(reference: Image, apiOrigin: string): Promise<Blob | null> {
  const cached = await readCatalogImage(reference)
  if (cached) return cached
  try {
    const origin = new URL(apiOrigin)
    if (origin.protocol !== 'https:' || !['', '/'].includes(origin.pathname) || origin.username || origin.password || origin.search || origin.hash) return null
    const response = await fetch(new URL(`/api/v1/catalog/images/${reference.sha256}`, origin), { credentials: 'omit', cache: 'no-store' })
    if (!response.ok || !response.body) return null
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.length
        if (size > 8192) { await reader.cancel(); return null }
        chunks.push(value)
      }
    } finally { reader.releaseLock() }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    const metadata = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as { image?: unknown }
    const image = catalogImageSchema.safeParse(metadata.image)
    if (!image.success || image.data.sha256 !== reference.sha256 || image.data.sizeBytes !== reference.sizeBytes || image.data.mimeType !== reference.mimeType) return null
    if (!await ensureCatalogImage(image.data)) return null
    return readCatalogImage(reference)
  } catch { return null }
}
