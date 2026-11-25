type Handler = (request: Request) => Promise<Response>
type Handlers = { account: Handler; backups: Handler; admin: Handler; adminCatalog: Handler; catalog: Handler; cleanup: Handler }

export function createApiRouter(handlers: Handlers): Handler {
  return (request) => {
    const path = new URL(request.url).pathname
    if (path === '/api/v1/account' || path.startsWith('/api/v1/account/')) return handlers.account(request)
    if (path === '/api/v1/backups' || path.startsWith('/api/v1/backups/')) return handlers.backups(request)
    if (['/api/v1/admin/catalog/drafts', '/api/v1/admin/catalog/archive', '/api/v1/admin/catalog/publish', '/api/v1/admin/catalog/image-upload'].includes(path)) return handlers.adminCatalog(request)
    if (['/api/v1/admin/accounts', '/api/v1/admin/overview', '/api/v1/admin/invitations', '/api/v1/admin/audit'].includes(path) || /^\/api\/v1\/admin\/accounts\/[^/]+\/backups$/.test(path)) return handlers.admin(request)
    if (path === '/api/v1/catalog' || path === '/api/v1/catalog/version' || /^\/api\/v1\/catalog\/images\/[^/]+$/.test(path)) return handlers.catalog(request)
    if (path === '/api/cron/cleanup') return handlers.cleanup(request)
    return Promise.resolve(new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } }))
  }
}

export function createRewriteGateway(route: Handler): Handler {
  return (request) => {
    const url = new URL(request.url)
    if (url.pathname !== '/api/gateway') return route(request)
    const paths = url.searchParams.getAll('__arsen_path')
    if (paths.length !== 1 || !/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(paths[0]!)) return Promise.resolve(new Response(null, { status: 404, headers: { 'cache-control': 'no-store' } }))
    url.pathname = `/api/${paths[0]}`
    url.searchParams.delete('__arsen_path')
    return route(new Request(url, request))
  }
}
