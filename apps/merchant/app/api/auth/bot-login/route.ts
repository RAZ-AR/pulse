import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "node:crypto"
import { encode } from "@auth/core/jwt"

export const dynamic = "force-dynamic"

// Mirror of verifyBotLoginToken in packages/auth/src/merchant.ts
// but without importing Prisma (not needed here)
function verifyToken(token: string): { merchantId: string } | null {
  const botSecret = process.env.PARTNER_TELEGRAM_BOT_TOKEN
  if (!botSecret) return null

  const dot = token.lastIndexOf(".")
  if (dot < 0) return null

  const payload  = token.slice(0, dot)
  const sig      = token.slice(dot + 1)
  const expected = createHmac("sha256", botSecret).update(payload).digest("base64url")
  if (expected !== sig) return null

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString())
    if (!data.merchantId || data.exp < Math.floor(Date.now() / 1000)) return null
    return { merchantId: data.merchantId }
  } catch { return null }
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token") ?? ""

  const verified = verifyToken(token)
  if (!verified) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", request.url))
  }

  const authSecret = process.env.AUTH_SECRET
  if (!authSecret) {
    return NextResponse.redirect(new URL("/login?error=server_error", request.url))
  }

  const isProduction = process.env.NODE_ENV === "production"
  const cookieName   = isProduction
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"

  const jwt = await encode({
    token:   { merchantId: verified.merchantId, sub: verified.merchantId },
    secret:  authSecret,
    salt:    cookieName,
    maxAge:  30 * 24 * 60 * 60, // 30 days
  })

  const response = NextResponse.redirect(new URL("/dashboard", request.url))
  response.cookies.set({
    name:     cookieName,
    value:    jwt,
    httpOnly: true,
    secure:   isProduction,
    sameSite: "lax",
    path:     "/",
    maxAge:   30 * 24 * 60 * 60,
  })

  return response
}
