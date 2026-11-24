import { z } from 'zod'

type Query = (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>

// Solo para una identidad verificada consultada directamente de Clerk Development; nunca exponer como ruta.
export async function bootstrapDevelopmentAdmin(identity: { environment: string; userId: string; verifiedEmail: string | null }, transaction: <T>(work: (query: Query) => Promise<T>) => Promise<T>): Promise<boolean> {
  if (identity.environment !== 'development' || !/^user_[A-Za-z0-9]+$/.test(identity.userId) || !z.string().email().max(254).safeParse(identity.verifiedEmail).success) return false
  return transaction(async (query) => {
    await query('LOCK TABLE arsen_profiles IN EXCLUSIVE MODE', [])
    const existing = await query('SELECT user_id FROM arsen_profiles LIMIT 1', [])
    if (existing.rows.length) return false
    await query("INSERT INTO arsen_profiles (user_id, role) VALUES ($1, 'admin')", [identity.userId])
    return true
  })
}
