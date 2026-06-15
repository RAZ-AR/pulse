/**
 * POST /api/staff-tg-auth
 *
 * Validates Telegram WebApp initData, looks up the StaffMember by telegramChatId,
 * and returns a short-lived JWT for use with /api/merchant-mini-trpc.
 *
 * JWT payload: { staffId, venueId, merchantId, role: "staff" }
 */
import { NextResponse } from "next/server"
import { createHmac } from "crypto"
import { SignJWT } from "jose"
import { db } from "@pulse/db"

const JWT_EXPIRY = "8h"

function jwtSecret(): Uint8Array {
  const secret = process.env.MERCHANT_AUTH_SECRET
  if (!secret) throw new Error("MERCHANT_AUTH_SECRET is not configured")
  return new TextEncoder().encode(secret)
}

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

    const staff = await db.staffMember.findUnique({
      where: { telegramChatId: telegramId },
      select: {
        id: true,
        name: true,
        isActive: true,
        venueId: true,
        merchantId: true,
        venue: { select: { id: true, name: true, city: true } },
        merchant: { select: { name: true } },
      },
    })

    if (!staff) {
      return NextResponse.json({
        status: "unregistered",
        telegramId,
        firstName: tgUser.first_name,
      })
    }

    if (!staff.isActive) {
      return NextResponse.json({
        status: "revoked",
        telegramId,
      })
    }

    const token = await new SignJWT({
      staffId: staff.id,
      venueId: staff.venueId,
      merchantId: staff.merchantId,
      role: "staff",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(JWT_EXPIRY)
      .sign(jwtSecret())

    return NextResponse.json({
      status: "active",
      token,
      staff: {
        id: staff.id,
        name: staff.name ?? tgUser.first_name,
        venue: staff.venue,
        merchantName: staff.merchant.name,
      },
    })
  } catch (err) {
    console.error("staff-tg-auth error:", err)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
