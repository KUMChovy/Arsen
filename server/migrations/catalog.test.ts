import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

describe('global catalog schema', () => {
  let db: PGlite
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/002_catalog.sql', 'utf8'))
  }, 30_000)
  afterAll(async () => { await db?.close() })

  it('keeps drafts and published data separate and enforces stable unique IDs', async () => {
    await db.query('INSERT INTO arsen_catalog_items (id, draft) VALUES ($1, $2::jsonb)', ['sinful-shell-press', JSON.stringify({ name: 'Borrador' })])
    const rows = (await db.query('SELECT id, draft, published, archived FROM arsen_catalog_items')).rows
    expect(rows).toEqual([{ id: 'sinful-shell-press', draft: { name: 'Borrador' }, published: null, archived: false }])
    await expect(db.query('INSERT INTO arsen_catalog_items (id, draft) VALUES ($1, $2::jsonb)', ['sinful-shell-press', '{}'])).rejects.toThrow()
    await expect(db.query('INSERT INTO arsen_catalog_items (id, draft) VALUES ($1, $2::jsonb)', ['bad id', '{}'])).rejects.toThrow()
    await expect(db.query('INSERT INTO arsen_catalog_items (id, draft) VALUES ($1, $2::jsonb)', ['valid-id', '[]'])).rejects.toThrow()
  })

  it('starts at version zero and rejects invalid change history', async () => {
    expect((await db.query('SELECT version::text AS version FROM arsen_catalog_state')).rows).toEqual([{ version: '0' }])
    await expect(db.query("INSERT INTO arsen_catalog_changes (version, item_id, action, actor_id, payload) VALUES (1, 'missing', 'publish', 'admin', '{}')")).rejects.toThrow()
    await expect(db.query("INSERT INTO arsen_catalog_changes (version, item_id, action, actor_id, payload) VALUES (0, 'sinful-shell-press', 'publish', 'admin', '{}')")).rejects.toThrow()
    await expect(db.query("INSERT INTO arsen_catalog_changes (version, item_id, action, actor_id) VALUES (1, 'sinful-shell-press', 'delete', 'admin')")).rejects.toThrow()
    await expect(db.query("INSERT INTO arsen_catalog_changes (version, item_id, action, actor_id) VALUES (1, 'sinful-shell-press', 'publish', 'admin')")).rejects.toThrow()
    await db.query("INSERT INTO arsen_catalog_changes (version, item_id, action, actor_id, payload) VALUES (1, 'sinful-shell-press', 'publish', 'admin', '{\"name\":\"Primera\"}')")
    expect((await db.query('SELECT payload FROM arsen_catalog_changes WHERE version = 1')).rows).toEqual([{ payload: { name: 'Primera' } }])
  })
})
