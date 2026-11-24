import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createAdminApi } from '../../src/admin/api'
import { createCatalogDraftHandler } from './adminDraftHandler'
import { listCatalogDrafts, saveCatalogDraft } from './adminDrafts'
import { archiveCatalogExercise } from './archive'
import { publishCatalogExercise } from './publish'
import { createCatalogImageVerifier } from './verifyImage'

describe('administrative catalog flow', () => {
  let pg: PGlite
  beforeAll(async () => {
    pg = new PGlite()
    for (const name of ['002_catalog.sql', '007_catalog_draft_audit.sql']) await pg.exec(await readFile(`server/migrations/${name}`, 'utf8'))
  }, 30_000)
  afterAll(async () => { await pg?.close() })

  it('creates, publishes, archives and restores an exercise with role checks', async () => {
    const bytes = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4)
    const image = { url: 'https://arsentest.public.blob.vercel-storage.com/catalog/images/fixture.png', sha256: createHash('sha256').update(bytes).digest('hex'), sizeBytes: bytes.length, mimeType: 'image/png' as const }
    const draft = { id: 'sentadilla-prueba', name: 'Sentadilla', canonicalName: 'sentadilla', mainMuscle: 'Piernas' as const, aliases: [], technicalNotes: 'Mantén el control.', image }
    const auth = { verify: async (token: string) => token === 'admin.token' ? 'user_admin' : 'user_member', role: async (userId: string) => userId === 'user_admin' ? 'admin' as const : 'user' as const }
    const query = (sql: string, params: string[]) => pg.query<Record<string, unknown>>(sql, params)
    const verifyImage = createCatalogImageVerifier('https://arsentest.public.blob.vercel-storage.com', async () => new Response(bytes, { headers: { 'content-type': 'image/png' } }))
    const handler = createCatalogDraftHandler({
      list: (request, cursor) => listCatalogDrafts(request, cursor, { auth, query }),
      save: (request, input) => saveCatalogDraft(request, input, { auth, query }),
      archive: (request, input) => archiveCatalogExercise(request, (input as { id: string }).id, { auth, query }),
      publish: (request, input) => publishCatalogExercise(request, (input as { id: string }).id, { auth, query, verifyImage }),
      imageUpload: async () => ({ status: 503 }),
    }, [])
    const fetcher: typeof fetch = (url, init) => handler(new Request(url, init))
    const admin = createAdminApi('https://api.example.test', async () => 'admin.token', fetcher)
    const member = createAdminApi('https://api.example.test', async () => 'member.token', fetcher)
    await expect(member.drafts()).rejects.toThrow('No tienes permiso')
    await admin.saveDraft(draft, null)
    expect((await admin.drafts()).items[0]).toMatchObject({ id: draft.id, draft, published: null, archived: false })
    expect(await admin.publish(draft.id)).toEqual({ version: 1 })
    expect(await admin.archive(draft.id)).toEqual({ version: 2 })
    expect(await admin.publish(draft.id)).toEqual({ version: 3 })
    expect((await admin.drafts()).items[0]).toMatchObject({ id: draft.id, published: draft, archived: false })
    expect((await pg.query('SELECT action, actor_id FROM arsen_catalog_changes ORDER BY version')).rows).toEqual([
      { action: 'publish', actor_id: 'user_admin' }, { action: 'archive', actor_id: 'user_admin' }, { action: 'publish', actor_id: 'user_admin' },
    ])
  }, 30_000)
})
