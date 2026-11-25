import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readCatalogVersion, readPublishedCatalog, readHistoricalImage } from './read'

const published = {
  id: 'sinful-shell-press', name: 'Press plano', canonicalName: 'press-plano', mainMuscle: 'Pecho',
  aliases: ['banca'], technicalNotes: 'Controla el movimiento.',
  image: { url: 'https://assets.example.test/press.png', sha256: 'a'.repeat(64), sizeBytes: 1000, mimeType: 'image/png' },
}

describe('public catalog reading', () => {
  let db: PGlite
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/002_catalog.sql', 'utf8'))
    await db.query('UPDATE arsen_catalog_state SET version = 1')
    await db.query('INSERT INTO arsen_catalog_items (id, draft, published) VALUES ($1, $2::jsonb, $3::jsonb)', [published.id, JSON.stringify({ name: 'Unpublished edit' }), JSON.stringify(published)])
    await db.query('INSERT INTO arsen_catalog_items (id, draft) VALUES ($1, $2::jsonb)', ['sinful-shell-draft', '{}'])
    await db.query('INSERT INTO arsen_catalog_items (id, draft, published, archived) VALUES ($1, $2::jsonb, $2::jsonb, true)', ['sinful-shell-archived', JSON.stringify({ ...published, id: 'sinful-shell-archived' })])
  }, 30_000)
  afterAll(async () => { await db.close() })

  it('returns only the published snapshot and an ETag for guests', async () => {
    const query = (sql: string) => db.query<Record<string, unknown>>(sql)
    const response = await readPublishedCatalog(new Request('https://api.test/catalog'), query)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ version: 1, exercises: [published] })
    expect(response.headers.get('etag')).toBe('"catalog-1"')
  })

  it('returns the lightweight version to guests and denies writes', async () => {
    const query = (sql: string) => db.query<Record<string, unknown>>(sql)
    const response = await readCatalogVersion(new Request('https://api.test/catalog/version'), query)
    expect(await response.json()).toEqual({ version: 1 })
    expect((await readCatalogVersion(new Request('https://api.test/catalog/version', { method: 'POST' }), query)).status).toBe(405)
  })

  it('returns 304 when the client already has the current version', async () => {
    const query = (sql: string) => db.query<Record<string, unknown>>(sql)
    const response = await readPublishedCatalog(new Request('https://api.test/catalog', { headers: { 'if-none-match': '"catalog-1"' } }), query)
    expect(response.status).toBe(304)
    expect(await response.text()).toBe('')
  })

  it('rejects write methods on the public reader', async () => {
    const response = await readPublishedCatalog(new Request('https://api.test/catalog', { method: 'POST' }), (sql) => db.query<Record<string, unknown>>(sql))
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET')
  })

  it('uses the snapshot version for ETag if publication occurs between queries', async () => {
    let calls = 0
    const query = async (sql: string) => {
      calls++
      if (calls === 2) await db.exec('UPDATE arsen_catalog_state SET version = 2')
      return db.query<Record<string, unknown>>(sql)
    }
    const response = await readPublishedCatalog(new Request('https://api.test/catalog'), query)
    expect(response.headers.get('etag')).toBe('"catalog-2"')
    expect(await response.json()).toEqual({ version: 2, exercises: [published] })
  })
  it('returns image metadata from an archived publication but never from a draft', async () => {
    await db.query("INSERT INTO arsen_catalog_changes (version, item_id, action, actor_id, payload) VALUES (3, $1, 'publish', 'admin', $2::jsonb)", ['sinful-shell-archived', JSON.stringify({ ...published, id: 'sinful-shell-archived' })])
    const query = (sql: string, params: string[]) => db.query<Record<string, unknown>>(sql, params)
    const response = await readHistoricalImage(new Request('https://api.test'), published.image.sha256, query)
    expect(await response.json()).toEqual({ image: published.image })
    expect((await readHistoricalImage(new Request('https://api.test'), 'bad', query)).status).toBe(400)
    expect((await readHistoricalImage(new Request('https://api.test'), 'b'.repeat(64), query)).status).toBe(404)
  })
})
