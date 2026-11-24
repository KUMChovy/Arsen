import { jwtVerify, type JWTVerifyGetKey } from 'jose'

export function createTokenVerifier({ issuer, audience, jwks }: {
  issuer: string
  audience: string
  jwks: JWTVerifyGetKey
}) {
  if (!issuer || !audience) throw new Error('La configuración de autenticación está incompleta')

  return async (token: string): Promise<string> => {
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience,
      requiredClaims: ['sub', 'exp'],
    })
    if (typeof payload.sub !== 'string' || !payload.sub.trim()) throw new Error('La sesión no identifica al usuario')
    return payload.sub
  }
}
