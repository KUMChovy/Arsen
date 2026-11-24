import { get } from '@vercel/blob'
import { createPrivateBlobReader } from './blobReader'
import { privateBlobToken } from './privateBlobToken'

export function createVercelBackupReader(userId: string, backupId: string) {
  return createPrivateBlobReader(userId, backupId, async (pathname) => {
    const result = await get(pathname, { token: privateBlobToken(), access: 'private', useCache: false })
    if (!result) return null
    if (result.statusCode !== 200 || result.blob.pathname !== pathname) {
      await result.stream?.cancel()
      throw new Error('Objeto privado inválido')
    }
    // The SDK derives size from HTTP Content-Length, which may describe a compressed
    // response or be missing. Bound decoded bytes and verify the archive hash instead.
    return { stream: result.stream, size: null }
  })
}
