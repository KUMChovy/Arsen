import { readCatalogVersion, readPublishedCatalog } from './read'

type Query = (sql: string) => Promise<{ rows: Array<Record<string, unknown>> }>

export function createCatalogHandler(query: Query, enabled: boolean) {
  return async (request: Request): Promise<Response> => {
    if (!enabled) return new Response(null, { status: 503 })
    try {
      const path = new URL(request.url).pathname
      const response = path === '/api/v1/catalog' ? await readPublishedCatalog(request, query)
        : path === '/api/v1/catalog/version' ? await readCatalogVersion(request, query)
          : new Response(null, { status: 404 })
      const headers = new Headers(response.headers)
      headers.set('access-control-allow-origin', '*')
      return new Response(response.body, { status: response.status, headers })
    } catch {
      return new Response(null, { status: 503, headers: { 'access-control-allow-origin': '*' } })
    }
  }
}
