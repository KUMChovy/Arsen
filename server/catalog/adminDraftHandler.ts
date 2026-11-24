import { readBoundedJson } from '../http/readBoundedJson'

type Result = { status: number; [key: string]: unknown }

export function createCatalogDraftHandler(operations: {
  list: (request: Request, cursor: string | null) => Promise<Result>
  save: (request: Request, input: unknown) => Promise<Result>
  archive: (request: Request, input: unknown) => Promise<Result>
  publish: (request: Request, input: unknown) => Promise<Result>
  imageUpload: (request: Request, input: unknown) => Promise<Result>
}, allowedOrigins: string[]) {
  return async (request: Request): Promise<Response> => {
    const headers = new Headers({ 'cache-control': 'no-store', vary: 'Origin' })
    const origin = request.headers.get('origin')
    if (origin && !allowedOrigins.includes(origin)) return new Response(null, { status: 403, headers })
    if (origin) headers.set('access-control-allow-origin', origin)
    if (request.method === 'OPTIONS') {
      if (!origin) return new Response(null, { status: 403, headers })
      headers.set('access-control-allow-methods', 'GET, POST, OPTIONS')
      headers.set('access-control-allow-headers', 'authorization, content-type')
      return new Response(null, { status: 204, headers })
    }
    const url = new URL(request.url)
    const drafts = url.pathname === '/api/v1/admin/catalog/drafts'
    const archive = url.pathname === '/api/v1/admin/catalog/archive'
    const publish = url.pathname === '/api/v1/admin/catalog/publish'
    const imageUpload = url.pathname === '/api/v1/admin/catalog/image-upload'
    if (!drafts && !archive && !publish && !imageUpload) return new Response(null, { status: 404, headers })
    try {
      let result: Result
      if (drafts && request.method === 'GET') result = await operations.list(request, url.searchParams.get('cursor'))
      else if (request.method === 'POST') {
        let input: unknown
        try { input = await readBoundedJson(request, 65536) } catch { return new Response(null, { status: 400, headers }) }
        result = await (drafts ? operations.save(request, input) : archive ? operations.archive(request, input) : publish ? operations.publish(request, input) : operations.imageUpload(request, input))
      } else return new Response(null, { status: 405, headers })
      const { status, ...body } = result
      if (status !== 200 && status !== 201) return new Response(null, { status, headers })
      headers.set('content-type', 'application/json; charset=utf-8')
      return new Response(JSON.stringify(body), { status, headers })
    } catch { return new Response(null, { status: 503, headers }) }
  }
}
