import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure, publicProcedure, merchantProcedure } from "../trpc"
import { CHECKIN_POINTS, RECEIPT_DAILY_LIMIT, SCAN_POINTS_PER_CURRENCY, REFERRAL_SIGNUP_POINTS, stepMultiplier } from "@pulse/shared"

const OptionalReferralCode = z.preprocess((value) => {
  if (typeof value !== "string") return value
  const code = value.trim().toUpperCase()
  return code.length === 6 ? code : undefined
}, z.string().length(6).optional())

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date()
    const weekStart = new Date(now)
    const day = weekStart.getDay()
    const diffToMonday = day === 0 ? 6 : day - 1
    weekStart.setDate(weekStart.getDate() - diffToMonday)
    weekStart.setHours(0, 0, 0, 0)
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

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
        stepsToday: true,
        stepsTotal: true,
        cardNumber: true,
        referralCode: true,
        referredById: true,
        onboardingDone: true,
        createdAt: true,
      },
    })
    if (!user) throw new TRPCError({ code: "NOT_FOUND" })

    const weeklyTxs = await ctx.db.transaction.findMany({
      where: {
        userId: ctx.userId,
        createdAt: { gte: weekStart },
      },
      select: {
        type: true,
        createdAt: true,
        pointsEarned: true,
        pointsFromEarned: true,
        pointsFromWelcome: true,
      },
    })

    const weeklyEarnedPoints = weeklyTxs
      .filter((tx) => !["REWARD_REDEEMED", "GIFT_SENT"].includes(tx.type))
      .reduce((sum, tx) => sum + tx.pointsEarned, 0)
    const weeklySpentPoints = weeklyTxs
      .filter((tx) => ["REWARD_REDEEMED", "GIFT_SENT"].includes(tx.type))
      .reduce((sum, tx) => sum + tx.pointsFromEarned + tx.pointsFromWelcome + tx.pointsEarned, 0)
    const todayReceiptScans = weeklyTxs.filter((tx) => tx.type === "RECEIPT_SCAN" && tx.createdAt >= todayStart).length
    const receiptSlotsLeft = Math.max(0, RECEIPT_DAILY_LIMIT - todayReceiptScans)
    const nextReceiptEstimate = receiptSlotsLeft > 0
      ? Math.max(1, Math.floor(2500 * SCAN_POINTS_PER_CURRENCY * stepMultiplier(user.stepsToday)))
      : 0
    const checkedInToday = user.lastCheckinAt ? user.lastCheckinAt >= todayStart : false
    const todayPotentialPoints = nextReceiptEstimate + (checkedInToday ? 0 : CHECKIN_POINTS)

    return {
      ...user,
      // Compute total on the fly — never store as separate column
      totalPoints: user.earnedPoints + user.welcomePoints,
      weeklyEarnedPoints,
      weeklySpentPoints,
      todayPotentialPoints,
    }
  }),

  // Called after magic link sign-in to complete profile setup
  completeOnboarding: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).trim(),
        language: z.enum(["EN", "RU", "SR"]).optional(),
        referralCode: OptionalReferralCode,
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
            ...(input.language !== undefined ? { language: input.language } : {}),
            onboardingDone: true,
            ...(input.deviceFingerprint !== undefined ? { deviceFingerprint: input.deviceFingerprint } : {}),
            ...(referrerId ? { referredById: referrerId } : {}),
            ...(referrerId ? { earnedPoints: { increment: REFERRAL_SIGNUP_POINTS } } : {}),
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
        onboardingDone: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { name, homeCity, language, avatarUrl, onboardingDone } = input
      return ctx.db.user.update({
        where: { id: ctx.userId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(homeCity !== undefined ? { homeCity } : {}),
          ...(language !== undefined ? { language } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
          ...(onboardingDone !== undefined ? { onboardingDone } : {}),
        },
        select: { id: true, name: true, homeCity: true, language: true, avatarUrl: true },
      })
    }),

  /**
   * Daily step sync — mobile reports today's step count from HealthKit / Google Fit.
   * Persists `stepsToday` (replaces) and bumps `stepsTotal` if the new value is higher
   * (avoids double-counting on resync).
   *
   * The multiplier itself is applied at earn-time (receipt confirm + partner purchase)
   * by reading the freshest stepsToday for the user.
   */
  syncSteps: protectedProcedure
    .input(z.object({ steps: z.number().int().min(0).max(100_000) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { stepsToday: true, stepsTotal: true },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })

      // Only credit the *delta* against today's previously-reported steps.
      // First sync of the day: delta = input.steps. Re-sync mid-day: delta = new - old (clipped to >=0).
      const delta = Math.max(0, input.steps - user.stepsToday)

      const updated = await ctx.db.user.update({
        where: { id: ctx.userId },
        data: {
          stepsToday: input.steps,
          stepsTotal: { increment: delta },
        },
        select: { stepsToday: true, stepsTotal: true },
      })

      return updated
    }),

  /** Reset all users' stepsToday — called by daily Upstash QStash cron at user's local midnight (server UTC for v1). */
  resetDailySteps: publicProcedure
    .mutation(async ({ ctx }) => {
      const result = await ctx.db.user.updateMany({
        where: { stepsToday: { gt: 0 } },
        data: { stepsToday: 0 },
      })
      return { resetCount: result.count }
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

  // Merchant: look up a user by their QR (userId) or referral code before purchase
  lookupForMerchant: merchantProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        referralCode: z.string().length(6).optional(),
      }).refine((d) => d.userId ?? d.referralCode, {
        message: "Provide userId or referralCode",
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findFirst({
        where: input.userId
          ? { id: input.userId }
          : { referralCode: input.referralCode!.toUpperCase() },
        select: {
          id: true,
          name: true,
          earnedPoints: true,
          welcomePoints: true,
          currentStreak: true,
        },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" })
      return {
        ...user,
        totalPoints: user.earnedPoints + user.welcomePoints,
      }
    }),

  // Profile stats — lifetime summary for the profile screen
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [user, txCount, venueCount, redemptionCount] = await Promise.all([
      ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: {
          totalEarnedLifetime: true,
          spentPoints: true,
          currentStreak: true,
          longestStreak: true,
          referralCode: true,
        },
      }),
      ctx.db.transaction.count({
        where: { userId: ctx.userId, status: "VERIFIED" },
      }),
      ctx.db.transaction.findMany({
        where: { userId: ctx.userId, venueId: { not: null }, status: "VERIFIED" },
        select: { venueId: true },
        distinct: ["venueId"],
      }).then((rows) => rows.length),
      ctx.db.redemption.count({
        where: { userId: ctx.userId, status: "USED" },
      }),
    ])
    if (!user) throw new TRPCError({ code: "NOT_FOUND" })
    return {
      totalEarnedLifetime: user.totalEarnedLifetime,
      spentPoints: user.spentPoints,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      referralCode: user.referralCode,
      transactionCount: txCount,
      uniqueVenuesVisited: venueCount,
      rewardsRedeemed: redemptionCount,
    }
  }),

  // Redemption history for profile screen
  myRedemptions: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const redemptions = await ctx.db.redemption.findMany({
        where: { userId: ctx.userId },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          reward: {
            select: {
              title: true,
              pointsCost: true,
              venue: { select: { id: true, name: true } },
            },
          },
        },
      })
      let nextCursor: string | undefined
      if (redemptions.length > input.limit) nextCursor = redemptions.pop()!.id
      return { redemptions, nextCursor }
    }),

  /** Look up another user by their referral code — used by gift flow. */
  findByReferralCode: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { referralCode: input.code.toUpperCase() },
        select: { id: true, name: true, avatarUrl: true },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "No user with that code" })
      if (user.id === ctx.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That's your own code" })
      }
      return user
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

  registerPushToken: protectedProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.user.update({
        where: { id: ctx.userId },
        data: { pushToken: input.token },
      })
      return { ok: true }
    }),
})
