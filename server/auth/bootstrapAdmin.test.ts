import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { bootstrapDevelopmentAdmin } from './bootstrapAdmin'

describe('development administrator bootstrap', () => {
  let db: PGlite
  beforeAll(async () => { db = new PGlite(); await db.exec(await readFile('server/migrations/001_accounts.sql', 'utf8')) }, 30_000)
  afterAll(async () => { await db?.close() })
  const transaction = <T>(fn: (query: (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => db.transaction((tx) => fn((sql, params) => tx.query(sql, params)))
  it('rejects production, unverified email and malformed IDs without creating profiles', async () => {
    await expect(bootstrapDevelopmentAdmin({ environment: 'production', userId: 'user_a', verifiedEmail: 'a@example.test' }, transaction)).resolves.toBe(false)
    await expect(bootstrapDevelopmentAdmin({ environment: 'development', userId: 'user_a', verifiedEmail: null }, transaction)).resolves.toBe(false)
    await expect(bootstrapDevelopmentAdmin({ environment: 'development', userId: 'bad', verifiedEmail: 'a@example.test' }, transaction)).resolves.toBe(false)
    expect((await db.query('SELECT user_id FROM arsen_profiles')).rows).toEqual([])
  })
  it('creates at most one administrator and never upgrades an existing profile', async () => {
    const identity = { environment: 'development', userId: 'user_a', verifiedEmail: 'a@example.test' }
    const results = await Promise.all([bootstrapDevelopmentAdmin(identity, transaction), bootstrapDevelopmentAdmin({ ...identity, userId: 'user_b' }, transaction)])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect((await db.query('SELECT role FROM arsen_profiles')).rows).toEqual([{ role: 'admin' }])
  })
})
