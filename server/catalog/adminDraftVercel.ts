import { createClerkRuntime } from '../auth/clerkRuntime'
import { createCatalogDraftHandler } from './adminDraftHandler'
import { listCatalogDrafts, saveCatalogDraft } from './adminDrafts'
import { archiveCatalogExercise } from './archive'
import { publishCatalogExercise } from './publish'
import { createCatalogImageVerifier } from './verifyImage'
import { authorizeCatalogImageUpload } from './authorizeImageUpload'
import { createCatalogImageSigner } from './signImageUpload'
import { z } from 'zod'

export async function serveAdminCatalogDrafts(request: Request): Promise<Response> {
  const { ADMIN_CATALOG_API_ENABLED, DATABASE_URL, CLERK_SECRET_KEY, CLERK_ISSUER, ACCOUNT_ALLOWED_ORIGINS } = process.env
  const unavailable = () => new Response(null, { status: 503, headers: { 'cache-control': 'no-store' } })
  if (ADMIN_CATALOG_API_ENABLED !== 'true' || !DATABASE_URL || !CLERK_SECRET_KEY || !CLERK_ISSUER || !ACCOUNT_ALLOWED_ORIGINS) return unavailable()
  try {
    const { auth, origins, query } = createClerkRuntime({ databaseUrl: DATABASE_URL, secretKey: CLERK_SECRET_KEY, issuer: CLERK_ISSUER, allowedOrigins: ACCOUNT_ALLOWED_ORIGINS, allowMissingAzp: process.env.CLERK_ALLOW_NATIVE_NO_AZP === 'true' })
    return await createCatalogDraftHandler({
      list: (req, cursor) => listCatalogDrafts(req, cursor, { auth, query }),
      save: (req, input) => saveCatalogDraft(req, input, { auth, query }),
      archive: (req, input) => {
        const parsed = z.object({ id: z.string() }).strict().safeParse(input)
        return parsed.success ? archiveCatalogExercise(req, parsed.data.id, { auth, query }) : Promise.resolve({ status: 400 })
      },
      publish: (req, input) => {
        const parsed = z.object({ id: z.string() }).strict().safeParse(input)
        if (!parsed.success) return Promise.resolve({ status: 400 })
        const imageOrigin = process.env.CATALOG_IMAGE_ORIGIN
        if (!imageOrigin) return Promise.resolve({ status: 503 })
        return publishCatalogExercise(req, parsed.data.id, { auth, query, verifyImage: createCatalogImageVerifier(imageOrigin) })
      },
      imageUpload: (req, input) => {
        const token = process.env.CATALOG_BLOB_READ_WRITE_TOKEN
        const imageOrigin = process.env.CATALOG_IMAGE_ORIGIN
        if (process.env.CATALOG_IMAGE_UPLOAD_ENABLED !== 'true' || !token || !imageOrigin || token === process.env.BLOB_READ_WRITE_TOKEN) return Promise.resolve({ status: 503 })
        return authorizeCatalogImageUpload(req, input, { auth, query, sign: createCatalogImageSigner(imageOrigin, token) })
      },
    }, origins)(request)
  } catch { return unavailable() }
}
