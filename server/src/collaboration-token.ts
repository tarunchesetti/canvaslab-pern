import { SignJWT, jwtVerify } from 'jose'

function tokenKey(secret: string) {
  return new TextEncoder().encode(secret)
}

export function createCollaborationToken(userId: string, secret: string): Promise<string> {
  return new SignJWT({ purpose: 'canvaslab-collaboration' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(tokenKey(secret))
}

export async function verifyCollaborationToken(token: string, secret: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, tokenKey(secret), { algorithms: ['HS256'] })
    return payload.purpose === 'canvaslab-collaboration' && typeof payload.sub === 'string'
      ? payload.sub
      : null
  } catch {
    return null
  }
}