import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure } from "../trpc"
import { signMobileToken } from "@pulse/auth/mobile-jwt"
import { generateReferralCode, WELCOME_BONUS_AMOUNT, WELCOME_EXPIRY_DAYS } from "@pulse/shared"
import { checkAndAwardBadges } from "../services/badges"

/**
 * Mobile auth router.
 *
 * v1: dev-friendly email signin — creates user on first sight, returns JWT.
 * v2 (later): replace with magic link request + verify flow using Resend.
 */
export const authRouter = router({
  signInWithEmail: publicProcedure
    .input(
      z.object({
        email: z.string().email().toLowerCase().trim(),
        name: z.string().min(1).max(100).trim().optional(),
        language: z.enum(["EN", "RU", "SR"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Find or create user
      type AuthUser = { id: string; email: string; onboardingDone: boolean; name: string | null; language: "EN" | "RU" | "SR" }
      let user: AuthUser | null = await ctx.db.user.findUnique({
        where: { email: input.email },
        select: { id: true, email: true, onboardingDone: true, name: true, language: true },
      })

      if (!user) {
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + WELCOME_EXPIRY_DAYS)

        let created: AuthUser | null = null
        for (let attempt = 0; attempt < 5; attempt++) {
          try {
            created = await ctx.db.user.create({
              data: {
                email: input.email,
                emailVerified: new Date(),
                ...(input.name ? { name: input.name } : {}),
                ...(input.language ? { language: input.language } : {}),
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
        if (!created) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create user account" })
        }
        user = created

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
