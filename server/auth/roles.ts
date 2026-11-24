export async function lookupRole(
  query: (sql: string, params: string[]) => Promise<{ rows: Array<{ role: string }> }>,
  userId: string,
): Promise<'user' | 'admin' | null> {
  const { rows } = await query('SELECT role FROM arsen_profiles WHERE user_id = $1', [userId])
  const role = rows[0]?.role
  return role === 'user' || role === 'admin' ? role : null
}
