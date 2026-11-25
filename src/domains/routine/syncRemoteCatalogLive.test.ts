import 'fake-indexeddb/auto'
import { loadEnv } from 'vite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import { readRemoteCatalog } from './remoteCatalogCache'
import { syncRemoteCatalog } from './syncRemoteCatalog'

describe.skipIf(process.env.RUN_CATALOG_PUBLIC_LIVE_CHECK !== '1')('public development catalog synchronization', () => {
  afterEach(() => { db.close(); vi.unstubAllGlobals() })
  it('downloads the public catalog and retains it when offline', async () => {
    const origin = loadEnv('development', process.cwd(), '').VITE_CATALOG_API_ORIGIN
    if (!origin) throw new Error('Falta el origen público de desarrollo')
    const values = new Map<string, Response>()
    vi.stubGlobal('caches', { open: async () => ({
      match: async (key: string) => values.get(key)?.clone(),
      put: async (key: string, value: Response) => { values.set(key, value.clone()) },
      delete: async (key: string) => values.delete(key),
    }) })
    await db.open()
    expect(await syncRemoteCatalog(origin)).toBe('updated')
    const snapshot = await readRemoteCatalog()
    expect(snapshot?.version).toBeGreaterThanOrEqual(74)
    expect(snapshot?.exercises).toHaveLength(74)
    expect(values.size).toBeGreaterThanOrEqual(73)
    vi.stubGlobal('fetch', async () => { throw new Error('offline') })
    expect(await syncRemoteCatalog(origin)).toBe('unavailable')
    expect(await readRemoteCatalog()).toEqual(snapshot)
  }, 180_000)
})
