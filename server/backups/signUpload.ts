import { issueSignedToken, presignUrl } from '@vercel/blob'
import { backupObjectPath } from './blobReader'
import { privateBlobToken } from './privateBlobToken'

// El llamador debe comprobar sesión, propietario, estado pendiente y pertenencia del componente.
export async function signPrivateBackupUpload(input: {
  userId: string; backupId: string; kind: 'manifest' | 'asset'; assetId?: string; maxBytes: number; serverLimitBytes: number
}): Promise<string> {
  if (!Number.isSafeInteger(input.maxBytes) || !Number.isSafeInteger(input.serverLimitBytes) || input.maxBytes <= 0 || input.serverLimitBytes <= 0 || input.maxBytes > input.serverLimitBytes) throw new Error('Tamaño de carga inválido')
  const pathname = backupObjectPath(input.userId, input.backupId, input.kind, input.assetId)
  const allowedContentTypes = [input.kind === 'manifest' ? 'application/json' : 'application/octet-stream']
  const validUntil = Date.now() + 5 * 60 * 1000
  const token = await issueSignedToken({ token: privateBlobToken(), pathname, operations: ['put'], validUntil, allowedContentTypes, maximumSizeInBytes: input.maxBytes, abortSignal: AbortSignal.timeout(10_000) })
  const signed = await presignUrl(token, { pathname, operation: 'put', access: 'private', validUntil: Math.min(validUntil, token.validUntil), allowedContentTypes, maximumSizeInBytes: input.maxBytes, allowOverwrite: false, addRandomSuffix: false })
  return signed.presignedUrl
}
