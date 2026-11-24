import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { publishCatalogExercise } from './publish'

const exercise = {
  id: 'sinful-shell-press', name: 'Press plano', canonicalName: 'press-plano', mainMuscle: 'Pecho',
  aliases: ['banca'], technicalNotes: 'Controla el movimiento.',
  image: { url: 'https://assets.example.test/press.png', sha256: 'a'.repeat(64), sizeBytes: 1000, mimeType: 'image/png' },
}

describe('catalog publication', () => {
  let db: PGlite
  beforeEach(async () => {
    db = new PGlite()
    await db.exec(await readFile('server/migrations/002_catalog.sql', 'utf8'))
    await db.query('INSERT INTO arsen_catalog_items (id, draft) VALUES ($1, $2::jsonb)', [exercise.id, JSON.stringify(exercise)])
  }, 30_000)
  afterEach(async () => { await db.close() })

  function dependencies(role: 'user' | 'admin', verifyImage: () => Promise<boolean>) {
    return {
      query: (sql: string, params: string[]) => db.query<Record<string, unknown>>(sql, params),
      auth: { verify: async () => 'user-a', role: async () => role },
      verifyImage,
    }
  }
  const request = () => new Request('https://api.test', { method: 'POST', headers: { authorization: 'Bearer token' } })

  it('denies non-admins and unavailable images without changing the public catalog', async () => {
    expect(await publishCatalogExercise(request(), exercise.id, dependencies('user', async () => true))).toEqual({ status: 403 })
    expect(await publishCatalogExercise(request(), exercise.id, dependencies('admin', async () => false))).toEqual({ status: 422 })
    expect((await db.query('SELECT version::text FROM arsen_catalog_state')).rows).toEqual([{ version: '0' }])
    expect((await db.query('SELECT published FROM arsen_catalog_items')).rows).toEqual([{ published: null }])
  })

  it('rejects a GET request before changing the catalog', async () => {
    const get = new Request('https://api.test', { headers: { authorization: 'Bearer token' } })
    expect(await publishCatalogExercise(get, exercise.id, dependencies('admin', async () => true))).toEqual({ status: 405 })
    expect((await db.query('SELECT version::text FROM arsen_catalog_state')).rows).toEqual([{ version: '0' }])
  })

  it('publishes the validated version and records the administrator and history atomically', async () => {
    expect(await publishCatalogExercise(request(), exercise.id, dependencies('admin', async () => true))).toEqual({ status: 200, version: 1 })
    expect((await db.query('SELECT published FROM arsen_catalog_items')).rows).toEqual([{ published: exercise }])
    expect((await db.query('SELECT version::text, item_id, action, actor_id, payload FROM arsen_catalog_changes')).rows)
      .toEqual([{ version: '1', item_id: exercise.id, action: 'publish', actor_id: 'user-a', payload: exercise }])
  })

  it('does not publish a draft changed while its image is verified', async () => {
    const changed = { ...exercise, name: 'Cambio pendiente' }
    const verifyImage = async () => {
      await db.query('UPDATE arsen_catalog_items SET draft = $1::jsonb WHERE id = $2', [JSON.stringify(changed), exercise.id])
      return true
    }
    expect(await publishCatalogExercise(request(), exercise.id, dependencies('admin', verifyImage))).toEqual({ status: 409 })
    expect((await db.query('SELECT version::text FROM arsen_catalog_state')).rows).toEqual([{ version: '0' }])
    expect((await db.query('SELECT published FROM arsen_catalog_items')).rows).toEqual([{ published: null }])
  })

  it('rolls back publication and version when audit insertion fails', async () => {
    const deps = dependencies('admin', async () => true)
    deps.auth.verify = async () => ' '
    await expect(publishCatalogExercise(request(), exercise.id, deps)).rejects.toThrow()
    expect((await db.query('SELECT version::text FROM arsen_catalog_state')).rows).toEqual([{ version: '0' }])
    expect((await db.query('SELECT published FROM arsen_catalog_items')).rows).toEqual([{ published: null }])
    expect((await db.query('SELECT version FROM arsen_catalog_changes')).rows).toEqual([])
  })

  it('keeps the old catalog when version state is missing', async () => {
    await db.exec('DELETE FROM arsen_catalog_state')
    expect(await publishCatalogExercise(request(), exercise.id, dependencies('admin', async () => true))).toEqual({ status: 409 })
    expect((await db.query('SELECT published FROM arsen_catalog_items')).rows).toEqual([{ published: null }])
    expect((await db.query('SELECT version FROM arsen_catalog_changes')).rows).toEqual([])
  })
})
