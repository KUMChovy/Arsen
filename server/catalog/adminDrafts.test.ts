import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { listCatalogDrafts, saveCatalogDraft } from './adminDrafts'

describe('admin catalog drafts', () => {
  let pg: PGlite
  const draft = { id: 'sentadilla-prueba', name: 'Sentadilla', mainMuscle: 'Piernas' }
  beforeAll(async () => {
    pg = new PGlite()
    for (const name of ['002_catalog.sql', '007_catalog_draft_audit.sql']) await pg.exec(await readFile(`server/migrations/${name}`, 'utf8'))
  }, 30_000)
  afterAll(async () => { await pg?.close() })
  const request = (method: string, token = true) => new Request('https://api.example.test', { method, headers: token ? { authorization: 'Bearer test' } : {} })
  const deps = (role: 'admin' | 'user' | null) => ({
    auth: { verify: async () => 'user_admin', role: async () => role },
    query: (sql: string, params: unknown[]) => pg.query<Record<string, unknown>>(sql, params),
  })

  it('requires an administrator and validates the draft before writing', async () => {
    expect((await saveCatalogDraft(request('POST', false), { draft, expected: null }, deps('admin'))).status).toBe(401)
    expect((await saveCatalogDraft(request('POST'), { draft, expected: null }, deps('user'))).status).toBe(403)
    expect((await saveCatalogDraft(request('GET'), { draft, expected: null }, deps('admin'))).status).toBe(405)
    expect((await saveCatalogDraft(request('POST'), { draft: { ...draft, id: '../x' }, expected: null }, deps('admin'))).status).toBe(400)
    expect((await saveCatalogDraft(request('POST'), { draft: { ...draft, extra: 'x' }, expected: null }, deps('admin'))).status).toBe(400)
    expect((await listCatalogDrafts(request('GET'), null, deps('user'))).status).toBe(403)
    expect((await pg.query('SELECT id FROM arsen_catalog_items')).rows).toEqual([])
  })

  it('creates and edits drafts without publishing or changing catalog version', async () => {
    expect((await saveCatalogDraft(request('POST'), { draft, expected: null }, deps('admin'))).status).toBe(201)
    const updated = { ...draft, name: 'Sentadilla pausada' }
    expect((await saveCatalogDraft(request('POST'), { draft: updated, expected: draft }, deps('admin'))).status).toBe(200)
    expect((await saveCatalogDraft(request('POST'), { draft, expected: draft }, deps('admin'))).status).toBe(409)
    expect((await saveCatalogDraft(request('POST'), { draft, expected: null }, deps('admin'))).status).toBe(409)
    const list = await listCatalogDrafts(request('GET'), null, deps('admin'))
    expect(list).toMatchObject({ status: 200, items: [{ id: draft.id, draft: updated, published: null, archived: false }] })
    expect((await listCatalogDrafts(request('GET'), draft.id, deps('admin')))).toMatchObject({ status: 200, items: [] })
    expect((await pg.query('SELECT version FROM arsen_catalog_state')).rows).toEqual([{ version: 0 }])
    expect((await pg.query('SELECT actor_id, action, target_id FROM arsen_catalog_draft_audit ORDER BY id')).rows).toEqual([
      { actor_id: 'user_admin', action: 'draft.save', target_id: draft.id },
      { actor_id: 'user_admin', action: 'draft.save', target_id: draft.id },
    ])
  })

  it('rolls back a draft change if audit insertion fails', async () => {
    await pg.exec("ALTER TABLE arsen_catalog_draft_audit ADD CONSTRAINT reject_test CHECK (target_id <> 'prueba-rechazada')")
    await expect(saveCatalogDraft(request('POST'), { draft: { ...draft, id: 'prueba-rechazada' }, expected: null }, deps('admin'))).rejects.toThrow()
    expect((await pg.query("SELECT id FROM arsen_catalog_items WHERE id = 'prueba-rechazada'")).rows).toEqual([])
  })

  it('preserves an already published snapshot while a draft is edited', async () => {
    const previous = { ...draft, name: 'Sentadilla pausada' }
    await pg.query('UPDATE arsen_catalog_items SET published = $1::jsonb WHERE id = $2', [JSON.stringify(draft), draft.id])
    const edited = { ...previous, technicalNotes: 'Borrador no publicado' }
    expect((await saveCatalogDraft(request('POST'), { draft: edited, expected: previous }, deps('admin'))).status).toBe(200)
    expect((await pg.query('SELECT draft, published FROM arsen_catalog_items WHERE id = $1', [draft.id])).rows).toEqual([{ draft: edited, published: draft }])
    expect((await pg.query('SELECT version FROM arsen_catalog_state')).rows).toEqual([{ version: 0 }])
  })

  it('searches and filters the complete catalog only for administrators', async () => {
    const query = (text: string) => new Request(`https://api.example.test/?${text}`, { headers: { authorization: 'Bearer test' } })
    const found = await listCatalogDrafts(query('q=pausada&status=published'), null, deps('admin'))
    expect(found).toMatchObject({ status: 200, items: [{ id: draft.id }] })
    expect(await listCatalogDrafts(query('q=pausada&status=archived'), null, deps('admin'))).toMatchObject({ status: 200, items: [] })
    expect((await listCatalogDrafts(query('q=pausada'), null, deps('user'))).status).toBe(403)
    expect((await listCatalogDrafts(query('status=invalid'), null, deps('admin'))).status).toBe(400)
    expect(await listCatalogDrafts(query('muscle=Piernas'), null, deps('admin'))).toMatchObject({ status: 200, items: [{ id: draft.id }] })
    expect(await listCatalogDrafts(query('muscle=Pecho'), null, deps('admin'))).toMatchObject({ status: 200, items: [] })
    expect((await listCatalogDrafts(query('muscle=invalid'), null, deps('admin'))).status).toBe(400)
    expect((await listCatalogDrafts(query('muscle=Piernas&muscle=Pecho'), null, deps('admin'))).status).toBe(400)
  })
})
