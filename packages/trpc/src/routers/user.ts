import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure, publicProcedure } from "../trpc"
import { REFERRAL_SIGNUP_POINTS } from "@pulse/shared"

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        homeCity: true,
        language: true,
        earnedPoints: true,
        welcomePoints: true,
        welcomeExpiresAt: true,
        lastWelcomeUsedAt: true,
        totalEarnedLifetime: true,
        spentPoints: true,
        currentStreak: true,
        longestStreak: true,
        lastCheckinAt: true,
        referralCode: true,
        referredById: true,
        onboardingDone: true,
        createdAt: true,
      },
    })
    if (!user) throw new TRPCError({ code: "NOT_FOUND" })

    return {
      ...user,
      // Compute total on the fly — never store as separate column
      totalPoints: user.earnedPoints + user.welcomePoints,
    }
  }),

  // Called after magic link sign-in to complete profile setup
  completeOnboarding: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).trim(),
        language: z.enum(["EN", "RU", "SR"]).optional(),
        referralCode: z.string().length(6).toUpperCase().optional(),
        deviceFingerprint: z.string().max(256).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { onboardingDone: true, referredById: true },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })
      if (user.onboardingDone) throw new TRPCError({ code: "CONFLICT", message: "Onboarding already done" })

      // Resolve referral if provided
      let referrerId: string | undefined
      if (input.referralCode && !user.referredById) {
        const referrer = await ctx.db.user.findUnique({
          where: { referralCode: input.referralCode },
          select: { id: true },
        })
        // Silently ignore invalid codes — don't error out on bad referral
        if (referrer && referrer.id !== ctx.userId) {
          referrerId = referrer.id
        }
      }

      const updated = await ctx.db.$transaction(async (tx) => {
        const u = await tx.user.update({
          where: { id: ctx.userId },
          data: {
            name: input.name,
            language: input.language,
            onboardingDone: true,
            deviceFingerprint: input.deviceFingerprint,
            ...(referrerId && { referredById: referrerId }),
            // Referral signup bonus: +50 earnedPoints for the new user
            ...(referrerId && { earnedPoints: { increment: REFERRAL_SIGNUP_POINTS } }),
          },
          select: { id: true, earnedPoints: true, welcomePoints: true, referralCode: true },
        })

        if (referrerId) {
          await tx.transaction.create({
            data: {
              userId: ctx.userId,
              type: "REFERRAL",
              pointsEarned: REFERRAL_SIGNUP_POINTS,
              status: "VERIFIED",
              verifiedAt: new Date(),
            },
          })
        }

        return u
      })

      return {
        ...updated,
        totalPoints: updated.earnedPoints + updated.welcomePoints,
      }
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).trim().optional(),
        homeCity: z.string().max(100).trim().optional(),
        language: z.enum(["EN", "RU", "SR"]).optional(),
        avatarUrl: z.string().url().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.userId },
        data: input,
        select: { id: true, name: true, homeCity: true, language: true, avatarUrl: true },
      })
    }),

  getStreak: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: { currentStreak: true, longestStreak: true, lastCheckinAt: true },
    })
  }),

  getReferrals: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      where: { referredById: ctx.userId },
      select: { id: true, name: true, createdAt: true, onboardingDone: true },
      orderBy: { createdAt: "desc" },
    })
  }),

  // Public: check if a referral code is valid (for onboarding UX)
  validateReferralCode: publicProcedure
    .input(z.object({ code: z.string().length(6) }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { referralCode: input.code.toUpperCase() },
        select: { name: true },
      })
      return { valid: !!user, referrerName: user?.name ?? null }
    }),
})
