import { neon } from '@neondatabase/serverless'
import { createRemoteJWKSet } from 'jose'
import { createClerkSessionReader } from './clerkSession'
import { createClerkVerifier } from './clerkVerifier'
import { lookupRole } from './roles'

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

export function createClerkRuntime(config: { databaseUrl: string; secretKey: string; issuer: string; allowedOrigins: string; allowMissingAzp: boolean }) {
  const issuer = new URL(config.issuer)
  if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.pathname !== '/' || issuer.search || issuer.hash || issuer.origin !== config.issuer) throw new Error('Issuer inválido')
  const origins = config.allowedOrigins.split(',').map((value) => value.trim())
  if (origins.some((value) => { const url = new URL(value); return url.protocol !== 'https:' || url.origin !== value || url.username || url.password })) throw new Error('Origen inválido')
  let jwks = jwksCache.get(issuer.origin)
  if (!jwks) { jwks = createRemoteJWKSet(new URL('/.well-known/jwks.json', issuer)); jwksCache.set(issuer.origin, jwks) }
  const sql = neon(config.databaseUrl)
  const query = async (text: string, params: string[]) => ({ rows: await sql.query(text, params) as Array<Record<string, unknown>> })
  const verify = createClerkVerifier({ issuer: issuer.origin, authorizedParties: origins, allowMissingAzp: config.allowMissingAzp, jwks, getSession: createClerkSessionReader(config.secretKey) })
  const auth = { verify, role: (userId: string) => lookupRole(async (text, params) => ({ rows: await sql.query(text, params) as Array<{ role: string }> }), userId) }
  return { auth, origins, query }
}
