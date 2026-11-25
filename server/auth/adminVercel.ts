import { createAdminHandler } from './adminHandler'
import { createClerkInvitationClient } from './clerkInvitations'
import { createClerkRuntime } from './clerkRuntime'
import { issueClerkInvitation } from './issueClerkInvitation'
import { listAdminAccounts } from './adminAccounts'
import { listAdminBackups } from './adminBackups'
import { getAdminOverview } from './adminOverview'
import { getAdminAudit } from './adminAudit'
import { createClerkUserReader } from './clerkSession'

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
    })(request)
  } catch { return unavailable() }
}
