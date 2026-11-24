import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { createAdminApi } from './api'

describe('admin API client', () => {
  const origin = 'https://api.example.test'
  it('obtains a token for each request and sends it only in an authorization header', async () => {
    const token = vi.fn(async () => 'header.payload.signature')
    const fetcher = vi.fn(async () => Response.json({ accounts: 2, devices: 1, confirmedBackups: 1, publishedExercises: 3 }))
    const api = createAdminApi(origin, token, fetcher)
    expect(await api.overview()).toEqual({ accounts: 2, devices: 1, confirmedBackups: 1, publishedExercises: 3 })
    await api.overview()
    expect(token).toHaveBeenCalledTimes(2)
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${origin}/api/v1/admin/overview`)
    expect(url).not.toContain('header.payload.signature')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer header.payload.signature')
    expect(init).toMatchObject({ redirect: 'error', credentials: 'omit', cache: 'no-store' })
  })
  it('rejects unsafe origins and does not send missing or malformed tokens', async () => {
    expect(() => createAdminApi('http://api.example.test', async () => 'token')).toThrow()
    expect(() => createAdminApi('https://user:pass@api.example.test', async () => 'token')).toThrow()
    const fetcher = vi.fn()
    await expect(createAdminApi(origin, async () => null, fetcher).overview()).rejects.toThrow()
    await expect(createAdminApi(origin, async () => 'token\r\ninjected', fetcher).overview()).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('validates server data and does not expose response details in errors', async () => {
    const badData = createAdminApi(origin, async () => 'token', async () => Response.json({ accounts: -1 }))
    await expect(badData.overview()).rejects.toThrow()
    const failed = createAdminApi(origin, async () => 'token', async () => new Response('sensitive internal data', { status: 403 }))
    await expect(failed.overview()).rejects.toThrow('No tienes permiso')
    try { await failed.overview() } catch (error) { expect(String(error)).not.toContain('sensitive internal data') }
  })
  it('explains how to recover when publishing an incomplete exercise', async () => {
    const api = createAdminApi(origin, async () => 'token', async () => new Response(null, { status: 422 }))
    await expect(api.publish('sentadilla')).rejects.toThrow('Completa el ejercicio y utiliza una imagen verificada')
  })
  it('encodes identifiers and submits a draft with the expected previous version', async () => {
    const fetcher = vi.fn(async () => Response.json({}))
    const api = createAdminApi(origin, async () => 'token', fetcher)
    const draft = { id: 'sentadilla', name: 'Sentadilla', mainMuscle: 'Piernas' as const }
    await api.saveDraft(draft, null)
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`${origin}/api/v1/admin/catalog/drafts`)
    expect(JSON.parse(String(init.body))).toEqual({ draft, expected: null })
    expect(init.method).toBe('POST')
    await expect(api.backups('../other')).rejects.toThrow()
  })
  it('uploads a bounded image only to a signed Vercel URL without sending the session token', async () => {
    const path = '/catalog/images/8166d21c-bac3-497b-9d22-8492474c982b.png'
    const imageUrl = `https://arsentest.public.blob.vercel-storage.com${path}`
    const signed = `https://vercel.com/api/blob/?pathname=${encodeURIComponent(path.slice(1))}&vercel-blob-delegation=abc&vercel-blob-signature=def`
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ uploadUrl: signed, imageUrl }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const api = createAdminApi(origin, async () => 'session.token', fetcher)
    const bytes = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4)
    const image = new Blob([bytes], { type: 'image/png' })
    const result = await api.uploadImage(image)
    expect(result).toEqual({ url: imageUrl, sizeBytes: bytes.length, mimeType: 'image/png', sha256: createHash('sha256').update(bytes).digest('hex') })
    const [url, init] = fetcher.mock.calls[1] as [string, RequestInit]
    expect(url).toBe(signed)
    expect(init.method).toBe('PUT')
    expect(new Headers(init.headers).get('authorization')).toBeNull()
    expect(init).toMatchObject({ redirect: 'error', credentials: 'omit' })
  })
  it('rejects malformed files and untrusted upload destinations', async () => {
    const fetcher = vi.fn(async () => Response.json({ uploadUrl: 'https://evil.example/upload', imageUrl: 'https://evil.example/image.png' }))
    const api = createAdminApi(origin, async () => 'token', fetcher)
    await expect(api.uploadImage(new Blob(['x'], { type: 'image/svg+xml' }))).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
    await expect(api.uploadImage(new Blob(['not an image'], { type: 'image/png' }))).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
    await expect(api.uploadImage(new Blob([Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)], { type: 'image/png' }))).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('does not send image bytes after an upload is cancelled', async () => {
    const path = 'catalog/images/8166d21c-bac3-497b-9d22-8492474c982b.png'
    const signed = `https://vercel.com/api/blob/?pathname=${encodeURIComponent(path)}&vercel-blob-delegation=abc&vercel-blob-signature=def`
    const controller = new AbortController()
    const fetcher = vi.fn(async () => { controller.abort(); return Response.json({ uploadUrl: signed, imageUrl: `https://arsentest.public.blob.vercel-storage.com/${path}` }) })
    const api = createAdminApi(origin, async () => 'token', fetcher)
    await expect(api.uploadImage(new Blob([Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)], { type: 'image/png' }), controller.signal)).rejects.toThrow()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
