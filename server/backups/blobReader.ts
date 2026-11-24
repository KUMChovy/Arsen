import { createHash } from 'node:crypto'
import { z } from 'zod'

type GetPrivateObject = (pathname: string) => Promise<{ stream: ReadableStream<Uint8Array>; size: number | null } | null>
const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex')

export function backupObjectPath(userId: string, backupId: string, kind: 'manifest' | 'asset', id?: string): string {
  if (!userId.trim() || !z.string().uuid().safeParse(backupId).success) throw new Error('Identificador de respaldo inválido')
  const prefix = `backups/${digest(userId)}/${backupId.toLowerCase()}`
  if ((kind !== 'manifest' && kind !== 'asset') || (kind === 'asset' && !id)) throw new Error('Solicitud de objeto inválida')
  return kind === 'manifest' ? `${prefix}/manifest` : `${prefix}/assets/${digest(id!)}`
}

export function createPrivateBlobReader(userId: string, backupId: string, get: GetPrivateObject) {
  backupObjectPath(userId, backupId, 'manifest')
  return async (kind: 'manifest' | 'asset', id: string | undefined, maxBytes: number): Promise<Uint8Array | null> => {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) throw new Error('Solicitud de objeto inválida')
    const pathname = backupObjectPath(userId, backupId, kind, id)
    const object = await get(pathname)
    if (!object) return null
    if (object.size !== null && (!Number.isSafeInteger(object.size) || object.size < 0 || object.size > maxBytes)) { await object.stream.cancel(); throw new Error('Objeto demasiado grande') }
    const reader = object.stream.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if ((object.size !== null && size > object.size) || size > maxBytes) throw new Error('Tamaño de objeto incorrecto')
        chunks.push(value)
      }
      if (object.size !== null && size !== object.size) throw new Error('Objeto incompleto')
    } catch (error) {
      await reader.cancel().catch(() => {})
      throw error
    } finally { reader.releaseLock() }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return bytes
  }
}
