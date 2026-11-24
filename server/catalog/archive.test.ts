import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { archiveCatalogExercise } from './archive'

describe('archiving catalog entries', () => {
  let pg: PGlite
  const item = { id: 'ejercicio-prueba', name: 'Ejercicio' }
  beforeEach(async () => {
    pg = new PGlite()
    await pg.exec(await readFile('server/migrations/002_catalog.sql', 'utf8'))
    await pg.query('INSERT INTO arsen_catalog_items (id, draft, published) VALUES ($1, $2::jsonb, $2::jsonb)', [item.id, JSON.stringify(item)])
  }, 30_000)
  afterEach(async () => { await pg?.close() })
  const request = (method = 'POST', signed = true) => new Request('https://api.example.test', { method, headers: signed ? { authorization: 'Bearer test' } : {} })
  const deps = (role: 'admin' | 'user') => ({ auth: { verify: async () => 'user_admin', role: async () => role }, query: (sql: string, params: string[]) => pg.query<Record<string, unknown>>(sql, params) })

  it('requires an authorized administrator and a published entry', async () => {
    expect((await archiveCatalogExercise(request('GET'), item.id, deps('admin'))).status).toBe(405)
    expect((await archiveCatalogExercise(request('POST', false), item.id, deps('admin'))).status).toBe(401)
    expect((await archiveCatalogExercise(request(), item.id, deps('user'))).status).toBe(403)
    expect((await archiveCatalogExercise(request(), 'missing-item', deps('admin'))).status).toBe(404)
    expect((await pg.query('SELECT version FROM arsen_catalog_state')).rows).toEqual([{ version: 0 }])
  })

  it('archives once and records a new version with the actor', async () => {
    expect(await archiveCatalogExercise(request(), item.id, deps('admin'))).toEqual({ status: 200, version: 1 })
    expect((await pg.query('SELECT archived, published FROM arsen_catalog_items')).rows).toEqual([{ archived: true, published: item }])
    expect((await pg.query('SELECT version::text, action, actor_id, payload FROM arsen_catalog_changes')).rows).toEqual([{ version: '1', action: 'archive', actor_id: 'user_admin', payload: null }])
    expect((await archiveCatalogExercise(request(), item.id, deps('admin'))).status).toBe(409)
    expect((await pg.query('SELECT version FROM arsen_catalog_state')).rows).toEqual([{ version: 1 }])
  })

  it('rolls back the archive and version when recording the change fails', async () => {
    await pg.exec("ALTER TABLE arsen_catalog_changes ADD CONSTRAINT no_archives CHECK (action <> 'archive')")
    await expect(archiveCatalogExercise(request(), item.id, deps('admin'))).rejects.toThrow()
    expect((await pg.query('SELECT archived FROM arsen_catalog_items')).rows).toEqual([{ archived: false }])
    expect((await pg.query('SELECT version FROM arsen_catalog_state')).rows).toEqual([{ version: 0 }])
  })
})
