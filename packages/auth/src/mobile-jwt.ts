import { SignJWT, jwtVerify } from "jose"

const ALGORITHM = "HS256"
const ISSUER = "pulse-mobile"
const TOKEN_TTL = "30d"

function getSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET
  if (!raw) throw new Error("AUTH_SECRET env var is required for mobile JWT signing")
  return new TextEncoder().encode(raw)
}

export type MobilePayload = { userId: string; email: string }

export async function signMobileToken(payload: MobilePayload): Promise<string> {
  return await new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(payload.userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(getSecret())
}

export async function verifyMobileToken(token: string): Promise<MobilePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: ISSUER })
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null
    return { userId: payload.sub, email: payload.email }
  } catch {
    return null
  }
}
