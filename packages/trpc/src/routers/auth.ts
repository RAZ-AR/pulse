import { z } from "zod"
import { createHmac } from "crypto"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure } from "../trpc"
import { signMobileToken } from "@pulse/auth/mobile-jwt"
import {
  generateReferralCode,
  generateCardNumber,
  WELCOME_BONUS_AMOUNT,
  WELCOME_EXPIRY_DAYS,
  REFERRAL_SIGNUP_POINTS,
} from "@pulse/shared"
import { checkAndAwardBadges } from "../services/badges"

const OptionalReferralCode = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const code = value.trim().toUpperCase()
  return code.length === 6 ? code : undefined
}, z.string().length(6).optional())

/**
 * Mobile auth router.
 *
 * v1: dev-friendly email signin — creates user on first sight, returns JWT.
 * v2 (later): replace with magic link request + verify flow using Resend.
 */
export const authRouter = router({
  signInWithTelegram: publicProcedure
    .input(z.object({ initData: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const botToken = process.env.TELEGRAM_BOT_TOKEN
      if (!botToken) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Telegram not configured" })

      // Verify HMAC-SHA256 signature
      const params = new URLSearchParams(input.initData)
      const hash = params.get("hash")
      if (!hash) throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing hash" })
      params.delete("hash")

      const dataCheckString = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("\n")

      const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
      const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

      if (expectedHash !== hash) throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid initData" })

      const userRaw = params.get("user")
      if (!userRaw) throw new TRPCError({ code: "BAD_REQUEST", message: "No user in initData" })
      const tgUser = JSON.parse(userRaw) as { id: number; first_name: string; last_name?: string; username?: string }

      const telegramId = String(tgUser.id)
      const syntheticEmail = `tg_${telegramId}@pulse.app`
      const name = tgUser.username ?? [tgUser.first_name, tgUser.last_name].filter(Boolean).join(" ")

      const tgLang = (params.get("user") ? (JSON.parse(params.get("user")!) as { language_code?: string }).language_code : undefined) ?? "en"
      const langMap: Record<string, "EN" | "RU" | "SR"> = { ru: "RU", sr: "SR", en: "EN" }
      const language = langMap[tgLang.toLowerCase()] ?? "EN"

      type AuthUser = { id: string; email: string; onboardingDone: boolean; name: string | null; language: "EN" | "RU" | "SR" }

      let user: AuthUser | null = await ctx.db.user.findUnique({
        where: { telegramId },
        select: { id: true, email: true, onboardingDone: true, name: true, language: true },
      })

      if (!user) {
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + WELCOME_EXPIRY_DAYS)

        // Find a unique 5-digit card number (retries on collision)
        let cardNumber: string | undefined
        for (let cn = 0; cn < 10; cn++) {
          const candidate = generateCardNumber()
          const taken = await ctx.db.user.findUnique({ where: { cardNumber: candidate }, select: { id: true } })
          if (!taken) { cardNumber = candidate; break }
        }

        let created: AuthUser | null = null
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            created = await ctx.db.user.create({
              data: {
                telegramId,
                email: syntheticEmail,
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
        if (!created) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user" })
        user = created

        await ctx.db.$transaction(async (tx) => {
          await checkAndAwardBadges(tx, created!.id)
        })
      }

      const token = await signMobileToken({ userId: user.id, email: user.email })
      return {
        token,
        isNewUser: !user.onboardingDone,
        user: { id: user.id, email: user.email, name: user.name, language: user.language, onboardingDone: user.onboardingDone },
      }
    }),

  signInWithEmail: publicProcedure
    .input(
      z.object({
        // Optional — if not provided a guest account is created (email can be added later in profile)
        email: z.string().email().toLowerCase().trim().optional(),
        name: z.string().min(1).max(100).trim().optional(),
        homeCity: z.string().max(100).trim().optional(),
        language: z.enum(["EN", "RU", "SR"]).optional(),
        referralCode: OptionalReferralCode,
      })
    )
    .mutation(async ({ ctx, input }) => {
      // If no email provided, generate a guest synthetic email (user can add real email in profile later)
      const email = input.email ?? `guest_${crypto.randomUUID().replace(/-/g, "")}@pulse.app`

      // Find or create user
      type AuthUser = { id: string; email: string; onboardingDone: boolean; name: string | null; language: "EN" | "RU" | "SR" }
      let user: AuthUser | null = input.email
        ? await ctx.db.user.findUnique({
            where: { email: input.email },
            select: { id: true, email: true, onboardingDone: true, name: true, language: true },
          })
        : null

      if (!user) {
        // Resolve referrer if a code was provided. Silently ignore unknown codes —
        // a bad referral shouldn't block signup.
        let referrerId: string | undefined
        if (input.referralCode) {
          const referrer = await ctx.db.user.findUnique({
            where: { referralCode: input.referralCode },
            select: { id: true },
          })
          if (referrer) referrerId = referrer.id
        }

        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + WELCOME_EXPIRY_DAYS)

        // Find a unique 5-digit card number (retries on collision)
        let cardNumber: string | undefined
        for (let cn = 0; cn < 10; cn++) {
          const candidate = generateCardNumber()
          const taken = await ctx.db.user.findUnique({ where: { cardNumber: candidate }, select: { id: true } })
          if (!taken) { cardNumber = candidate; break }
        }

        let created: AuthUser | null = null
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            created = await ctx.db.user.create({
              data: {
                email,
                ...(cardNumber ? { cardNumber } : {}),
                ...(input.email ? { emailVerified: new Date() } : {}),
                ...(input.name ? { name: input.name } : {}),
                ...(input.homeCity ? { homeCity: input.homeCity } : {}),
                ...(input.language ? { language: input.language } : {}),
                referralCode: generateReferralCode(),
                welcomePoints: WELCOME_BONUS_AMOUNT,
                welcomeExpiresAt: expiresAt,
                // Signup with valid referral: link + give +50 earnedPoints to referee
                ...(referrerId
                  ? {
                      referredById: referrerId,
                      earnedPoints: REFERRAL_SIGNUP_POINTS,
                      totalEarnedLifetime: REFERRAL_SIGNUP_POINTS,
                    }
                  : {}),
              },
              select: { id: true, email: true, onboardingDone: true, name: true, language: true },
            })
            break
          } catch (e: unknown) {
            const isUniqueErr = e instanceof Error && e.message.includes("referralCode")
            if (!isUniqueErr) throw e
          }
        }
        if (!created) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user account" })
        }
        user = created

        // Log the referral signup transaction so it shows in history
        if (referrerId) {
          await ctx.db.transaction.create({
            data: {
              userId: created.id,
              type: "REFERRAL",
              pointsEarned: REFERRAL_SIGNUP_POINTS,
              status: "VERIFIED",
              verifiedAt: new Date(),
            },
          })
        }

        // Award welcome badge on signup (idempotent — only fires for fresh accounts)
        await ctx.db.$transaction(async (tx) => {
          await checkAndAwardBadges(tx, created!.id)
        })
      }

      const token = await signMobileToken({ userId: user.id, email: user.email })

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          language: user.language,
          onboardingDone: user.onboardingDone,
        },
      }
    }),
})
