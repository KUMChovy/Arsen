import { issueSignedToken, presignUrl } from '@vercel/blob'
import { backupObjectPath } from './blobReader'
import { privateBlobToken } from './privateBlobToken'

// El llamador debe comprobar sesión, propietario, estado confirmado y pertenencia del componente.
export async function signPrivateBackupDownload(input: { userId: string; backupId: string; kind: 'manifest' | 'asset'; assetId?: string }): Promise<string> {
  const pathname = backupObjectPath(input.userId, input.backupId, input.kind, input.assetId)
  const validUntil = Date.now() + 2 * 60 * 1000
  const token = await issueSignedToken({ token: privateBlobToken(), pathname, operations: ['get'], validUntil, abortSignal: AbortSignal.timeout(10_000) })
  const signed = await presignUrl(token, { pathname, operation: 'get', access: 'private', validUntil: Math.min(validUntil, token.validUntil), useCache: false })
  return signed.presignedUrl
}
