import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure, protectedProcedure, merchantProcedure } from "../trpc"
import { checkAndAwardBadges } from "../services/badges"

export const offerRouter = router({

  // ── Public ────────────────────────────────────────────────

  /** Список активных акций для главного экрана Mini App */
  list: publicProcedure
    .input(z.object({
      city:   z.string().optional(),
      limit:  z.number().min(1).max(50).default(20),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date()
      const offers = await ctx.db.offer.findMany({
        where: {
          active: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gte: now } }],
          ...(input.city ? { venue: { city: { contains: input.city, mode: "insensitive" } } } : {}),
        },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          venue: { select: { id: true, name: true, address: true, city: true, photos: true } },
        },
      })

      let nextCursor: string | undefined
      if (offers.length > input.limit) nextCursor = offers.pop()!.id

      return { offers, nextCursor }
    }),

  /** Превью акции по QR токену — показывается до подтверждения */
  byToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const offer = await ctx.db.offer.findUnique({
        where: { qrToken: input.token },
        include: {
          venue: { select: { id: true, name: true, address: true, city: true, photos: true } },
        },
      })
      if (!offer) throw new TRPCError({ code: "NOT_FOUND", message: "Offer not found" })

      const now = new Date()
      const expired = offer.endsAt && offer.endsAt < now
      const limitReached = offer.usageLimit !== null && offer.usageCount >= offer.usageLimit

      return {
        ...offer,
        available: offer.active && !expired && !limitReached,
        expired,
        limitReached,
      }
    }),

  // ── User (protected) ──────────────────────────────────────

  /** Юзер сканирует QR купон — начисляем баллы */
  redeem: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date()

      const offer = await ctx.db.offer.findUnique({
        where: { qrToken: input.token },
        include: { merchant: { select: { id: true, pointsBalance: true } } },
      })
      if (!offer) throw new TRPCError({ code: "NOT_FOUND", message: "Offer not found" })
      if (!offer.active) throw new TRPCError({ code: "BAD_REQUEST", message: "This offer is no longer active" })
      if (offer.endsAt && offer.endsAt < now) throw new TRPCError({ code: "BAD_REQUEST", message: "This offer has expired" })
      if (offer.usageLimit !== null && offer.usageCount >= offer.usageLimit) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This offer has reached its limit" })
      }

      // Проверить: юзер уже использовал эту акцию
      const alreadyUsed = await ctx.db.offerRedemption.findUnique({
        where: { offerId_userId: { offerId: offer.id, userId: ctx.userId } },
      })
      if (alreadyUsed) throw new TRPCError({ code: "CONFLICT", message: "You've already used this offer" })

      // Проверить баланс партнёра
      if (offer.merchant.pointsBalance < offer.costPoints) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Offer temporarily unavailable" })
      }

      const result = await ctx.db.$transaction(async (tx) => {
        // Создать redemption
        await tx.offerRedemption.create({
          data: { offerId: offer.id, userId: ctx.userId, pointsEarned: offer.pointsReward },
        })

        // Инкремент счётчика
        await tx.offer.update({
          where: { id: offer.id },
          data: { usageCount: { increment: 1 } },
        })

        // Списать с баланса партнёра
        await tx.merchant.update({
          where: { id: offer.merchantId },
          data: { pointsBalance: { decrement: offer.costPoints } },
        })

        // Начислить баллы юзеру
        const updatedUser = await tx.user.update({
          where: { id: ctx.userId },
          data: {
            earnedPoints:        { increment: offer.pointsReward },
            totalEarnedLifetime: { increment: offer.pointsReward },
          },
          select: { earnedPoints: true, welcomePoints: true },
        })

        // Создать запись транзакции
        await tx.transaction.create({
          data: {
            userId:      ctx.userId,
            venueId:     offer.venueId,
            type:        "BONUS",
            pointsEarned: offer.pointsReward,
            status:      "VERIFIED",
            verifiedAt:  new Date(),
          },
        })

        const newBadges = await checkAndAwardBadges(tx, ctx.userId)

        return { updatedUser, newBadges }
      })

      return {
        pointsEarned: offer.pointsReward,
        newTotalPoints: result.updatedUser.earnedPoints + result.updatedUser.welcomePoints,
        offerTitle: offer.title,
        newBadges: result.newBadges,
      }
    }),

  // ── Merchant ──────────────────────────────────────────────

  /** Партнёр создаёт акцию */
  create: merchantProcedure
    .input(z.object({
      venueId:      z.string(),
      title:        z.string().min(3).max(120),
      description:  z.string().max(300).optional(),
      pointsReward: z.number().int().positive(),
      endsAt:       z.string().datetime().optional(),
      usageLimit:   z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Проверить что venue принадлежит этому партнёру
      const venue = await ctx.db.venue.findFirst({
        where: { id: input.venueId, ownerId: ctx.merchantId },
        select: { id: true },
      })
      if (!venue) throw new TRPCError({ code: "FORBIDDEN", message: "Venue not found" })

      const merchant = await ctx.db.merchant.findUnique({
        where: { id: ctx.merchantId },
        select: { pointsBalance: true },
      })
      if (!merchant) throw new TRPCError({ code: "NOT_FOUND" })

      // Стоимость акции = pointsReward (партнёр финансирует 1:1)
      const costPoints = input.pointsReward

      // Если указан лимит — проверить что хватит баланса
      if (input.usageLimit && merchant.pointsBalance < costPoints * input.usageLimit) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Not enough points. Need ${costPoints * input.usageLimit}, have ${merchant.pointsBalance}`,
        })
      }

      const offer = await ctx.db.offer.create({
        data: {
          venueId:      input.venueId,
          merchantId:   ctx.merchantId,
          title:        input.title,
          description:  input.description ?? null,
          pointsReward: input.pointsReward,
          costPoints,
          endsAt:       input.endsAt ? new Date(input.endsAt) : null,
          usageLimit:   input.usageLimit ?? null,
        },
      })

      return offer
    }),

  /** Список акций партнёра */
  mine: merchantProcedure
    .query(async ({ ctx }) => {
      return ctx.db.offer.findMany({
        where: { merchantId: ctx.merchantId },
        orderBy: { createdAt: "desc" },
        include: {
          venue: { select: { id: true, name: true } },
          _count: { select: { redemptions: true } },
        },
      })
    }),

  /** Деактивировать акцию */
  deactivate: merchantProcedure
    .input(z.object({ offerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const offer = await ctx.db.offer.findFirst({
        where: { id: input.offerId, merchantId: ctx.merchantId },
      })
      if (!offer) throw new TRPCError({ code: "NOT_FOUND" })

      await ctx.db.offer.update({
        where: { id: input.offerId },
        data: { active: false },
      })
      return { ok: true }
    }),
})
