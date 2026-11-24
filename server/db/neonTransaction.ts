import { Pool } from '@neondatabase/serverless'
import { createTransactionRunner } from './transaction'

export function createNeonTransactionRunner(connectionString: string) {
  const pool = new Pool({ connectionString })
  const run = createTransactionRunner({ connect: async () => {
    const client = await pool.connect()
    return { query: async (text, params) => ({ rows: (await client.query(text, params)).rows }), release: (destroy) => client.release(destroy) }
  } })
  return { run, close: () => pool.end() }
}
