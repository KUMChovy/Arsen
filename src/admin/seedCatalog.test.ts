import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { seedCatalog } from './seedCatalog'

const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1])
const hash = createHash('sha256').update(bytes).digest('hex')
const item = { id: 'sinful-shell-test', name: 'Prueba', canonicalName: 'prueba', mainMuscle: 'Pecho', aliases: [], technicalNotes: 'Controla.', image: { localPath: 'src/assets/ejercicios/test--pecho.png', sha256: hash, sizeBytes: bytes.length, mimeType: 'image/png' } }

describe('initial catalog upload', () => {
  it('checks image integrity before issuing any administrative write', async () => {
    const api = { drafts: vi.fn(), uploadImage: vi.fn(), saveDraft: vi.fn(), publish: vi.fn() }
    await expect(seedCatalog(api, [item], [new File(['bad'], 'test--pecho.png', { type: 'image/png' })])).rejects.toThrow()
    expect(api.uploadImage).not.toHaveBeenCalled()
    expect(api.saveDraft).not.toHaveBeenCalled()
  })
  it('does not overwrite an exercise already present in the catalog', async () => {
    const api = { drafts: vi.fn(async () => ({ items: [{ id: item.id }], nextCursor: null })), uploadImage: vi.fn(), saveDraft: vi.fn(), publish: vi.fn() }
    const file = new File([bytes], 'test--pecho.png', { type: 'image/png' })
    const result = await seedCatalog(api, [item], [file])
    expect(result.skipped).toBe(1)
    expect(api.uploadImage).not.toHaveBeenCalled()
    expect(api.saveDraft).not.toHaveBeenCalled()
  })
  it('resumes a matching unpublished draft without uploading it again', async () => {
    const { image, ...exercise } = item
    const draft = { ...exercise, image: { url: 'https://assets.example.test/test.png', sha256: image.sha256, sizeBytes: image.sizeBytes, mimeType: image.mimeType } }
    const api = { drafts: vi.fn(async () => ({ items: [{ id: item.id, draft, published: null, archived: false }], nextCursor: null })), uploadImage: vi.fn(), saveDraft: vi.fn(), publish: vi.fn(async () => ({})) }
    const result = await seedCatalog(api, [item], [new File([bytes], 'test--pecho.png', { type: 'image/png' })])
    expect(result.published).toBe(1)
    expect(api.publish).toHaveBeenCalledWith(item.id)
    expect(api.uploadImage).not.toHaveBeenCalled()
  })
  it('uploads, saves a draft, and publishes a new verified exercise', async () => {
    const remote = { url: 'https://assets.example.test/test.png', sha256: hash, sizeBytes: bytes.length, mimeType: 'image/png' }
    const api = { drafts: vi.fn(async () => ({ items: [], nextCursor: null })), uploadImage: vi.fn(async () => remote), saveDraft: vi.fn(async () => ({})), publish: vi.fn(async () => ({})) }
    const result = await seedCatalog(api, [item], [new File([bytes], 'test--pecho.png', { type: 'image/png' })])
    expect(result).toEqual({ published: 1, skipped: 0 })
    expect(api.saveDraft).toHaveBeenCalledWith(expect.objectContaining({ id: item.id, image: remote }), null)
    expect(api.publish).toHaveBeenCalledWith(item.id)
  })
  it('rejects a pagination cycle without publishing anything', async () => {
    let calls = 0
    const api = { drafts: vi.fn(async (cursor?: string) => { if (++calls > 4) throw new Error('límite de prueba'); return { items: [], nextCursor: cursor === 'page-a' ? 'page-b' : 'page-a' } }), uploadImage: vi.fn(), saveDraft: vi.fn(), publish: vi.fn() }
    await expect(seedCatalog(api, [item], [new File([bytes], 'test--pecho.png', { type: 'image/png' })])).rejects.toThrow(/paginación/i)
    expect(api.publish).not.toHaveBeenCalled()
  })
})
