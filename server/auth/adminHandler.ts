import { readBoundedJson } from '../http/readBoundedJson'

export function createAdminHandler(issue: (request: Request, input: unknown) => Promise<{ status: number } & object>, allowedOrigins: string[], operations?: {
  listAccounts: (request: Request, cursor: string | null) => Promise<{ status: number } & object>
  listBackups?: (request: Request, userId: string) => Promise<{ status: number } & object>
  overview?: (request: Request) => Promise<{ status: number } & object>
  audit?: (request: Request) => Promise<{ status: number } & object>
  maintenance?: (request: Request) => Promise<{ status: number } & object>
  deleteAccount?: (request: Request, input: unknown) => Promise<{ status: number } & object>
}) {
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
    const invitations = url.pathname === '/api/v1/admin/invitations'
    const accounts = url.pathname === '/api/v1/admin/accounts' && !!operations
    const backupAccount = /^\/api\/v1\/admin\/accounts\/([^/]+)\/backups$/.exec(url.pathname)?.[1]
    const backups = !!backupAccount && !!operations?.listBackups
    const overview = url.pathname === '/api/v1/admin/overview' && !!operations?.overview
    const audit = url.pathname === '/api/v1/admin/audit' && !!operations?.audit
    const maintenance = url.pathname === '/api/v1/admin/maintenance' && !!operations?.maintenance
    const deletion = url.pathname === '/api/v1/admin/accounts/delete' && !!operations?.deleteAccount
    if (!invitations && !accounts && !backups && !overview && !audit && !maintenance && !deletion) return new Response(null, { status: 404, headers })
    if (((invitations || maintenance || deletion) && request.method !== 'POST') || ((accounts || backups || overview || audit) && request.method !== 'GET')) return new Response(null, { status: 405, headers })
    try {
      let result: { status: number } & object
      if (accounts) result = await operations!.listAccounts(request, url.searchParams.get('cursor'))
      else if (backups) result = await operations!.listBackups!(request, backupAccount!)
      else if (overview) result = await operations!.overview!(request)
      else if (audit) result = await operations!.audit!(request)
      else if (maintenance) result = await operations!.maintenance!(request)
      else {
        let input: unknown
        try { input = await readBoundedJson(request, 4096) } catch { return new Response(null, { status: 400, headers }) }
        result = deletion ? await operations!.deleteAccount!(request, input) : await issue(request, input)
      }
      const { status, ...body } = result
      if (status !== 200 && status !== 201) return new Response(null, { status, headers })
      headers.set('content-type', 'application/json; charset=utf-8')
      return new Response(JSON.stringify(body), { status, headers })
    } catch { return new Response(null, { status: 503, headers }) }
  }
}
