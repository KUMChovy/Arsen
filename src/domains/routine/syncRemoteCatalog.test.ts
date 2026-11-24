import 'fake-indexeddb/auto'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import { applyRemoteCatalog, readRemoteCatalog } from './remoteCatalogCache'
import { syncRemoteCatalog } from './syncRemoteCatalog'

describe('global catalog synchronization', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open() })
  afterEach(() => { db.close(); vi.unstubAllGlobals() })

  it('downloads a newer version and stores it without an account', async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => String(url).endsWith('/version')
      ? Response.json({ version: 2 }) : Response.json({ version: 2, exercises: [] }))
    vi.stubGlobal('fetch', fetcher)
    expect(await syncRemoteCatalog('https://api.example.test')).toBe('updated')
    expect(await readRemoteCatalog()).toEqual({ version: 2, exercises: [] })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('checks only the lightweight endpoint when the version is current', async () => {
    await applyRemoteCatalog({ version: 2, exercises: [] }, async () => true)
    const fetcher = vi.fn(async () => Response.json({ version: 2 }))
    vi.stubGlobal('fetch', fetcher)
    expect(await syncRemoteCatalog('https://api.example.test')).toBe('current')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('preserves the current snapshot when offline or when a download is invalid', async () => {
    await applyRemoteCatalog({ version: 1, exercises: [] }, async () => true)
    vi.stubGlobal('fetch', async () => { throw new Error('offline') })
    expect(await syncRemoteCatalog('https://api.example.test')).toBe('unavailable')
    vi.stubGlobal('fetch', async (url: string | URL | Request) => String(url).endsWith('/version')
      ? Response.json({ version: 2 }) : Response.json({ version: 1, exercises: [] }))
    expect(await syncRemoteCatalog('https://api.example.test')).toBe('unavailable')
    expect(await readRemoteCatalog()).toEqual({ version: 1, exercises: [] })
  })

  it('rejects an insecure service origin without fetching', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    expect(await syncRemoteCatalog('http://api.example.test')).toBe('unavailable')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('stops reading an oversized response instead of buffering it', async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(2048)) },
      cancel,
    })
    vi.stubGlobal('fetch', async () => new Response(stream))
    expect(await syncRemoteCatalog('https://api.example.test')).toBe('unavailable')
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('persists a downloaded exercise only after its image is verified and cached', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const image = { url: 'https://assets.example.test/a.png', sha256: createHash('sha256').update(bytes).digest('hex'), sizeBytes: 4, mimeType: 'image/png' }
    const exercise = { id: 'sinful-shell-new', name: 'Prensa', canonicalName: 'prensa', mainMuscle: 'Piernas', aliases: [], technicalNotes: 'Controla el descenso.', image }
    const stored = new Map<string, Response>()
    vi.stubGlobal('caches', { open: async () => ({
      match: async (key: string) => stored.get(key)?.clone(),
      put: async (key: string, value: Response) => { stored.set(key, value.clone()) },
      delete: async (key: string) => stored.delete(key),
    }) })
    vi.stubGlobal('fetch', async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/version')) return Response.json({ version: 1 })
      if (url.endsWith('/catalog')) return Response.json({ version: 1, exercises: [exercise] })
      return new Response(bytes, { headers: { 'content-type': 'image/png' } })
    })
    expect(await syncRemoteCatalog('https://api.example.test')).toBe('updated')
    expect(await readRemoteCatalog()).toEqual({ version: 1, exercises: [exercise] })
    expect(stored.size).toBe(1)
  })
})
