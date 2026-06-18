import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { createHash, createHmac } from "node:crypto"
import { compare } from "bcryptjs"
import { db } from "@pulse/db"
import { z } from "zod"

// ── Schemas ───────────────────────────────────────────────────

const credentialsSchema = z.object({
  type:          z.enum(["password", "telegram", "bot_token"]).default("password"),
  email:         z.string().optional(),
  password:      z.string().optional(),
  telegramData:  z.string().optional(),
  botLoginToken: z.string().optional(),
})

const PROMO_PASSWORD = process.env.PROMO_PASSWORD ?? "promo123"

// ── Bot magic-link token ──────────────────────────────────────
// Format: base64url(JSON) + "." + HMAC-SHA256(base64url(JSON), botToken)

export function verifyBotLoginToken(token: string): { merchantId: string } | null {
  const botToken = process.env.PARTNER_TELEGRAM_BOT_TOKEN
  if (!botToken) return null
  const dot = token.lastIndexOf(".")
  if (dot < 0) return null
  const payload = token.slice(0, dot)
  const sig     = token.slice(dot + 1)
  const expected = createHmac("sha256", botToken).update(payload).digest("base64url")
  if (expected !== sig) return null
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString())
    if (!data.merchantId || data.exp < Math.floor(Date.now() / 1000)) return null
    return { merchantId: data.merchantId }
  } catch { return null }
}

// ── Telegram Login Widget verification ───────────────────────
// https://core.telegram.org/widgets/login#checking-authorization

function verifyTelegramWidget(raw: string): Record<string, string> | null {
  const botToken = process.env.PARTNER_TELEGRAM_BOT_TOKEN
  if (!botToken) return null

  let data: Record<string, string>
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }

  const { hash, ...fields } = data
  if (!hash) return null

  // Reject stale auth (> 24 h)
  const age = Date.now() / 1000 - parseInt(fields.auth_date ?? "0")
  if (age > 86400) return null

  const checkString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")

  // Widget uses SHA256(bot_token) as HMAC key, unlike WebApp initData
  const secretKey = createHash("sha256").update(botToken).digest()
  const expected  = createHmac("sha256", secretKey).update(checkString).digest("hex")

  return expected === hash ? data : null
}

// ── Auth instance ─────────────────────────────────────────────

export const {
  handlers: merchantHandlers,
  auth: merchantAuth,
  signIn: merchantSignIn,
  signOut: merchantSignOut,
} = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Merchant Credentials",
      credentials: {
        type:         { label: "Type",          type: "text"     },
        email:        { label: "Login",         type: "text"     },
        password:     { label: "Password",      type: "password" },
        telegramData: { label: "Telegram Data", type: "text"     },
      },
      async authorize(credentials) {
        try {
          const parsed = credentialsSchema.safeParse(credentials)
          if (!parsed.success) return null

          // ── Bot magic-link ─────────────────────────────────
          if (parsed.data.type === "bot_token") {
            const result = verifyBotLoginToken(parsed.data.botLoginToken ?? "")
            if (!result) return null
            const merchant = await db.merchant.findUnique({
              where:  { id: result.merchantId },
              select: { id: true, email: true, name: true },
            })
            if (!merchant) return null
            return { id: merchant.id, email: merchant.email ?? "", name: merchant.name }
          }

          // ── Telegram Login Widget ──────────────────────────
          if (parsed.data.type === "telegram") {
            if (!parsed.data.telegramData) {
              console.error("[tg-auth] no telegramData")
              return null
            }

            const data = verifyTelegramWidget(parsed.data.telegramData)
            if (!data) {
              console.error("[tg-auth] HMAC verification failed, token present:", !!process.env.PARTNER_TELEGRAM_BOT_TOKEN)
              return null
            }

            console.error("[tg-auth] verified ok, id:", data.id)

            const merchant = await db.merchant.findFirst({
              where:  { telegramChatId: String(data.id) },
              select: { id: true, email: true, name: true },
            })

            if (!merchant) {
              console.error("[tg-auth] no merchant with telegramChatId:", String(data.id))
              return null
            }

            console.error("[tg-auth] found merchant:", merchant.id)
            return { id: merchant.id, email: merchant.email ?? "", name: merchant.name }
          }

          // ── Promo access ───────────────────────────────────
          if (parsed.data.email === "promo") {
            if (parsed.data.password !== PROMO_PASSWORD) return null
            const first = await db.merchant.findFirst({
              select: { id: true, email: true, name: true },
            })
            if (!first) return null
            return { id: first.id, email: first.email ?? "", name: "Promo" }
          }

          // ── Regular email + password ───────────────────────
          if (!parsed.data.email || !parsed.data.password) return null

          const merchant = await db.merchant.findUnique({
            where: { email: parsed.data.email },
          })
          if (!merchant || !merchant.passwordHash) return null

          const valid = await compare(parsed.data.password, merchant.passwordHash)
          if (!valid) return null

          return { id: merchant.id, email: merchant.email ?? "", name: merchant.name }
        } catch (err) {
          console.error("[auth] authorize error:", err)
          return null
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.merchantId = user.id
      return token
    },
    session({ session, token }) {
      if (token.merchantId) {
        // @ts-expect-error — extend session type in apps/merchant
        session.merchant = { id: token.merchantId }
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
    error:  "/login",
  },
})
