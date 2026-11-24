import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { authorizeCatalogImageUpload } from './authorizeImageUpload'

describe('catalog image upload authorization', () => {
  let pg: PGlite
  beforeAll(async () => { pg = new PGlite(); await pg.exec(await readFile('server/migrations/007_catalog_draft_audit.sql', 'utf8')) }, 30_000)
  afterAll(async () => { await pg?.close() })
  const request = (method = 'POST', signed = true) => new Request('https://api.example.test', { method, headers: signed ? { authorization: 'Bearer test' } : {} })
  const sign = vi.fn(async (_input: { pathname: string; mimeType: string; sizeBytes: number }) => ({ uploadUrl: 'https://signed.example.test', imageUrl: 'https://public.example.test/image' }))
  const deps = (role: 'admin' | 'user') => ({ auth: { verify: async () => 'user_admin', role: async () => role }, query: (sql: string, params: string[]) => pg.query<Record<string, unknown>>(sql, params), sign })
  it('requires admin authorization and accepts only a bounded image type and size', async () => {
    sign.mockClear()
    const input = { mimeType: 'image/png', sizeBytes: 4096 }
    expect((await authorizeCatalogImageUpload(request('GET'), input, deps('admin'))).status).toBe(405)
    expect((await authorizeCatalogImageUpload(request('POST', false), input, deps('admin'))).status).toBe(401)
    expect((await authorizeCatalogImageUpload(request(), input, deps('user'))).status).toBe(403)
    expect((await authorizeCatalogImageUpload(request(), { ...input, mimeType: 'image/svg+xml' }, deps('admin'))).status).toBe(400)
    expect((await authorizeCatalogImageUpload(request(), { ...input, sizeBytes: 10485761 }, deps('admin'))).status).toBe(400)
    expect((await authorizeCatalogImageUpload(request(), { ...input, path: '../backup' }, deps('admin'))).status).toBe(400)
    expect(sign).not.toHaveBeenCalled()
  })
  it('generates a unique scoped path and audits the request before signing', async () => {
    sign.mockClear()
    const result = await authorizeCatalogImageUpload(request(), { mimeType: 'image/webp', sizeBytes: 20 }, deps('admin'))
    expect(result).toMatchObject({ status: 200, uploadUrl: 'https://signed.example.test', imageUrl: 'https://public.example.test/image' })
    const input = sign.mock.calls[0]![0] as { pathname: string; mimeType: string; sizeBytes: number }
    expect(input).toMatchObject({ mimeType: 'image/webp', sizeBytes: 20 })
    expect(input.pathname).toMatch(/^catalog\/images\/[0-9a-f-]{36}\.webp$/)
    expect((await pg.query('SELECT actor_id,action FROM arsen_catalog_draft_audit')).rows).toEqual([{ actor_id: 'user_admin', action: 'image.upload.requested' }])
  })
  it('does not issue a signed URL when recording the operation fails', async () => {
    sign.mockClear()
    const dependencies = { ...deps('admin'), query: async () => { throw new Error('audit unavailable') } }
    await expect(authorizeCatalogImageUpload(request(), { mimeType: 'image/png', sizeBytes: 20 }, dependencies)).rejects.toThrow()
    expect(sign).not.toHaveBeenCalled()
  })
})
