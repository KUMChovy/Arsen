import { del, list } from '@vercel/blob'
import { privateBlobToken } from './privateBlobToken'

export function createVercelCleanup() {
  return {
    async list(prefix: string, limit: number): Promise<string[]> {
      const result = await list({ token: privateBlobToken(), prefix, limit, mode: 'expanded', abortSignal: AbortSignal.timeout(10_000) })
      if (result.hasMore && result.blobs.length === 0) throw new Error('Listado incompleto')
      return result.blobs.map((blob) => blob.pathname)
    },
    async remove(paths: string[]): Promise<void> {
      await del(paths, { token: privateBlobToken(), abortSignal: AbortSignal.timeout(10_000) })
    },
  }
}
