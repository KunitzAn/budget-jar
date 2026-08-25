import { SignJWT, jwtVerify } from 'jose'

export async function signToken(payload: { userId: number }, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret)
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .sign(key)
}

export async function verifyToken(token: string, secret: string): Promise<{ userId: number }> {
  const key = new TextEncoder().encode(secret)
  const { payload } = await jwtVerify(token, key)
  return payload as { userId: number }
}
