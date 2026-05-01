import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure, protectedProcedure, merchantProcedure } from "../trpc"
import { calcSpend, MIN_REDEEM } from "@pulse/shared"

const REDEMPTION_TTL_HOURS = 24

export const rewardRouter = router({
  list: publicProcedure
    .input(
      z.object({
        venueId: z.string().optional(),
        maxCost: z.number().optional(),
        limit: z.number().default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const rewards = await ctx.db.reward.findMany({
        where: {
          ...(input.venueId ? { venueId: input.venueId } : {}),
          isActive: true,
          ...(input.maxCost ? { pointsCost: { lte: input.maxCost } } : {}),
        },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor } } : {}),
        orderBy: { pointsCost: "asc" },
        include: { venue: { select: { id: true, name: true, city: true } } },
      })
      let nextCursor: string | undefined
      if (rewards.length > input.limit) {
        nextCursor = rewards.pop()!.id
      }
      return { rewards, nextCursor }
    }),

  /**
   * User initiates redemption — spends points, generates a one-time QR code.
   * Code expires in 24h; merchant scans it via reward.validate to finalise.
   */
  redeem: protectedProcedure
    .input(z.object({ rewardId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 1. Load reward
      const reward = await ctx.db.reward.findUnique({
        where: { id: input.rewardId },
        select: {
          id: true,
          title: true,
          description: true,
          pointsCost: true,
          isActive: true,
          stockLimit: true,
          redeemedCount: true,
          venueId: true,
          venue: { select: { name: true } },
        },
      })
      if (!reward) throw new TRPCError({ code: "NOT_FOUND", message: "Reward not found" })
      if (!reward.isActive) throw new TRPCError({ code: "BAD_REQUEST", message: "Reward is no longer active" })
      if (reward.stockLimit !== null && reward.redeemedCount >= reward.stockLimit) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Reward is out of stock" })
      }

      // 2. Load user wallet
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: {
          earnedPoints: true,
          welcomePoints: true,
          welcomeExpiresAt: true,
          lastWelcomeUsedAt: true,
        },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })

      const totalPoints = user.earnedPoints + user.welcomePoints
      if (totalPoints < MIN_REDEEM) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Minimum ${MIN_REDEEM} points required to redeem` })
      }

      // 3. Calculate spend split across earned + welcome wallets
      const spend = calcSpend(user, reward.pointsCost)
      if (!spend.ok) {
        const msgMap = {
          INSUFFICIENT_POINTS: "Not enough points to redeem this reward",
          WELCOME_DAILY_LIMIT: "Welcome points are on cooldown (24h limit)",
          WELCOME_EXPIRED: "Welcome points have expired",
        }
        throw new TRPCError({ code: "BAD_REQUEST", message: msgMap[spend.error] })
      }

      const expiresAt = new Date(Date.now() + REDEMPTION_TTL_HOURS * 3_600_000)

      // 4. DB transaction: spend points + create redemption record
      const result = await ctx.db.$transaction(async (tx) => {
        const redemption = await tx.redemption.create({
          data: {
            userId: ctx.userId,
            rewardId: reward.id,
            pointsSpent: reward.pointsCost,
            expiresAt,
          },
          select: { id: true, redemptionCode: true, expiresAt: true },
        })

        await tx.user.update({
          where: { id: ctx.userId },
          data: {
            earnedPoints: { decrement: spend.fromEarned },
            welcomePoints: { decrement: spend.fromWelcome },
            spentPoints: { increment: reward.pointsCost },
            ...(spend.fromWelcome > 0 && { lastWelcomeUsedAt: new Date() }),
          },
        })

        await tx.reward.update({
          where: { id: reward.id },
          data: { redeemedCount: { increment: 1 } },
        })

        await tx.transaction.create({
          data: {
            userId: ctx.userId,
            venueId: reward.venueId,
            type: "REWARD_REDEEMED",
            pointsEarned: 0,
            pointsFromEarned: spend.fromEarned,
            pointsFromWelcome: spend.fromWelcome,
            status: "VERIFIED",
            verifiedAt: new Date(),
          },
        })

        return redemption
      })

      return {
        redemptionCode: result.redemptionCode,
        expiresAt: result.expiresAt,
        reward: {
          title: reward.title,
          description: reward.description,
          venue: reward.venue.name,
          pointsCost: reward.pointsCost,
        },
      }
    }),

  /**
   * Merchant scans the user's QR code to validate and consume it.
   * Verifies ownership, checks expiry, marks as USED.
   */
  validate: merchantProcedure
    .input(z.object({ redemptionCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const redemption = await ctx.db.redemption.findUnique({
        where: { redemptionCode: input.redemptionCode },
        include: {
          reward: {
            include: { venue: { select: { id: true, name: true, ownerId: true } } },
          },
        },
      })

      if (!redemption) {
        return { valid: false, reason: "Code not found" } as const
      }

      if (redemption.reward.venue.ownerId !== ctx.merchantId) {
        return { valid: false, reason: "Code does not belong to your venue" } as const
      }

      if (redemption.status === "USED") {
        return { valid: false, reason: "Code already used" } as const
      }

      if (redemption.status === "EXPIRED" || redemption.expiresAt < new Date()) {
        await ctx.db.redemption.update({
          where: { id: redemption.id },
          data: { status: "EXPIRED" },
        })
        return { valid: false, reason: "Code has expired" } as const
      }

      await ctx.db.redemption.update({
        where: { id: redemption.id },
        data: { status: "USED", usedAt: new Date() },
      })

      return {
        valid: true,
        redemption: {
          id: redemption.id,
          pointsSpent: redemption.pointsSpent,
          reward: {
            title: redemption.reward.title,
            description: redemption.reward.description,
            venue: redemption.reward.venue.name,
          },
        },
      } as const
    }),
})
