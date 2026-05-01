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
    return { venues }
  }),

  stats: merchantProcedure
    .input(z.object({ venueId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Ownership guard
      const venue = await ctx.db.venue.findFirst({
        where: { id: input.venueId, ownerId: ctx.merchantId },
        select: { id: true },
      })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND" })

      const now = new Date()
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0, 0, 0, 0)
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      const [
        todayStats,
        weekStats,
        monthStats,
        totalStats,
        topCustomers,
        redemptionCount,
      ] = await Promise.all([
        ctx.db.transaction.aggregate({
          where: { venueId: input.venueId, type: "PARTNER_PURCHASE", createdAt: { gte: todayStart } },
          _sum: { pointsEarned: true },
          _count: { _all: true },
        }),
        ctx.db.transaction.aggregate({
          where: { venueId: input.venueId, type: "PARTNER_PURCHASE", createdAt: { gte: weekStart } },
          _sum: { pointsEarned: true },
          _count: { _all: true },
        }),
        ctx.db.transaction.aggregate({
          where: { venueId: input.venueId, type: "PARTNER_PURCHASE", createdAt: { gte: monthStart } },
          _sum: { pointsEarned: true },
          _count: { _all: true },
        }),
        ctx.db.transaction.aggregate({
          where: { venueId: input.venueId, type: "PARTNER_PURCHASE" },
          _sum: { pointsEarned: true },
          _count: { _all: true },
        }),
        // Top 5 customers by points earned at this venue
        ctx.db.transaction.groupBy({
          by: ["userId"],
          where: { venueId: input.venueId, type: "PARTNER_PURCHASE", status: "VERIFIED" },
          _sum: { pointsEarned: true },
          orderBy: { _sum: { pointsEarned: "desc" } },
          take: 5,
        }),
        ctx.db.redemption.count({
          where: { reward: { venueId: input.venueId }, status: "USED" },
        }),
      ])

      // Resolve top customer names
      const customerIds = topCustomers.map((c) => c.userId)
      const customerNames = await ctx.db.user.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true, avatarUrl: true },
      })
      const nameMap = Object.fromEntries(customerNames.map((u) => [u.id, u]))

      return {
        today: {
          pointsIssued: todayStats._sum.pointsEarned ?? 0,
          transactions: todayStats._count._all,
        },
        week: {
          pointsIssued: weekStats._sum.pointsEarned ?? 0,
          transactions: weekStats._count._all,
        },
        month: {
          pointsIssued: monthStats._sum.pointsEarned ?? 0,
          transactions: monthStats._count._all,
        },
        allTime: {
          pointsIssued: totalStats._sum.pointsEarned ?? 0,
          transactions: totalStats._count._all,
          rewardsRedeemed: redemptionCount,
        },
        topCustomers: topCustomers.map((c) => ({
          userId: c.userId,
          name: nameMap[c.userId]?.name ?? "Unknown",
          avatarUrl: nameMap[c.userId]?.avatarUrl ?? null,
          pointsEarned: c._sum.pointsEarned ?? 0,
        })),
      }
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
      const { description, pointsPerCurrency, workingHours, ...rest } = input
      return ctx.db.venue.create({
        data: {
          ...rest,
          ownerId: ctx.merchantId,
          description: description ?? null,
          ...(pointsPerCurrency !== undefined ? { pointsPerCurrency } : {}),
          ...(workingHours !== undefined ? { workingHours } : {}),
        },
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
      const { venueId, name, description, address, workingHours, enableRewards, enableDiscount, maxDiscountPercent } = input
      const venue = await ctx.db.venue.findFirst({
        where: { id: venueId, ownerId: ctx.merchantId },
      })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.venue.update({
        where: { id: venueId },
        data: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description: description ?? null } : {}),
          ...(address !== undefined ? { address } : {}),
          ...(workingHours !== undefined ? { workingHours } : {}),
          ...(enableRewards !== undefined ? { enableRewards } : {}),
          ...(enableDiscount !== undefined ? { enableDiscount } : {}),
          ...(maxDiscountPercent !== undefined ? { maxDiscountPercent } : {}),
        },
      })
    }),

  updateRate: merchantProcedure
    .input(
      z.object({
        venueId: z.string(),
        pointsPerCurrency: z.number().positive(),
        currency: z.string().length(3),
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
          ...(input.boostMultiplier !== undefined ? { boostMultiplier: input.boostMultiplier } : {}),
          ...(input.boostUntil !== undefined ? { boostUntil: input.boostUntil } : {}),
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
      return ctx.db.reward.create({
        data: {
          venueId: input.venueId,
          title: input.title,
          pointsCost: input.pointsCost,
          redemptionType: input.redemptionType,
          description: input.description ?? null,
          imageUrl: input.imageUrl ?? null,
          stockLimit: input.stockLimit ?? null,
        },
      })
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
      const { rewardId, title, description, pointsCost, isActive, stockLimit } = input
      const reward = await ctx.db.reward.findFirst({
        where: { id: rewardId, venue: { ownerId: ctx.merchantId } },
      })
      if (!reward) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.reward.update({
        where: { id: rewardId },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description: description ?? null } : {}),
          ...(pointsCost !== undefined ? { pointsCost } : {}),
          ...(isActive !== undefined ? { isActive } : {}),
          ...(stockLimit !== undefined ? { stockLimit } : {}),
        },
      })
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
        ...(input.cursor ? { cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "desc" },
        include: { venue: { select: { id: true, name: true } } },
      })
      let nextCursor: string | undefined
      if (transactions.length > input.limit) nextCursor = transactions.pop()!.id
      return { transactions, nextCursor }
    }),
})
