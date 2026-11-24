import { createHash } from 'node:crypto'

// La identidad debe proceder de una consulta autenticada al proveedor, nunca del cliente.
export async function redeemInvitation(
  query: (sql: string, params: string[]) => Promise<{ rows: Array<{ user_id: string }> }>,
  identity: { userId: string; verifiedEmail: string | null },
  token: string,
): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !identity.userId.trim() || !identity.verifiedEmail) return false
  const hash = createHash('sha256').update(token).digest('hex')
  const result = await query(`
    WITH invitation AS (
      SELECT i.id
      FROM arsen_invitations i
      WHERE i.token_sha256 = $2 AND i.email = lower($3) AND i.accepted_at IS NULL AND i.expires_at > now()
      FOR UPDATE OF i
    ), profile AS (
      INSERT INTO arsen_profiles (user_id)
      SELECT $1 FROM invitation
      ON CONFLICT (user_id) DO NOTHING
      RETURNING user_id
    )
    UPDATE arsen_invitations i
    SET accepted_by = profile.user_id, accepted_at = now()
    FROM invitation, profile
    WHERE i.id = invitation.id
    RETURNING profile.user_id
  `, [identity.userId, hash, identity.verifiedEmail])
  return result.rows.length === 1
}
