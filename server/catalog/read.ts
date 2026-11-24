import { publishedCatalogSchema } from '../../src/shared/validation/remoteCatalog'

type Query = (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }>

async function getVersion(query: Query): Promise<number | null> {
  const state = await query('SELECT version::text AS version FROM arsen_catalog_state WHERE singleton = true')
  const version = Number(state.rows[0]?.version)
  return Number.isSafeInteger(version) && version > 0 ? version : null
}

export async function readCatalogVersion(request: Request, query: Query): Promise<Response> {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { allow: 'GET' } })
  const version = await getVersion(query)
  if (!version) return new Response(null, { status: 503 })
  return Response.json({ version }, { headers: { 'cache-control': 'public, max-age=0, must-revalidate' } })
}

export async function readPublishedCatalog(request: Request, query: Query): Promise<Response> {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { allow: 'GET' } })
  const version = await getVersion(query)
  if (!version) return new Response(null, { status: 503 })
  const etag = `"catalog-${version}"`
  const headers = { etag, 'cache-control': 'public, max-age=0, must-revalidate' }
  if (request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers })
  const snapshot = await query(`
    SELECT state.version::text AS version,
      COALESCE(jsonb_agg(item.published ORDER BY item.id) FILTER (WHERE item.id IS NOT NULL), '[]'::jsonb) AS exercises
    FROM arsen_catalog_state state
    LEFT JOIN arsen_catalog_items item ON item.published IS NOT NULL AND NOT item.archived
    WHERE state.singleton = true
    GROUP BY state.version
  `)
  const row = snapshot.rows[0]
  const data = publishedCatalogSchema.safeParse({ version: Number(row?.version), exercises: row?.exercises })
  if (!data.success) return new Response(null, { status: 503 })
  return Response.json(data.data, { headers: { ...headers, etag: `"catalog-${data.data.version}"` } })
}
