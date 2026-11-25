import { neon } from '@neondatabase/serverless'
import { createCatalogHandler } from './handler'

export async function serveCatalog(request: Request): Promise<Response> {
  const databaseUrl = process.env.DATABASE_URL
  if (process.env.CATALOG_PUBLIC_ENABLED !== 'true' || !databaseUrl) return new Response(null, { status: 503 })
  try {
    const sql = neon(databaseUrl)
    const handler = createCatalogHandler(async (text, params) => ({ rows: await sql.query(text, params) }), true)
    return await handler(request)
  } catch {
    return new Response(null, { status: 503 })
  }
}
