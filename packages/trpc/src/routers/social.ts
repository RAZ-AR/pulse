import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure } from "../trpc"
import { GIFT_MIN_AMOUNT, GIFT_DAILY_LIMIT, GIFT_LINK_EXPIRY_DAYS } from "@pulse/shared"
import { sendPushToUser } from "../services/push"

const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "ayoo_loyalty_bot"

export const socialRouter = router({
  giftStatus: protectedProcedure.query(async ({ ctx }) => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [sender, giftedToday] = await Promise.all([
      ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { earnedPoints: true },
      }),
      ctx.db.transaction.aggregate({
        where: {
          userId: ctx.userId,
          type: "GIFT_SENT",
          createdAt: { gte: todayStart },
        },
        _sum: { pointsEarned: true },
      }),
    ])

    if (!sender) throw new TRPCError({ code: "NOT_FOUND" })

    const sentToday = giftedToday._sum.pointsEarned ?? 0
    return {
      earnedPoints: sender.earnedPoints,
      sentToday,
      remainingDailyLimit: Math.max(0, GIFT_DAILY_LIMIT - sentToday),
      minAmount: GIFT_MIN_AMOUNT,
      dailyLimit: GIFT_DAILY_LIMIT,
    }
  }),

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
   * Create a shareable gift link. Deducts earnedPoints immediately.
   * Recipient claims later via claimGiftLink (or during onboarding).
   */
  createGiftLink: protectedProcedure
    .input(
      z.object({
        amount: z.number().int().min(GIFT_MIN_AMOUNT).max(GIFT_DAILY_LIMIT),
        message: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)

      const [sender, giftedToday] = await Promise.all([
        ctx.db.user.findUnique({
          where: { id: ctx.userId },
          select: { earnedPoints: true },
        }),
        ctx.db.transaction.aggregate({
          where: { userId: ctx.userId, type: "GIFT_SENT", createdAt: { gte: todayStart } },
          _sum: { pointsEarned: true },
        }),
      ])

      if (!sender) throw new TRPCError({ code: "NOT_FOUND" })
      if (sender.earnedPoints < input.amount) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not enough earned points to gift" })
      }

      const totalGiftedToday = giftedToday._sum.pointsEarned ?? 0
      if (totalGiftedToday + input.amount > GIFT_DAILY_LIMIT) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Daily gift limit is ${GIFT_DAILY_LIMIT} pts (${GIFT_DAILY_LIMIT - totalGiftedToday} remaining today)`,
        })
      }

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + GIFT_LINK_EXPIRY_DAYS)

      const link = await ctx.db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: ctx.userId },
          data: {
            earnedPoints: { decrement: input.amount },
            spentPoints: { increment: input.amount },
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
        return tx.giftLink.create({
          data: {
            senderId: ctx.userId,
            amount: input.amount,
            expiresAt,
            ...(input.message ? { message: input.message } : {}),
          },
          select: { token: true, amount: true, expiresAt: true },
        })
      })

      return {
        token: link.token,
        amount: link.amount,
        expiresAt: link.expiresAt,
        shareUrl: `https://t.me/${BOT_USERNAME}?start=gift_${link.token}`,
        shareText: `I'm gifting you ${input.amount} ayoo points! Open the link to claim them: https://t.me/${BOT_USERNAME}?start=gift_${link.token}`,
      }
    }),

  /**
   * Claim a gift link. Called by authenticated users who opened a share link.
   */
  claimGiftLink: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.db.giftLink.findUnique({
        where: { token: input.token },
        select: { id: true, senderId: true, amount: true, status: true, expiresAt: true },
      })

      if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Gift link not found" })
      if (link.status !== "PENDING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: link.status === "CLAIMED" ? "Gift already claimed" : "Gift link expired" })
      }
      if (link.expiresAt < new Date()) {
        await ctx.db.giftLink.update({ where: { id: link.id }, data: { status: "EXPIRED" } })
        throw new TRPCError({ code: "BAD_REQUEST", message: "Gift link has expired" })
      }
      if (link.senderId === ctx.userId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot claim your own gift" })
      }

      const [recipient, sender] = await Promise.all([
        ctx.db.user.findUnique({ where: { id: ctx.userId }, select: { name: true } }),
        ctx.db.user.findUnique({ where: { id: link.senderId }, select: { pushToken: true } }),
      ])

      await ctx.db.$transaction(async (tx) => {
        await tx.giftLink.update({
          where: { id: link.id },
          data: { status: "CLAIMED", recipientId: ctx.userId, claimedAt: new Date() },
        })
        await tx.user.update({
          where: { id: ctx.userId },
          data: {
            earnedPoints: { increment: link.amount },
            totalEarnedLifetime: { increment: link.amount },
          },
        })
        await tx.transaction.create({
          data: {
            userId: ctx.userId,
            type: "GIFT_RECEIVED",
            pointsEarned: link.amount,
            status: "VERIFIED",
            verifiedAt: new Date(),
          },
        })
      })

      const recipientName = recipient?.name ?? "Someone"
      void sendPushToUser(sender?.pushToken, "🎁 Gift claimed!", `${recipientName} received your ${link.amount} pts gift`)

      return { received: link.amount }
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

  giftLinkHistory: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const links = await ctx.db.giftLink.findMany({
        where: { senderId: ctx.userId },
        select: {
          id: true,
          token: true,
          amount: true,
          message: true,
          status: true,
          createdAt: true,
          claimedAt: true,
          expiresAt: true,
          recipient: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      })
      return links
    }),
})
