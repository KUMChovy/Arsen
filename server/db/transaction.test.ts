import { describe, expect, it, vi } from 'vitest'
import { createTransactionRunner } from './transaction'

describe('interactive database transaction', () => {
  it('commits and releases the connection after successful work', async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] }))
    const release = vi.fn()
    const run = createTransactionRunner({ connect: async () => ({ query, release }) })
    await expect(run(async (execute) => { await execute('SELECT $1', ['value']); return 'done' })).resolves.toBe('done')
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'SELECT $1', 'COMMIT'])
    expect(release).toHaveBeenCalledOnce()
  })
  it('rolls back and releases the connection on failure', async () => {
    const query = vi.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] }))
    const release = vi.fn()
    const run = createTransactionRunner({ connect: async () => ({ query, release }) })
    await expect(run(async () => { throw new Error('operation failed') })).rejects.toThrow('operation failed')
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'ROLLBACK'])
    expect(release).toHaveBeenCalledOnce()
  })
  it('does not replace the original error if rollback also fails', async () => {
    const query = vi.fn(async (sql: string) => { if (sql === 'ROLLBACK') throw new Error('rollback failed'); return { rows: [] } })
    const release = vi.fn()
    const run = createTransactionRunner({ connect: async () => ({ query, release }) })
    await expect(run(async () => { throw new Error('operation failed') })).rejects.toThrow('operation failed')
    expect(release).toHaveBeenCalledWith(true)
  })
  it('discards the connection if starting a transaction fails', async () => {
    const release = vi.fn()
    const run = createTransactionRunner({ connect: async () => ({ query: async () => { throw new Error('begin failed') }, release }) })
    await expect(run(async () => 'unused')).rejects.toThrow('begin failed')
    expect(release).toHaveBeenCalledWith(true)
  })
})
