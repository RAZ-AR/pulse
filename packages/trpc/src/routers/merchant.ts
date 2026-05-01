import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, merchantProcedure } from "../trpc"

const WorkingHoursSchema = z.object({
  mon: z.string().optional(),
  tue: z.string().optional(),
  wed: z.string().optional(),
  thu: z.string().optional(),
  fri: z.string().optional(),
  sat: z.string().optional(),
  sun: z.string().optional(),
})

export const merchantRouter = router({
  dashboard: merchantProcedure.query(async ({ ctx }) => {
    const venues = await ctx.db.venue.findMany({
      where: { ownerId: ctx.merchantId },
      select: {
        id: true, name: true, isPartner: true,
        pointsPerCurrency: true, currency: true,
        boostMultiplier: true, boostUntil: true,
        subscriptionTier: true,
        _count: { select: { transactions: true, rewards: true } },
      },
    })
    // Full metrics in Tier 2 Step 12
    return { venues, metrics: null }
  }),

  myVenues: merchantProcedure.query(async ({ ctx }) => {
    return ctx.db.venue.findMany({
      where: { ownerId: ctx.merchantId },
      include: { rewards: { where: { isActive: true }, orderBy: { pointsCost: "asc" } } },
      orderBy: { name: "asc" },
    })
  }),

  createVenue: merchantProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        category: z.enum(["CAFE", "RESTAURANT", "RETAIL", "SERVICE", "OTHER"]),
        description: z.string().max(500).optional(),
        address: z.string().min(1),
        city: z.string().min(1),
        country: z.string().min(1).default("Serbia"),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        workingHours: WorkingHoursSchema.optional(),
        pointsPerCurrency: z.number().positive().optional(),
        currency: z.string().length(3).default("RSD"),
        enableRewards: z.boolean().default(true),
        enableDiscount: z.boolean().default(false),
        maxDiscountPercent: z.number().int().min(0).max(100).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.venue.create({
        data: { ...input, ownerId: ctx.merchantId },
      })
    }),

  updateVenue: merchantProcedure
    .input(
      z.object({
        venueId: z.string(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        address: z.string().optional(),
        workingHours: WorkingHoursSchema.optional(),
        enableRewards: z.boolean().optional(),
        enableDiscount: z.boolean().optional(),
        maxDiscountPercent: z.number().int().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { venueId, ...data } = input
      const venue = await ctx.db.venue.findFirst({
        where: { id: venueId, ownerId: ctx.merchantId },
      })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.venue.update({ where: { id: venueId }, data })
    }),

  updateRate: merchantProcedure
    .input(
      z.object({
        venueId: z.string(),
        pointsPerCurrency: z.number().positive(),
        currency: z.string().length(3),
        // Optional temporary boost
        boostMultiplier: z.number().min(1).max(10).optional(),
        boostUntil: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const venue = await ctx.db.venue.findFirst({
        where: { id: input.venueId, ownerId: ctx.merchantId },
      })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.venue.update({
        where: { id: input.venueId },
        data: {
          pointsPerCurrency: input.pointsPerCurrency,
          currency: input.currency,
          boostMultiplier: input.boostMultiplier,
          boostUntil: input.boostUntil,
        },
      })
    }),

  createReward: merchantProcedure
    .input(
      z.object({
        venueId: z.string(),
        title: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        pointsCost: z.number().int().positive(),
        imageUrl: z.string().url().optional(),
        stockLimit: z.number().int().positive().optional(),
        redemptionType: z.enum(["FULL_FREE", "PERCENT_OFF", "FIXED_AMOUNT_OFF"]).default("FULL_FREE"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const venue = await ctx.db.venue.findFirst({
        where: { id: input.venueId, ownerId: ctx.merchantId },
      })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.reward.create({ data: input })
    }),

  updateReward: merchantProcedure
    .input(
      z.object({
        rewardId: z.string(),
        title: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        pointsCost: z.number().int().positive().optional(),
        isActive: z.boolean().optional(),
        stockLimit: z.number().int().positive().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { rewardId, ...data } = input
      const reward = await ctx.db.reward.findFirst({
        where: { id: rewardId, venue: { ownerId: ctx.merchantId } },
      })
      if (!reward) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.reward.update({ where: { id: rewardId }, data })
    }),

  transactions: merchantProcedure
    .input(
      z.object({
        venueId: z.string(),
        limit: z.number().default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const transactions = await ctx.db.transaction.findMany({
        where: { venueId: input.venueId, venue: { ownerId: ctx.merchantId } },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: { venue: { select: { id: true, name: true } } },
      })
      let nextCursor: string | undefined
      if (transactions.length > input.limit) nextCursor = transactions.pop()!.id
      return { transactions, nextCursor }
    }),
})
