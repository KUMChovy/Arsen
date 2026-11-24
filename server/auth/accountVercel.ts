import { createAccountHandler } from './accountHandler'
import { createClerkRuntime } from './clerkRuntime'
import { activateAccount } from './activationHandler'
import { createClerkUserReader } from './clerkSession'
import { registerDevice } from './registerDevice'

export async function serveAccount(request: Request): Promise<Response> {
  const { ACCOUNT_API_ENABLED, DATABASE_URL, CLERK_SECRET_KEY, CLERK_ISSUER, ACCOUNT_ALLOWED_ORIGINS } = process.env
  if (ACCOUNT_API_ENABLED !== 'true' || !DATABASE_URL || !CLERK_SECRET_KEY || !CLERK_ISSUER || !ACCOUNT_ALLOWED_ORIGINS) return new Response(null, { status: 503, headers: { 'cache-control': 'no-store' } })
  try {
    const runtime = createClerkRuntime({ databaseUrl: DATABASE_URL, secretKey: CLERK_SECRET_KEY, issuer: CLERK_ISSUER, allowedOrigins: ACCOUNT_ALLOWED_ORIGINS, allowMissingAzp: process.env.CLERK_ALLOW_NATIVE_NO_AZP === 'true' })
    return await createAccountHandler(runtime.auth, runtime.origins, {
      activate: (req) => activateAccount(req, { verify: runtime.auth.verify, getUser: createClerkUserReader(CLERK_SECRET_KEY), query: async (text, params) => ({ rows: (await runtime.query(text, params)).rows as Array<{ user_id: string }> }) }),
      devices: (req, input) => registerDevice(req, input, { auth: runtime.auth, query: runtime.query }),
    })(request)
  } catch {
    return new Response(null, { status: 503, headers: { 'cache-control': 'no-store' } })
  }
}
