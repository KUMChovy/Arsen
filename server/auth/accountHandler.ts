import { authorize } from './authorize'
import { readBoundedJson } from '../http/readBoundedJson'

export function createAccountHandler(auth: {
  verify: (token: string) => Promise<string>
  role: (userId: string) => Promise<'user' | 'admin' | null>
}, allowedOrigins: string[], operations?: {
  activate: (request: Request) => Promise<{ status: number }>
  devices: (request: Request, input: unknown) => Promise<{ status: number } & object>
}) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin')
    const headers = new Headers({ 'cache-control': 'no-store', vary: 'Origin' })
    if (origin && !allowedOrigins.includes(origin)) return new Response(null, { status: 403, headers })
    if (origin) headers.set('access-control-allow-origin', origin)
    if (request.method === 'OPTIONS') {
      if (!origin) return new Response(null, { status: 403, headers })
      headers.set('access-control-allow-methods', 'GET, POST, OPTIONS')
      headers.set('access-control-allow-headers', 'authorization, content-type')
      return new Response(null, { status: 204, headers })
    }
    const path = new URL(request.url).pathname
    try {
      let result: { status: number } & object
      if (path === '/api/v1/account' && request.method === 'GET') {
        const authorization = await authorize(request, auth)
        result = authorization
      } else if (path === '/api/v1/account/activate' && request.method === 'POST' && operations) result = await operations.activate(request)
      else if (path === '/api/v1/account/devices' && request.method === 'POST' && operations) {
        let body: unknown
        try { body = await readBoundedJson(request, 4096) } catch { return new Response(null, { status: 400, headers }) }
        result = await operations.devices(request, body)
      } else return new Response(null, { status: ['/api/v1/account', '/api/v1/account/activate', '/api/v1/account/devices'].includes(path) ? 405 : 404, headers })
      const { status, ...body } = result
      if (status !== 200 && status !== 201) return new Response(null, { status, headers })
      headers.set('content-type', 'application/json; charset=utf-8')
      return new Response(JSON.stringify(body), { status, headers })
    } catch { return new Response(null, { status: 503, headers }) }
  }
}
