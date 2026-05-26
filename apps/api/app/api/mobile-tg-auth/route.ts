import { NextResponse } from "next/server"
import { createHmac } from "crypto"
import { db } from "@pulse/db"
import { signMobileToken } from "@pulse/auth/mobile-jwt"
import {
  generateReferralCode,
  generateCardNumber,
  WELCOME_BONUS_AMOUNT,
  WELCOME_EXPIRY_DAYS,
} from "@pulse/shared"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
}

function json(body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init)
  for (const [key, value] of Object.entries(corsHeaders)) res.headers.set(key, value)
  return res
}

function verifyTelegramInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData)
  const hash = params.get("hash")
  if (!hash) return null
  params.delete("hash")

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex")
  return expectedHash === hash ? params : null
}

function verifyWithConfiguredBot(initData: string) {
  const tokens = [
    process.env.TELEGRAM_BOT_TOKEN,
    process.env.PARTNER_TELEGRAM_BOT_TOKEN,
  ].filter((token): token is string => Boolean(token))

  for (const token of tokens) {
    const params = verifyTelegramInitData(initData, token)
    if (params) return params
  }
  return null
}

function languageFrom(code: string | undefined) {
  if (code === "ru") return "RU"
  if (code === "sr") return "SR"
  return "EN"
}

type AuthUser = {
  id: string
  email: string
  onboardingDone: boolean
  name: string | null
  language: "EN" | "RU" | "SR"
}

export async function POST(req: Request) {
  try {
    const { initData } = await req.json() as { initData?: string }
    if (!initData) return json({ error: "initData required" }, { status: 400 })

    if (!process.env.TELEGRAM_BOT_TOKEN && !process.env.PARTNER_TELEGRAM_BOT_TOKEN) {
      return json({ error: "Telegram not configured" }, { status: 500 })
    }

    const params = verifyWithConfiguredBot(initData)
    if (!params) return json({ error: "Invalid Telegram signature" }, { status: 401 })

    const rawUser = params.get("user")
    if (!rawUser) return json({ error: "No user in initData" }, { status: 400 })

    const tgUser = JSON.parse(rawUser) as {
      id?: number
      first_name?: string
      last_name?: string
      username?: string
      language_code?: string
    }
    if (!tgUser.id) return json({ error: "No Telegram user ID" }, { status: 400 })

    const telegramId = String(tgUser.id)
    const email = `tg_${telegramId}@ayoo.space`
    const name = tgUser.username ?? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ")
    const language = languageFrom(tgUser.language_code?.toLowerCase())

    let user: AuthUser | null = await db.user.findUnique({
      where: { telegramId },
      select: { id: true, email: true, onboardingDone: true, name: true, language: true },
    })

    if (!user) {
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + WELCOME_EXPIRY_DAYS)

      let cardNumber: string | undefined
      for (let i = 0; i < 10; i++) {
        const candidate = generateCardNumber()
        const taken = await db.user.findUnique({ where: { cardNumber: candidate }, select: { id: true } })
        if (!taken) { cardNumber = candidate; break }
      }

      let created: AuthUser | null = null
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          created = await db.user.create({
            data: {
              telegramId,
              email,
              emailVerified: new Date(),
              name,
              language,
              ...(cardNumber ? { cardNumber } : {}),
              referralCode: generateReferralCode(),
              welcomePoints: WELCOME_BONUS_AMOUNT,
              welcomeExpiresAt: expiresAt,
            },
            select: { id: true, email: true, onboardingDone: true, name: true, language: true },
          })
          break
        } catch (e: unknown) {
          const isUniqueErr = e instanceof Error && e.message.includes("referralCode")
          if (!isUniqueErr) throw e
        }
      }

      if (!created) return json({ error: "Failed to create user" }, { status: 500 })
      user = created
    }

    const token = await signMobileToken({ userId: user.id, email: user.email })
    return json({
      token,
      isNewUser: !user.onboardingDone,
      user: { id: user.id, email: user.email, name: user.name, language: user.language, onboardingDone: user.onboardingDone },
    })
  } catch (e) {
    console.error("mobile-tg-auth error:", e)
    return json({ error: "Internal error" }, { status: 500 })
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}
