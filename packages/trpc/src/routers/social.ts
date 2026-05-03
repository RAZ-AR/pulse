import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure } from "../trpc"
import { GIFT_MIN_AMOUNT, GIFT_DAILY_LIMIT } from "@pulse/shared"

export const socialRouter = router({
  /**
   * Transfer earnedPoints from sender to receiver.
   * Limits: min 50 pts/gift, 500 pts/day total outgoing.
   * Only earnedPoints can be gifted (not welcome balance).
   */
  gift: protectedProcedure
    .input(
      z.object({
        receiverId: z.string(),
        amount: z.number().int().min(GIFT_MIN_AMOUNT).max(GIFT_DAILY_LIMIT),
        message: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.receiverId === ctx.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot gift points to yourself" })
      }

      // 1. Check receiver exists
      const receiver = await ctx.db.user.findUnique({
        where: { id: input.receiverId },
        select: { id: true, name: true },
      })
      if (!receiver) throw new TRPCError({ code: "NOT_FOUND", message: "Receiver not found" })

      // 2. Check sender's earnedPoints balance
      const sender = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { earnedPoints: true },
      })
      if (!sender) throw new TRPCError({ code: "NOT_FOUND" })
      if (sender.earnedPoints < input.amount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not enough earned points to gift" })
      }

      // 3. Daily outgoing limit: sum of GIFT_SENT transactions today
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const giftedToday = await ctx.db.transaction.aggregate({
        where: {
          userId: ctx.userId,
          type: "GIFT_SENT",
          createdAt: { gte: todayStart },
        },
        _sum: { pointsEarned: true },
      })
      const totalGiftedToday = giftedToday._sum.pointsEarned ?? 0
      if (totalGiftedToday + input.amount > GIFT_DAILY_LIMIT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Daily gift limit is ${GIFT_DAILY_LIMIT} pts (${GIFT_DAILY_LIMIT - totalGiftedToday} pts remaining today)`,
        })
      }

      // 4. DB transaction: transfer points + record the gift + both transaction lines
      await ctx.db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: ctx.userId },
          data: {
            earnedPoints: { decrement: input.amount },
            spentPoints: { increment: input.amount },
          },
        })

        await tx.user.update({
          where: { id: input.receiverId },
          data: {
            earnedPoints: { increment: input.amount },
            totalEarnedLifetime: { increment: input.amount },
          },
        })

        await tx.pointsGift.create({
          data: {
            senderId: ctx.userId,
            receiverId: input.receiverId,
            amount: input.amount,
            ...(input.message ? { message: input.message } : {}),
          },
        })

        await tx.transaction.create({
          data: {
            userId: ctx.userId,
            type: "GIFT_SENT",
            pointsEarned: input.amount,
            status: "VERIFIED",
            verifiedAt: new Date(),
          },
        })

        await tx.transaction.create({
          data: {
            userId: input.receiverId,
            type: "GIFT_RECEIVED",
            pointsEarned: input.amount,
            status: "VERIFIED",
            verifiedAt: new Date(),
          },
        })
      })

      return {
        sent: input.amount,
        toUser: receiver.name ?? receiver.id,
        remainingDailyLimit: GIFT_DAILY_LIMIT - totalGiftedToday - input.amount,
      }
    }),

  /**
   * "Friends" for v1 = people you invited (your referrals) + the person who invited you.
   * No mutual friendship model yet — that's deferred until requested by users.
   */
  friends: protectedProcedure.query(async ({ ctx }) => {
    const me = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: { referredById: true },
    })

    const referees = await ctx.db.user.findMany({
      where: { referredById: ctx.userId, onboardingDone: true },
      select: { id: true, name: true, avatarUrl: true, currentStreak: true },
      orderBy: { lastCheckinAt: "desc" },
    })

    let referrer: { id: string; name: string | null; avatarUrl: string | null; currentStreak: number } | null = null
    if (me?.referredById) {
      referrer = await ctx.db.user.findUnique({
        where: { id: me.referredById },
        select: { id: true, name: true, avatarUrl: true, currentStreak: true },
      })
    }

    // Dedupe — referrer might also be in referees (unlikely but cheap to be safe)
    const allIds = new Set(referees.map((r) => r.id))
    const friends = [...referees]
    if (referrer && !allIds.has(referrer.id)) friends.push(referrer)

    return friends
  }),

  /**
   * Activity feed — public actions by your friends in the last 14 days.
   * Public events: CHECKIN_PHOTO, CHALLENGE_COMPLETE, REWARD_REDEEMED.
   * Filters out private finance events (gifts, scans, etc).
   */
  feed: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      // Reuse the same friends-set logic
      const me = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { referredById: true },
      })
      const referees = await ctx.db.user.findMany({
        where: { referredById: ctx.userId, onboardingDone: true },
        select: { id: true },
      })
      const friendIds = new Set(referees.map((r) => r.id))
      if (me?.referredById) friendIds.add(me.referredById)

      if (friendIds.size === 0) return { items: [] }

      const since = new Date()
      since.setDate(since.getDate() - 14)

      const transactions = await ctx.db.transaction.findMany({
        where: {
          userId: { in: Array.from(friendIds) },
          status: "VERIFIED",
          type: { in: ["CHECKIN_PHOTO", "CHALLENGE_COMPLETE", "REWARD_REDEEMED"] },
          createdAt: { gte: since },
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
          venue: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      })

      return {
        items: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          createdAt: t.createdAt,
          pointsEarned: t.pointsEarned,
          user: t.user,
          venue: t.venue,
        })),
      }
    }),
})
