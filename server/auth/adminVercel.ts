import { createAdminHandler } from './adminHandler'
import { createClerkInvitationClient } from './clerkInvitations'
import { createClerkRuntime } from './clerkRuntime'
import { issueClerkInvitation } from './issueClerkInvitation'
import { listAdminAccounts } from './adminAccounts'
import { listAdminBackups } from './adminBackups'
import { getAdminOverview } from './adminOverview'
import { getAdminAudit } from './adminAudit'
import { createClerkUserReader } from './clerkSession'
import { createNeonTransactionRunner } from '../db/neonTransaction'
import { runManualMaintenance } from '../backups/manualMaintenance'
import { runBackupMaintenance } from '../backups/maintenance'
import { cleanupOneBackup } from '../backups/cleanup'
import { expireOnePendingBackup } from '../backups/expirePending'
import { createVercelCleanup } from '../backups/vercelCleanup'
import { createClerkDeletionClient } from './clerkDeleteAccount'
import { deleteAdminAccount } from './deleteAccount'
import { privateBlobToken } from '../backups/privateBlobToken'
import { z } from 'zod'
import { createHash } from 'node:crypto'

export async function serveAdminInvitations(request: Request): Promise<Response> {
  const { ADMIN_API_ENABLED, DATABASE_URL, CLERK_SECRET_KEY, CLERK_ISSUER, ACCOUNT_ALLOWED_ORIGINS } = process.env
  const unavailable = () => new Response(null, { status: 503, headers: { 'cache-control': 'no-store' } })
  if (ADMIN_API_ENABLED !== 'true' || !DATABASE_URL || !CLERK_SECRET_KEY || !CLERK_ISSUER || !ACCOUNT_ALLOWED_ORIGINS) return unavailable()
  try {
    const { auth, origins, query } = createClerkRuntime({ databaseUrl: DATABASE_URL, secretKey: CLERK_SECRET_KEY, issuer: CLERK_ISSUER, allowedOrigins: ACCOUNT_ALLOWED_ORIGINS, allowMissingAzp: process.env.CLERK_ALLOW_NATIVE_NO_AZP === 'true' })
    const clerk = createClerkInvitationClient(CLERK_SECRET_KEY)
    const identity = createClerkUserReader(CLERK_SECRET_KEY)
    return await createAdminHandler((req, input) => issueClerkInvitation(req, input, { auth, query, find: clerk.find, create: clerk.create }), origins, {
      listAccounts: (req, cursor) => listAdminAccounts(req, cursor, { auth, query, identity }),
      listBackups: (req, userId) => listAdminBackups(req, userId, { auth, query }),
      overview: (req) => getAdminOverview(req, { auth, query }),
      audit: (req) => getAdminAudit(req, { auth, query }),
      maintenance: (req) => runManualMaintenance(req, { auth, run: async () => {
        if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Almacenamiento privado no configurado')
        const db = createNeonTransactionRunner(DATABASE_URL)
        try { return await runBackupMaintenance(() => cleanupOneBackup({ transaction: db.run, ...createVercelCleanup() }), () => expireOnePendingBackup({ transaction: db.run })) } finally { await db.close() }
      } }),
      deleteAccount: async (req, input) => {
        const parsed = z.object({ userId: z.string().regex(/^user_[A-Za-z0-9]{1,123}$/) }).strict().safeParse(input)
        if (!parsed.success) return { status: 400 }
        const deletion = createClerkDeletionClient(CLERK_SECRET_KEY)
        const db = createNeonTransactionRunner(DATABASE_URL)
        try {
          return await deleteAdminAccount(req, parsed.data.userId, { auth, issuer: CLERK_ISSUER, storeFingerprint: () => createHash('sha256').update(privateBlobToken(), 'utf8').digest('hex'), transaction: db.run, ban: deletion.ban, deleteIdentity: deletion.deleteIdentity, ...createVercelCleanup() })
        } finally { await db.close() }
      },
    })(request)
  } catch { return unavailable() }
}
