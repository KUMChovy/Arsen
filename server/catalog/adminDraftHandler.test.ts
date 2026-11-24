import { describe, expect, it, vi } from 'vitest'
import { createCatalogDraftHandler } from './adminDraftHandler'

describe('catalog draft transport', () => {
  const list = vi.fn(async () => ({ status: 200, items: [], nextCursor: null }))
  const save = vi.fn(async () => ({ status: 201 }))
  const archive = vi.fn(async () => ({ status: 200, version: 2 }))
  const publish = vi.fn(async () => ({ status: 200, version: 3 }))
  const imageUpload = vi.fn(async () => ({ status: 200, uploadUrl: 'https://signed.example.test', imageUrl: 'https://public.example.test/image' }))
  const handler = createCatalogDraftHandler({ list, save, archive, publish, imageUpload }, ['https://admin.example.test'])
  it('allows only configured origins, methods and bounded payloads', async () => {
    list.mockClear(); save.mockClear()
    expect((await handler(new Request('https://api.example.test/api/v1/admin/catalog/drafts', { headers: { origin: 'https://evil.example.test' } }))).status).toBe(403)
    expect((await handler(new Request('https://api.example.test/api/v1/admin/catalog/drafts', { method: 'PUT' }))).status).toBe(405)
    expect((await handler(new Request('https://api.example.test/api/v1/admin/catalog/drafts', { method: 'POST', body: 'x'.repeat(65537) }))).status).toBe(400)
    expect(list).not.toHaveBeenCalled(); expect(save).not.toHaveBeenCalled()
  })
  it('passes cursor and body to operations without caching or revealing errors', async () => {
    const response = await handler(new Request('https://api.example.test/api/v1/admin/catalog/drafts?cursor=demo', { headers: { origin: 'https://admin.example.test' } }))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('access-control-allow-origin')).toBe('https://admin.example.test')
    expect(list).toHaveBeenCalledWith(expect.any(Request), 'demo')
    expect((await handler(new Request('https://api.example.test/api/v1/admin/catalog/drafts', { method: 'POST', body: '{}' }))).status).toBe(201)
    const broken = createCatalogDraftHandler({ list: async () => { throw new Error('private data') }, save, archive, publish, imageUpload }, [])
    const failure = await broken(new Request('https://api.example.test/api/v1/admin/catalog/drafts'))
    expect(failure.status).toBe(503)
    expect(await failure.text()).toBe('')
  })
  it('dispatches archive requests only using POST and bounded JSON', async () => {
    archive.mockClear()
    const url = 'https://api.example.test/api/v1/admin/catalog/archive'
    expect((await handler(new Request(url))).status).toBe(405)
    expect((await handler(new Request(url, { method: 'POST', body: 'x'.repeat(65537) }))).status).toBe(400)
    expect(archive).not.toHaveBeenCalled()
    const response = await handler(new Request(url, { method: 'POST', body: JSON.stringify({ id: 'ejercicio' }) }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ version: 2 })
    expect(archive).toHaveBeenCalledWith(expect.any(Request), { id: 'ejercicio' })
  })
  it('dispatches publication only using POST and bounded JSON', async () => {
    publish.mockClear()
    const url = 'https://api.example.test/api/v1/admin/catalog/publish'
    expect((await handler(new Request(url))).status).toBe(405)
    expect((await handler(new Request(url, { method: 'POST', body: 'x'.repeat(65537) }))).status).toBe(400)
    expect(publish).not.toHaveBeenCalled()
    const response = await handler(new Request(url, { method: 'POST', body: JSON.stringify({ id: 'ejercicio' }) }))
    expect(await response.json()).toEqual({ version: 3 })
  })
  it('dispatches image authorization only via POST', async () => {
    imageUpload.mockClear()
    const url = 'https://api.example.test/api/v1/admin/catalog/image-upload'
    expect((await handler(new Request(url))).status).toBe(405)
    const result = await handler(new Request(url, { method: 'POST', body: JSON.stringify({ mimeType: 'image/png', sizeBytes: 10 }) }))
    expect(result.status).toBe(200)
    expect(imageUpload).toHaveBeenCalledWith(expect.any(Request), { mimeType: 'image/png', sizeBytes: 10 })
  })
})
