import { readBoundedJson } from '../http/readBoundedJson'

type Result = { status: number; [key: string]: unknown }
type Operation = (request: Request, input: unknown) => Promise<Result>
type Operations = {
  list: (request: Request) => Promise<Result>
  prepare: (request: Request) => Promise<Result>
  manifestUpload: Operation; reserve: Operation; assetUpload: Operation; confirm: Operation; download: Operation
}

export function createBackupHandler(operations: Operations, allowedOrigins: string[], onError?: (error: unknown) => void) {
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
    const path = new URL(request.url).pathname
    const backupId = /^\/api\/v1\/backups\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(path)?.[1]?.toLowerCase()
    const singleBackup = path === '/api/v1/backups/latest' || !!backupId
    const routes: Record<string, Operation> = {
      '/api/v1/backups/manifest-upload': operations.manifestUpload,
      '/api/v1/backups/reserve': operations.reserve,
      '/api/v1/backups/asset-upload': operations.assetUpload,
      '/api/v1/backups/confirm': operations.confirm,
      '/api/v1/backups/download': operations.download,
    }
    try {
      let result: Result
      if (path === '/api/v1/backups' && request.method === 'GET') result = await operations.list(request)
      else if (singleBackup && request.method === 'GET') {
        const listed = await operations.list(request)
        if (listed.status !== 200) result = listed
        else {
          if (!('backups' in listed) || !Array.isArray(listed.backups)) throw new Error('Lista de respaldos inválida')
          const backup = path.endsWith('/latest') ? listed.backups[0] : listed.backups.find((item: { id?: unknown }) => typeof item.id === 'string' && item.id.toLowerCase() === backupId)
          result = backup ? { status: 200, backup } : { status: 404 }
        }
      }
      else if (path === '/api/v1/backups' && request.method === 'POST') result = await operations.prepare(request)
      else if (routes[path] && request.method === 'POST') {
        let body: unknown
        try { body = await readBoundedJson(request) } catch { return new Response(null, { status: 400, headers }) }
        result = await routes[path](request, body)
      } else return new Response(null, { status: routes[path] || path === '/api/v1/backups' || singleBackup ? 405 : 404, headers })
      const { status, ...body } = result
      if (status !== 200 && status !== 201) return new Response(null, { status, headers })
      headers.set('content-type', 'application/json; charset=utf-8')
      return new Response(JSON.stringify(body), { status, headers })
    } catch (error) { onError?.(error); return new Response(null, { status: 503, headers }) }
  }
}
