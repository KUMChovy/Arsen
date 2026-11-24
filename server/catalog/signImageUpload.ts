import { issueSignedToken, presignUrl } from '@vercel/blob'
import { z } from 'zod'
import { parseCatalogImageOrigin } from './verifyImage'

const schema = z.object({
  pathname: z.string().regex(/^catalog\/images\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg|webp)$/),
  mimeType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  sizeBytes: z.number().int().positive().max(10 * 1024 * 1024),
}).strict()

export function createCatalogImageSigner(configuredOrigin: string, token: string) {
  const origin = parseCatalogImageOrigin(configuredOrigin)
  if (!token.startsWith('vercel_blob_rw_') || token.length > 1024) throw new Error('Token de almacenamiento inválido')
  return async (input: z.infer<typeof schema>) => {
    const parsed = schema.parse(input)
    const extension = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }[parsed.mimeType]
    if (!parsed.pathname.endsWith(extension)) throw new Error('Tipo de imagen incompatible')
    const validUntil = Date.now() + 5 * 60 * 1000
    const allowedContentTypes = [parsed.mimeType]
    const delegation = await issueSignedToken({ token, pathname: parsed.pathname, operations: ['put'], allowedContentTypes, maximumSizeInBytes: parsed.sizeBytes, validUntil, abortSignal: AbortSignal.timeout(10_000) })
    const signed = await presignUrl(delegation, { access: 'public', operation: 'put', pathname: parsed.pathname, validUntil: Math.min(validUntil, delegation.validUntil), allowedContentTypes, maximumSizeInBytes: parsed.sizeBytes, allowOverwrite: false, addRandomSuffix: false })
    return { uploadUrl: signed.presignedUrl, imageUrl: new URL(`/${parsed.pathname}`, origin).href }
  }
}
