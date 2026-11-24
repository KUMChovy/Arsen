import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createCatalogHandler } from './handler'

describe('public catalog HTTP handler', () => {
  let db: PGlite
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/002_catalog.sql', 'utf8'))
    await db.exec('UPDATE arsen_catalog_state SET version = 1')
  }, 30_000)
  afterAll(async () => { await db.close() })

  it('serves version and catalog to guests when explicitly enabled', async () => {
    const handler = createCatalogHandler((sql) => db.query<Record<string, unknown>>(sql), true)
    const version = await handler(new Request('https://api.test/api/v1/catalog/version'))
    expect(await version.json()).toEqual({ version: 1 })
    expect(version.headers.get('access-control-allow-origin')).toBe('*')
    const catalog = await handler(new Request('https://api.test/api/v1/catalog'))
    expect(await catalog.json()).toEqual({ version: 1, exercises: [] })
  })

  it('fails closed when deployment has not explicitly enabled the catalog', async () => {
    const handler = createCatalogHandler(async () => { throw new Error('must not query') }, false)
    expect((await handler(new Request('https://api.test/api/v1/catalog'))).status).toBe(503)
  })
})
