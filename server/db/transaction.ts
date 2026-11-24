type Query = (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>
type Connection = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>; release: (destroy?: boolean) => void }

export function createTransactionRunner(pool: { connect: () => Promise<Connection> }) {
  return async <T>(work: (query: Query) => Promise<T>): Promise<T> => {
    const client = await pool.connect()
    let began = false
    let destroy = false
    try {
      await client.query('BEGIN')
      began = true
      const result = await work((sql, params) => client.query(sql, params))
      await client.query('COMMIT')
      began = false
      return result
    } catch (error) {
      if (began) {
        try { await client.query('ROLLBACK') } catch { destroy = true }
      } else destroy = true
      throw error
    } finally { client.release(destroy) }
  }
}
