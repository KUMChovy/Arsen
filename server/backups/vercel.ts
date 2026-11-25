import { z } from 'zod'
import { prepareRemoteBackupSchema } from '../../src/shared/validation/remoteBackup'
import { createClerkRuntime } from '../auth/clerkRuntime'
import { createNeonTransactionRunner } from '../db/neonTransaction'
import { authorizeAssetUpload } from './authorizeAssetUpload'
import { authorizeBackupDownload } from './authorizeDownload'
import { authorizeManifestUpload } from './authorizeManifestUpload'
import { confirmBackup } from './confirm'
import { createBackupHandler } from './handler'
import { readBoundedJson } from '../http/readBoundedJson'
import { listBackups } from './list'
import { prepareBackup } from './prepare'
import { reconfirmBackup } from './reconfirm'
import { reserveBackupComponents } from './reserveComponents'
import { signPrivateBackupDownload } from './signDownload'
import { signPrivateBackupUpload } from './signUpload'
import { createVercelBackupReader } from './vercelBlobReader'
import { verifyArchive } from './verifyArchive'

const prepareSchema = z.object({ deviceId: z.string().uuid(), backup: prepareRemoteBackupSchema }).strict()
const confirmSchema = z.object({ backupId: z.string().uuid() }).strict()

export function safeBackupFailure(phase: 'blob-read' | 'request', error: unknown) {
  const name = error instanceof Error ? error.name : ''
  const category = ['BlobError', 'BlobAccessError', 'BlobNotFoundError', 'NeonDbError', 'TypeError'].includes(name) ? name : 'other'
  console.error('arsen-backup', phase, category)
}

export async function serveBackups(request: Request): Promise<Response> {
  const { BACKUP_API_ENABLED, BACKUP_MAX_BYTES, DATABASE_URL, BLOB_READ_WRITE_TOKEN, CLERK_SECRET_KEY, CLERK_ISSUER, ACCOUNT_ALLOWED_ORIGINS } = process.env
  const unavailable = () => new Response(null, { status: 503, headers: { 'cache-control': 'no-store' } })
  if (BACKUP_API_ENABLED !== 'true' || !BACKUP_MAX_BYTES || !/^\d+$/.test(BACKUP_MAX_BYTES) || !DATABASE_URL || !BLOB_READ_WRITE_TOKEN || !CLERK_SECRET_KEY || !CLERK_ISSUER || !ACCOUNT_ALLOWED_ORIGINS) return unavailable()
  const maxBackupBytes = Number(BACKUP_MAX_BYTES)
  if (!Number.isSafeInteger(maxBackupBytes) || maxBackupBytes <= 0) return unavailable()
  try {
    const { auth, origins, query } = createClerkRuntime({ databaseUrl: DATABASE_URL, secretKey: CLERK_SECRET_KEY, issuer: CLERK_ISSUER, allowedOrigins: ACCOUNT_ALLOWED_ORIGINS, allowMissingAzp: process.env.CLERK_ALLOW_NATIVE_NO_AZP === 'true' })
    const database = createNeonTransactionRunner(DATABASE_URL)
    try {
      const transaction = database.run
      const handler = createBackupHandler({
        list: (req) => listBackups(req, { auth, query }),
        prepare: async (req) => {
          let input: z.infer<typeof prepareSchema>
          try { input = prepareSchema.parse(await readBoundedJson(req.clone(), 4096)) } catch { return { status: 400 } }
          if (input.backup.sizeBytes > maxBackupBytes) return { status: 400 }
          return prepareBackup(req, { auth, transaction })
        },
        manifestUpload: (req, input) => authorizeManifestUpload(req, input, { auth, transaction, sign: signPrivateBackupUpload }),
        reserve: (req, input) => reserveBackupComponents(req, input, {
          auth, transaction, maxBackupBytes,
          readManifest: async (userId, backupId, maxBytes) => {
            try { return await createVercelBackupReader(userId, backupId)('manifest', undefined, maxBytes) }
            catch (error) { safeBackupFailure('blob-read', error); throw error }
          },
        }),
        assetUpload: (req, input) => authorizeAssetUpload(req, input, { auth, transaction, sign: signPrivateBackupUpload, maxBackupBytes }),
        confirm: (req, input) => {
          const parsed = confirmSchema.safeParse(input)
          if (!parsed.success) return Promise.resolve({ status: 400 })
          return confirmBackup(req, parsed.data.backupId, { auth, transaction, verifyObjects: (backup) => backup.sizeBytes <= maxBackupBytes ? verifyArchive(backup, createVercelBackupReader(backup.userId, backup.id)) : Promise.resolve(false) })
        },
        reconfirm: (req, input) => reconfirmBackup(req, input, { auth, transaction, verifyObjects: (backup) => backup.sizeBytes <= maxBackupBytes ? verifyArchive(backup, createVercelBackupReader(backup.userId, backup.id)) : Promise.resolve(false) }),
        download: (req, input) => authorizeBackupDownload(req, input, { auth, transaction, sign: signPrivateBackupDownload }),
      }, origins, (error) => safeBackupFailure('request', error))
      return await handler(request)
    } finally { await database.close() }
  } catch { return unavailable() }
}
