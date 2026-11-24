import { jwtVerify, type JWTVerifyGetKey } from 'jose'

export function createClerkVerifier({ issuer, authorizedParties, allowMissingAzp = false, jwks, getSession }: {
  issuer: string
  authorizedParties: string[]
  allowMissingAzp?: boolean
  jwks: JWTVerifyGetKey
  getSession: (id: string) => Promise<{ id: string; userId: string; status: string }>
}) {
  if (!issuer || (!allowMissingAzp && authorizedParties.length === 0)) throw new Error('La configuración de Clerk está incompleta')
  return async (token: string): Promise<string> => {
    const { payload } = await jwtVerify(token, jwks, { issuer, algorithms: ['RS256'], requiredClaims: ['sub', 'sid', 'exp', 'nbf'] })
    if (typeof payload.sub !== 'string' || !payload.sub.trim() || typeof payload.sid !== 'string' || !payload.sid.trim()) throw new Error('La sesión no identifica al usuario')
    if (payload.azp === undefined ? !allowMissingAzp : typeof payload.azp !== 'string' || !authorizedParties.includes(payload.azp)) throw new Error('Origen no autorizado')
    if (payload.sts !== undefined && payload.sts !== 'active') throw new Error('La sesión no está activa')
    const session = await getSession(payload.sid)
    if (session.id !== payload.sid || session.userId !== payload.sub || session.status !== 'active') throw new Error('La sesión no está activa')
    return payload.sub
  }
}
