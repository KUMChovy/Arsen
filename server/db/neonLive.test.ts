import { describe, expect, it } from 'vitest'
import { createNeonTransactionRunner } from './neonTransaction'

describe.skipIf(process.env.RUN_NEON_LIVE_CHECK !== '1')('Neon interactive connection smoke test', () => {
  it('executes an interactive transaction and rolls back on failure', async () => {
    if (!process.env.DATABASE_URL) throw new Error('Falta la conexión de prueba')
    const db = createNeonTransactionRunner(process.env.DATABASE_URL)
    try {
      let backend: unknown
      await expect(db.run(async (query) => {
        backend = (await query('SELECT pg_backend_pid() AS pid', [])).rows[0]?.pid
        await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', ['arsen-development-smoke'])
        await query('CREATE TEMP TABLE arsen_transaction_smoke (value integer)', [])
        await query('INSERT INTO arsen_transaction_smoke (value) VALUES ($1)', [7])
        const result = await query('SELECT value FROM arsen_transaction_smoke', [])
        expect(result.rows).toEqual([{ value: 7 }])
        throw new Error('expected rollback')
      })).rejects.toThrow('expected rollback')
      const result = await db.run((query) => query("SELECT pg_backend_pid() AS pid, to_regclass('pg_temp.arsen_transaction_smoke') IS NULL AS removed", []))
      expect(result.rows).toEqual([{ pid: backend, removed: true }])
    } finally { await db.close() }
  }, 30_000)
})
