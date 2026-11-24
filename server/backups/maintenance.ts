import { timingSafeEqual } from 'node:crypto'

export async function runBackupMaintenance(
  cleanup: () => Promise<{ status: string; deleted: number }>,
  expire: () => Promise<{ status: 'idle' | 'expired' }>,
): Promise<{ status: string; deleted: number }> {
  const result = await cleanup()
  if (result.status !== 'idle') return result
  const expired = await expire()
  return { status: expired.status, deleted: 0 }
}

export function createCleanupHandler(secret: string, run: () => Promise<{ status: string; deleted: number }>) {
  if (!/^[A-Za-z0-9_-]{32,}$/.test(secret)) throw new Error('Se requiere un secreto de mantenimiento seguro')
  const expected = Buffer.from(`Bearer ${secret}`, 'utf8')
  return async (request: Request): Promise<Response> => {
    const headers = new Headers({ 'cache-control': 'no-store' })
    if (request.method !== 'GET') return new Response(null, { status: 405, headers })
    const received = Buffer.from(request.headers.get('authorization') ?? '', 'utf8')
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return new Response(null, { status: 401, headers })
    try {
      const result = await run()
      headers.set('content-type', 'application/json; charset=utf-8')
      return new Response(JSON.stringify(result), { status: 200, headers })
    } catch { return new Response(null, { status: 503, headers }) }
  }
}
