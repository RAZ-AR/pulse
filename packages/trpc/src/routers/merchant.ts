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

  /**
   * Deeper analytics — daily time-series, hour-of-day heatmap,
   * reward conversion, customer segmentation, and city-rank for the venue.
   */
  analytics: merchantProcedure
    .input(z.object({ venueId: z.string(), days: z.number().int().min(7).max(90).default(30) }))
    .query(async ({ ctx, input }) => {
      // Ownership guard
      const venue = await ctx.db.venue.findFirst({
        where: { id: input.venueId, ownerId: ctx.merchantId },
        select: { id: true, city: true, category: true, pointsPerCurrency: true },
      })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND" })

      const now = new Date()
      const rangeStart = new Date(now)
      rangeStart.setDate(rangeStart.getDate() - (input.days - 1))
      rangeStart.setHours(0, 0, 0, 0)

      // 1. All purchase txns in range — drives daily, hourly, customer maps
      const txns = await ctx.db.transaction.findMany({
        where: {
          venueId: input.venueId,
          type: "PARTNER_PURCHASE",
          status: "VERIFIED",
          createdAt: { gte: rangeStart },
        },
        select: { createdAt: true, pointsEarned: true, amount: true, userId: true },
      })

      // Daily aggregation
      const dayKey = (d: Date) => {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, "0")
        const day = String(d.getDate()).padStart(2, "0")
        return `${y}-${m}-${day}`
      }
      type DayBucket = { date: string; points: number; txns: number; revenue: number; customerIds: Set<string> }
      const buckets = new Map<string, DayBucket>()
      for (let i = 0; i < input.days; i++) {
        const d = new Date(rangeStart)
        d.setDate(d.getDate() + i)
        const k = dayKey(d)
        buckets.set(k, { date: k, points: 0, txns: 0, revenue: 0, customerIds: new Set() })
      }
      for (const t of txns) {
        const b = buckets.get(dayKey(t.createdAt))
        if (!b) continue
        b.points += t.pointsEarned
        b.txns += 1
        b.revenue += t.amount ?? 0
        b.customerIds.add(t.userId)
      }
      const daily = Array.from(buckets.values()).map((b) => ({
        date: b.date,
        points: b.points,
        transactions: b.txns,
        revenue: b.revenue,
        uniqueCustomers: b.customerIds.size,
      }))

      // Hour-of-day heatmap (24 buckets, weekday-bucketed: 0=Sun..6=Sat)
      const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
      for (const t of txns) {
        const dow = t.createdAt.getDay()
        const hour = t.createdAt.getHours()
        heatmap[dow]![hour]! += 1
      }

      // 2. Reward conversion per reward
      const rewards = await ctx.db.reward.findMany({
        where: { venueId: input.venueId },
        select: { id: true, title: true, pointsCost: true, redeemedCount: true, isActive: true },
        orderBy: { redeemedCount: "desc" },
      })
      const usedRedemptions = await ctx.db.redemption.count({
        where: { reward: { venueId: input.venueId }, status: "USED" },
      })
      const totalRedemptions = await ctx.db.redemption.count({
        where: { reward: { venueId: input.venueId } },
      })
      const conversionRate = totalRedemptions > 0 ? usedRedemptions / totalRedemptions : 0

      // 3. Customer segmentation — count visits per customer in range
      const visitsByCustomer = new Map<string, number>()
      for (const t of txns) {
        visitsByCustomer.set(t.userId, (visitsByCustomer.get(t.userId) ?? 0) + 1)
      }
      let newCount = 0
      let returningCount = 0
      let frequentCount = 0
      for (const visits of visitsByCustomer.values()) {
        if (visits === 1) newCount += 1
        else if (visits <= 4) returningCount += 1
        else frequentCount += 1
      }

      // 4. City rank — among partner venues in the same city + category, sort by pointsPerCurrency
      const peers = await ctx.db.venue.findMany({
        where: {
          city: venue.city,
          category: venue.category,
          isPartner: true,
          pointsPerCurrency: { not: null },
        },
        select: { id: true, pointsPerCurrency: true },
        orderBy: { pointsPerCurrency: "desc" },
      })
      const rank = peers.findIndex((p) => p.id === venue.id) + 1 // 1-based; 0 if not found

      return {
        rangeStart: rangeStart.toISOString(),
        days: input.days,
        daily,
        heatmap,
        rewards: rewards.map((r) => ({
          id: r.id,
          title: r.title,
          pointsCost: r.pointsCost,
          redeemedCount: r.redeemedCount,
          isActive: r.isActive,
        })),
        redemptionConversion: {
          total: totalRedemptions,
          used: usedRedemptions,
          rate: conversionRate,
        },
        customers: {
          new: newCount,
          returning: returningCount,
          frequent: frequentCount,
          unique: visitsByCustomer.size,
        },
        cityRank: {
          rank,
          peerCount: peers.length,
          city: venue.city,
          category: venue.category,
        },
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
