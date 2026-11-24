import { redeemInvitation } from './redeemInvitation'
import { z } from 'zod'

export async function activateInvitation(sessionToken: string, invitationToken: string, dependencies: {
  verify: (token: string) => Promise<string>
  getUser: (userId: string) => Promise<{ userId: string; verifiedEmail: string | null }>
  query: (sql: string, params: string[]) => Promise<{ rows: Array<{ user_id: string }> }>
}): Promise<boolean> {
  const userId = await dependencies.verify(sessionToken)
  const identity = await dependencies.getUser(userId)
  if (identity.userId !== userId || !identity.verifiedEmail) return false
  return redeemInvitation(dependencies.query, identity, invitationToken)
}

export async function activateClerkInvitation(sessionToken: string, dependencies: {
  verify: (token: string) => Promise<string>
  getUser: (userId: string) => Promise<{ userId: string; verifiedEmail: string | null; invitationId: string | null }>
  query: (sql: string, params: string[]) => Promise<{ rows: Array<{ user_id: string }> }>
}): Promise<boolean> {
  const userId = await dependencies.verify(sessionToken)
  const identity = await dependencies.getUser(userId)
  if (identity.userId !== userId || !userId.trim() || !identity.verifiedEmail || !z.string().uuid().safeParse(identity.invitationId).success) return false
  const result = await dependencies.query(`
    WITH invitation AS (
      SELECT id FROM arsen_invitations WHERE id = $2 AND email = lower($3) AND accepted_at IS NULL AND expires_at > now() FOR UPDATE
    ), profile AS (
      INSERT INTO arsen_profiles (user_id) SELECT $1 FROM invitation ON CONFLICT (user_id) DO NOTHING RETURNING user_id
    )
    UPDATE arsen_invitations i SET accepted_by = profile.user_id, accepted_at = now()
    FROM invitation, profile WHERE i.id = invitation.id RETURNING profile.user_id
  `, [userId, identity.invitationId!, identity.verifiedEmail])
  if (result.rows.length === 1) return true
  const existing = await dependencies.query(`
    SELECT p.user_id FROM arsen_invitations i JOIN arsen_profiles p ON p.user_id = i.accepted_by
    WHERE i.id = $1 AND i.email = lower($2) AND i.accepted_by = $3 AND i.accepted_at IS NOT NULL
  `, [identity.invitationId!, identity.verifiedEmail, userId])
  return existing.rows.length === 1
}
