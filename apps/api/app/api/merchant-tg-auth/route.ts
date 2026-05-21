/**
 * POST /api/merchant-tg-auth
 *
 * Validates Telegram WebApp initData (HMAC-SHA256 signed by bot token),
 * looks up the merchant by Telegram chat ID, and returns a short-lived JWT.
 *
 * The JWT is used as a Bearer token for /api/merchant-mini-trpc calls.
 */
import { NextResponse } from "next/server"
import { createHmac } from "crypto"
import { SignJWT } from "jose"
import { db } from "@pulse/db"

const JWT_SECRET = new TextEncoder().encode(
  process.env.MERCHANT_AUTH_SECRET ?? "fallback-secret-change-me",
)
const JWT_EXPIRY = "8h"

function validateTelegramInitData(initData: string, botToken: string): Record<string, string> | null {
  const params = new URLSearchParams(initData)
  const hash = params.get("hash")
  if (!hash) return null

  params.delete("hash")
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

  if (expectedHash !== hash) return null
  return Object.fromEntries(params)
}

export async function POST(req: Request) {
  try {
    const { initData } = await req.json() as { initData: string }
    if (!initData || typeof initData !== "string") {
      return NextResponse.json({ error: "initData required" }, { status: 400 })
    }

    const botToken = process.env.PARTNER_TELEGRAM_BOT_TOKEN
    if (!botToken) {
      return NextResponse.json({ error: "Bot not configured" }, { status: 500 })
    }

    const data = validateTelegramInitData(initData, botToken)
    if (!data) {
      return NextResponse.json({ error: "Invalid Telegram signature" }, { status: 401 })
    }

    // Parse Telegram user from initData
    let tgUser: { id: number; first_name?: string }
    try {
      tgUser = JSON.parse(data.user ?? "{}")
    } catch {
      return NextResponse.json({ error: "Invalid user data" }, { status: 400 })
    }

    const telegramId = String(tgUser.id)
    if (!telegramId || telegramId === "undefined") {
      return NextResponse.json({ error: "No Telegram user ID" }, { status: 400 })
    }

    // Find merchant by Telegram ID
    const merchant = await db.merchant.findFirst({
      where: { telegramChatId: telegramId, status: "ACTIVE" },
      include: {
        venues: {
          where: { isPartner: true },
          select: { id: true, name: true, pointsPerCurrency: true, currency: true },
          orderBy: { name: "asc" },
        },
      },
    })

    if (!merchant) {
      return NextResponse.json(
        { error: "Merchant not found or not approved. Contact ayoo support." },
        { status: 403 },
      )
    }

    // Sign JWT with merchantId
    const token = await new SignJWT({ merchantId: merchant.id })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRY)
      .sign(JWT_SECRET)

    return NextResponse.json({
      token,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        venues: merchant.venues,
      },
    })
  } catch (err) {
    console.error("merchant-tg-auth error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
