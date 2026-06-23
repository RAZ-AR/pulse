import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { Prisma } from "@pulse/db"
import { router, merchantProcedure, scanProcedure } from "../trpc"

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
        // Coordinates + city travel together with the address so the pin on the
        // client map actually moves when a merchant picks a new place.
        city: z.string().min(1).optional(),
        lat: z.number().min(-90).max(90).optional(),
        lng: z.number().min(-180).max(180).optional(),
        workingHours: WorkingHoursSchema.optional(),
        enableRewards: z.boolean().optional(),
        enableDiscount: z.boolean().optional(),
        maxDiscountPercent: z.number().int().min(0).max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { venueId, name, description, address, city, lat, lng, workingHours, enableRewards, enableDiscount, maxDiscountPercent } = input
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
          ...(city !== undefined ? { city } : {}),
          ...(lat !== undefined ? { lat } : {}),
          ...(lng !== undefined ? { lng } : {}),
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
        venueId:      z.string(),
        offerType:    z.enum(["PURCHASE_PERCENT", "PRODUCT_BONUS", "REDEEM"]).default("REDEEM"),
        title:        z.string().min(1).max(100),
        description:  z.string().max(500).optional(),
        // PURCHASE_PERCENT
        bonusPercent: z.number().positive().optional(),
        // PRODUCT_BONUS / REDEEM
        pointsCost:   z.number().int().min(0).default(0),
        productName:  z.string().max(100).optional(),
        // Common
        cardColor:    z.string().optional(),
        endsAt:       z.string().datetime().optional(),
        // legacy
        imageUrl:     z.string().url().optional(),
        stockLimit:   z.number().int().positive().optional(),
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
          venueId:      input.venueId,
          title:        input.title,
          pointsCost:   input.pointsCost,
          offerType:    input.offerType,
          bonusPercent: input.bonusPercent ?? null,
          productName:  input.productName ?? null,
          cardColor:    input.cardColor ?? null,
          endsAt:       input.endsAt ? new Date(input.endsAt) : null,
          redemptionType: input.redemptionType,
          description:  input.description ?? null,
          imageUrl:     input.imageUrl ?? null,
          stockLimit:   input.stockLimit ?? null,
        },
      })
    }),

  updateReward: merchantProcedure
    .input(
      z.object({
        rewardId:     z.string(),
        title:        z.string().min(1).max(100).optional(),
        description:  z.string().max(500).optional(),
        pointsCost:   z.number().int().min(0).optional(),
        bonusPercent: z.number().positive().optional(),
        productName:  z.string().max(100).optional(),
        cardColor:    z.string().nullable().optional(),
        endsAt:       z.string().datetime().nullable().optional(),
        isActive:     z.boolean().optional(),
        stockLimit:   z.number().int().positive().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { rewardId, ...fields } = input
      const reward = await ctx.db.reward.findFirst({
        where: { id: rewardId, venue: { ownerId: ctx.merchantId } },
        select: { id: true, redeemedCount: true, offerType: true },
      })
      if (!reward) throw new TRPCError({ code: "NOT_FOUND" })
      // Cannot edit content fields of an offer that's already been used
      const isContentEdit = fields.title !== undefined || fields.description !== undefined
        || fields.pointsCost !== undefined || fields.bonusPercent !== undefined
        || fields.productName !== undefined
      if (isContentEdit && reward.offerType !== "REDEEM" && reward.redeemedCount > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot edit an offer that is already running" })
      }
      return ctx.db.reward.update({
        where: { id: rewardId },
        data: {
          ...(fields.title        !== undefined ? { title: fields.title }               : {}),
          ...(fields.description  !== undefined ? { description: fields.description ?? null } : {}),
          ...(fields.pointsCost   !== undefined ? { pointsCost: fields.pointsCost }     : {}),
          ...(fields.bonusPercent !== undefined ? { bonusPercent: fields.bonusPercent } : {}),
          ...(fields.productName  !== undefined ? { productName: fields.productName ?? null } : {}),
          ...(fields.cardColor    !== undefined ? { cardColor: fields.cardColor ?? null } : {}),
          ...(fields.endsAt       !== undefined ? { endsAt: fields.endsAt ? new Date(fields.endsAt) : null } : {}),
          ...(fields.isActive     !== undefined ? { isActive: fields.isActive }         : {}),
          ...(fields.stockLimit   !== undefined ? { stockLimit: fields.stockLimit }     : {}),
        },
      })
    }),

  pauseOffer: merchantProcedure
    .input(z.object({ rewardId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const reward = await ctx.db.reward.findFirst({
        where: { id: input.rewardId, venue: { ownerId: ctx.merchantId } },
        select: { id: true },
      })
      if (!reward) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.reward.update({ where: { id: input.rewardId }, data: { isPaused: true } })
    }),

  resumeOffer: merchantProcedure
    .input(z.object({ rewardId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const reward = await ctx.db.reward.findFirst({
        where: { id: input.rewardId, venue: { ownerId: ctx.merchantId } },
        select: { id: true },
      })
      if (!reward) throw new TRPCError({ code: "NOT_FOUND" })
      return ctx.db.reward.update({ where: { id: input.rewardId }, data: { isPaused: false, isActive: true } })
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

  checkins: merchantProcedure
    .input(
      z.object({
        venueId: z.string(),
        limit: z.number().default(50),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const checkins = await ctx.db.checkin.findMany({
        where: { venueId: input.venueId, venue: { ownerId: ctx.merchantId } },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      })
      let nextCursor: string | undefined
      if (checkins.length > input.limit) nextCursor = checkins.pop()!.id
      return { checkins, nextCursor }
    }),

  /**
   * Lightweight dashboard for the Mini App home screen.
   * Returns today's stats + active rewards in a single query.
   */
  miniDashboard: merchantProcedure
    .input(z.object({ venueId: z.string() }))
    .query(async ({ ctx, input }) => {
      const venue = await ctx.db.venue.findFirst({
        where: { id: input.venueId, ownerId: ctx.merchantId },
        select: { id: true, name: true, pointsPerCurrency: true, currency: true },
      })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND" })

      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const weekStart = new Date(todayStart)
      weekStart.setDate(weekStart.getDate() - 6) // 7 buckets incl. today

      const [todayStats, activeRewards, weekTxns] = await Promise.all([
        ctx.db.transaction.aggregate({
          where: { venueId: input.venueId, type: "PARTNER_PURCHASE", createdAt: { gte: todayStart } },
          _sum: { pointsEarned: true },
          _count: { _all: true },
        }),
        ctx.db.reward.findMany({
          where: { venueId: input.venueId, isActive: true },
          select: { id: true, title: true, pointsCost: true, redeemedCount: true },
          orderBy: { pointsCost: "asc" },
        }),
        ctx.db.transaction.findMany({
          where: { venueId: input.venueId, type: "PARTNER_PURCHASE", createdAt: { gte: weekStart } },
          select: { pointsEarned: true, createdAt: true },
        }),
      ])

      // Bucket the last 7 days (oldest → today) for the home bar chart.
      const week = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart)
        d.setDate(weekStart.getDate() + i)
        return { date: d.toISOString().slice(0, 10), points: 0, transactions: 0 }
      })
      const idxByDate = new Map(week.map((b, i) => [b.date, i]))
      for (const t of weekTxns) {
        const key = new Date(t.createdAt).toISOString().slice(0, 10)
        const i = idxByDate.get(key)
        if (i != null) { week[i]!.points += t.pointsEarned ?? 0; week[i]!.transactions += 1 }
      }
      const weekPointsTotal = week.reduce((s, b) => s + b.points, 0)
      const weekAvg = weekPointsTotal / 7

      return {
        today: {
          transactions: todayStats._count._all,
          pointsIssued: todayStats._sum.pointsEarned ?? 0,
        },
        week,
        weekAvg,
        activeRewards,
        venue,
      }
    }),

  /**
   * List all rewards for a venue (active and inactive).
   */
  listRewards: merchantProcedure
    .input(z.object({ venueId: z.string() }))
    .query(async ({ ctx, input }) => {
      const venue = await ctx.db.venue.findFirst({
        where: { id: input.venueId, ownerId: ctx.merchantId },
        select: { id: true },
      })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND" })

      return ctx.db.reward.findMany({
        where: { venueId: input.venueId },
        select: {
          id: true, title: true, description: true, pointsCost: true,
          isActive: true, isPaused: true, redeemedCount: true,
          offerType: true, bonusPercent: true, productName: true,
          cardColor: true, endsAt: true, createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }],
      })
    }),

  /**
   * Look up a customer by their referral code (shown as QR in the mobile app).
   * Returns name + current points balance — shown to merchant before confirming transaction.
   */
  /**
   * Accessible by both owner (merchantId) and staff (staffId).
   */
  resolveCustomer: scanProcedure
    .input(z.object({ referralCode: z.string().min(1).max(20) }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { referralCode: input.referralCode.toUpperCase().trim() },
        select: {
          id: true,
          name: true,
          earnedPoints: true,
          welcomePoints: true,
          avatarUrl: true,
        },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" })
      return {
        userId: user.id,
        name: user.name ?? "Customer",
        totalPoints: user.earnedPoints + user.welcomePoints,
        avatarUrl: user.avatarUrl,
      }
    }),

  /**
   * Deduct points from a customer as payment.
   * Used when customer pays with ayoo points at the venue.
   * Anti-fraud: checks balance, ownership, partner status, and daily redemption limit.
   */
  /**
   * Full venue settings — called when partner opens the Edit screen.
   */
  venueSettings: merchantProcedure
    .input(z.object({ venueId: z.string() }))
    .query(async ({ ctx, input }) => {
      const venue = await ctx.db.venue.findFirst({
        where: { id: input.venueId, ownerId: ctx.merchantId },
        select: {
          id: true, name: true, city: true, address: true,
          pointsPerCurrency: true, currency: true,
          phone: true, instagram: true, tiktok: true,
          telegram: true, website: true, googleMapsUrl: true,
        },
      })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND" })
      return venue
    }),

  /**
   * Update editable venue fields from the Mini App.
   */
  updateVenueMini: merchantProcedure
    .input(z.object({
      venueId: z.string(),
      name: z.string().min(1).max(100).optional(),
      city: z.string().min(1).optional(),
      address: z.string().min(1).optional(),
      pointsPerCurrency: z.number().positive().optional(),
      phone: z.string().nullable().optional(),
      instagram: z.string().nullable().optional(),
      tiktok: z.string().nullable().optional(),
      telegram: z.string().nullable().optional(),
      website: z.string().nullable().optional(),
      googleMapsUrl: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { venueId, ...fields } = input
      const venue = await ctx.db.venue.findFirst({
        where: { id: venueId, ownerId: ctx.merchantId },
        select: { id: true },
      })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND" })

      // Build update object with only defined keys
      const data: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) {
        if (v !== undefined) data[k] = v === "" ? null : v
      }
      return ctx.db.venue.update({
        where: { id: venueId },
        data,
        select: {
          id: true, name: true, category: true, city: true, address: true,
          pointsPerCurrency: true, currency: true,
          phone: true, instagram: true, tiktok: true,
          telegram: true, website: true, googleMapsUrl: true,
        },
      })
    }),

  /**
   * Delete a reward. If it has used redemptions, deactivate instead.
   */
  deleteReward: merchantProcedure
    .input(z.object({ rewardId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const reward = await ctx.db.reward.findFirst({
        where: { id: input.rewardId, venue: { ownerId: ctx.merchantId } },
        select: { id: true },
      })
      if (!reward) throw new TRPCError({ code: "NOT_FOUND" })

      const usedCount = await ctx.db.redemption.count({
        where: { rewardId: input.rewardId, status: "USED" },
      })
      if (usedCount > 0) {
        // Has history — just deactivate
        return ctx.db.reward.update({ where: { id: input.rewardId }, data: { isActive: false } })
      }
      return ctx.db.reward.delete({ where: { id: input.rewardId } })
    }),

  /**
   * Add a new venue from the Mini App (authenticated partner).
   * Lighter than the public registration endpoint — uses JWT, no initData needed.
   */
  addVenueMini: merchantProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      category: z.enum(["CAFE", "RESTAURANT", "RETAIL", "SERVICE", "OTHER"]),
      city: z.string().min(1),
      address: z.string().min(1),
      pointsPerCurrency: z.number().positive(),
      currency: z.string().default("RSD"),
      lat: z.number().default(0),
      lng: z.number().default(0),
      sourcePlaceId: z.string().optional(),
      logoUrl: z.string().optional(),
      socials: z.object({
        instagram: z.string().optional(),
        tiktok: z.string().optional(),
        telegram: z.string().optional(),
        website: z.string().optional(),
        googleMapsUrl: z.string().optional(),
        phone: z.string().optional(),
      }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { name, category, city, address, pointsPerCurrency, currency, lat, lng,
              sourcePlaceId, logoUrl, socials } = input

      // Update merchant logo if provided
      if (logoUrl) {
        await ctx.db.merchant.update({
          where: { id: ctx.merchantId },
          data: { logoUrl },
        })
      }

      const venue = await ctx.db.venue.create({
        data: {
          name, category, city, address, country: "Serbia",
          lat, lng, photos: [],
          ownerId: ctx.merchantId,
          isPartner: true, partnerSince: new Date(),
          pointsPerCurrency, currency,
          ...(sourcePlaceId ? { sourceProvider: "google_maps", sourcePlaceId } : {}),
          phone:         socials?.phone?.trim()         || null,
          website:       socials?.website?.trim()       || null,
          instagram:     socials?.instagram?.trim()     || null,
          tiktok:        socials?.tiktok?.trim()        || null,
          telegram:      socials?.telegram?.trim()      || null,
          googleMapsUrl: socials?.googleMapsUrl?.trim() || null,
        },
        select: { id: true, name: true, category: true, city: true, address: true,
                  pointsPerCurrency: true, currency: true },
      })
      return venue
    }),

  /**
   * Accessible by both owner (merchantId) and staff (staffId).
   * Staff can only deduct points at their assigned venue.
   */
  redeemPoints: scanProcedure
    .input(
      z.object({
        userId: z.string(),
        venueId: z.string(),
        points: z.number().int().positive().max(100_000),
        description: z.string().max(200).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Staff: must operate on their own venue only
      if (ctx.staffId && ctx.staffVenueId && input.venueId !== ctx.staffVenueId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Staff can only operate on their assigned venue" })
      }

      // 1. Verify venue — owner check for merchant, staffVenueId match for staff
      const venueWhere = ctx.merchantId
        ? { id: input.venueId, ownerId: ctx.merchantId }
        : { id: input.venueId }

      const venue = await ctx.db.venue.findFirst({
        where: venueWhere,
        select: { id: true, name: true, isPartner: true },
      })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" })
      if (!venue.isPartner) throw new TRPCError({ code: "BAD_REQUEST", message: "Venue is not an active partner" })

      // 2. Load customer balance
      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { id: true, name: true, earnedPoints: true, welcomePoints: true },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Customer not found" })

      const totalBalance = user.earnedPoints + user.welcomePoints
      if (totalBalance < input.points) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient points. Balance: ${totalBalance}, requested: ${input.points}`,
        })
      }

      // 3. Anti-fraud: max 5 redemptions per customer per venue per day
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const todayRedemptions = await ctx.db.transaction.count({
        where: {
          userId: input.userId,
          venueId: input.venueId,
          type: "REWARD_REDEEMED",
          createdAt: { gte: todayStart },
        },
      })
      if (todayRedemptions >= 5) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Daily redemption limit reached for this customer" })
      }

      // 4. Deduct points: earnedPoints first, then welcomePoints
      const earnedDeduct = Math.min(input.points, user.earnedPoints)
      const welcomeDeduct = input.points - earnedDeduct

      await ctx.db.$transaction(async (tx) => {
        const redemptionsToday = await tx.transaction.count({
          where: {
            userId: input.userId,
            venueId: input.venueId,
            type: "REWARD_REDEEMED",
            createdAt: { gte: todayStart },
          },
        })
        if (redemptionsToday >= 5) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Daily redemption limit reached for this customer" })
        }

        const userUpdate = await tx.user.updateMany({
          where: {
            id: input.userId,
            earnedPoints: { gte: earnedDeduct },
            welcomePoints: { gte: welcomeDeduct },
          },
          data: {
            earnedPoints: { decrement: earnedDeduct },
            welcomePoints: { decrement: welcomeDeduct },
          },
        })
        if (userUpdate.count !== 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Insufficient points" })
        }

        await tx.transaction.create({
          data: {
            userId: input.userId,
            venueId: input.venueId,
            type: "REWARD_REDEEMED",
            pointsEarned: -input.points,
            status: "VERIFIED",
            verifiedAt: new Date(),
          },
        })
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })

      return {
        success: true,
        pointsDeducted: input.points,
        newBalance: totalBalance - input.points,
        customerName: user.name ?? "Customer",
      }
    }),
})
