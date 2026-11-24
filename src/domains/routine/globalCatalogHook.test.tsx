// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../db/schema'
import { applyRemoteCatalog, readRemoteCatalog } from './remoteCatalogCache'
import { useGlobalCatalog, useGlobalCatalogSync } from './hooks'

describe('global catalog app lifecycle', () => {
  beforeEach(async () => { db.close(); await db.delete(); await db.open() })
  afterEach(() => { db.close(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

  it('checks the public catalog after local database initialization and stops on unmount', async () => {
    vi.stubEnv('VITE_CATALOG_API_ORIGIN', 'https://api.example.test')
    const fetcher = vi.fn(async (input: string | URL | Request) => String(input).endsWith('/version')
      ? Response.json({ version: 1 }) : Response.json({ version: 1, exercises: [] }))
    vi.stubGlobal('fetch', fetcher)
    const { rerender, unmount } = renderHook(({ ready }) => useGlobalCatalogSync(ready), { initialProps: { ready: false } })
    expect(fetcher).not.toHaveBeenCalled()
    rerender({ ready: true })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    await waitFor(async () => expect(await readRemoteCatalog()).toEqual({ version: 1, exercises: [] }))
    unmount()
    window.dispatchEvent(new Event('online'))
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('reacts when a new global catalog version is committed locally', async () => {
    const { result } = renderHook(() => useGlobalCatalog())
    await waitFor(() => expect(result.current).toBeNull())
    await applyRemoteCatalog({ version: 1, exercises: [] }, async () => true)
    await waitFor(() => expect(result.current).toEqual({ version: 1, exercises: [] }))
  })
})
