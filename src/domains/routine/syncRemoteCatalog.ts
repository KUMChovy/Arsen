import { z } from 'zod'
import { publishedCatalogSchema } from '../../shared/validation/remoteCatalog'
import { ensureCatalogImage } from '../../shared/assets/catalogImages'
import { applyRemoteCatalog, readRemoteCatalog } from './remoteCatalogCache'

const versionSchema = z.object({ version: z.number().int().positive().safe() }).strict()

async function readJson(response: Response, limit: number): Promise<unknown> {
  if (!response.body) throw new Error('Respuesta vacía')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > limit) { await reader.cancel(); throw new Error('Respuesta demasiado grande') }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
}

export async function syncRemoteCatalog(apiOrigin: string): Promise<'updated' | 'current' | 'unavailable'> {
  try {
    const origin = new URL(apiOrigin)
    if (origin.protocol !== 'https:' || origin.username || origin.password) return 'unavailable'
    const options: RequestInit = { credentials: 'omit', cache: 'no-store' }
    const versionResponse = await fetch(new URL('/api/v1/catalog/version', origin), options)
    if (!versionResponse.ok) return 'unavailable'
    const version = versionSchema.parse(await readJson(versionResponse, 1024)).version
    const current = await readRemoteCatalog()
    if (current && current.version >= version) return 'current'
    const response = await fetch(new URL('/api/v1/catalog', origin), options)
    if (!response.ok) return 'unavailable'
    const snapshot = publishedCatalogSchema.parse(await readJson(response, 4 * 1024 * 1024))
    if (snapshot.version < version) return 'unavailable'
    return await applyRemoteCatalog(snapshot, ensureCatalogImage) ? 'updated' : 'current'
  } catch {
    return 'unavailable'
  }
}
