type Query = (sql: string, params: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>

// Solo debe llamarse desde mantenimiento autenticado; la instantánea local no se elimina aquí.
export async function expireOnePendingBackup(dependencies: {
  transaction: <T>(work: (query: Query) => Promise<T>) => Promise<T>
}): Promise<{ status: 'idle' | 'expired' }> {
  const candidate = await dependencies.transaction(async (query) => (await query("SELECT id::text, user_id FROM arsen_backups WHERE status = 'pending' AND created_at <= clock_timestamp() - interval '7 days' ORDER BY created_at, id LIMIT 1", [])).rows[0])
  if (!candidate) return { status: 'idle' }
  if (typeof candidate.id !== 'string' || typeof candidate.user_id !== 'string') throw new Error('Respaldo pendiente inválido')
  const { id, user_id: userId } = candidate
  return dependencies.transaction(async (query) => {
    await query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [userId])
    const profile = (await query('SELECT user_id FROM arsen_profiles WHERE user_id = $1 FOR UPDATE', [userId])).rows[0]
    if (!profile) return { status: 'idle' }
    const result = await query(`
      WITH removed AS (
        DELETE FROM arsen_backups WHERE id = $1 AND user_id = $2 AND status = 'pending'
          AND created_at <= clock_timestamp() - interval '7 days' RETURNING id, user_id
      )
      INSERT INTO arsen_backup_cleanup (backup_id, user_id, not_before)
      SELECT id, user_id, clock_timestamp() + interval '1 hour' FROM removed RETURNING backup_id
    `, [id, userId])
    return { status: result.rows.length ? 'expired' : 'idle' }
  })
}
