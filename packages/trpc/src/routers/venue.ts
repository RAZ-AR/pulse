import { z } from "zod"
import { router, publicProcedure, protectedProcedure } from "../trpc"
import { boundingBox, haversineMeters } from "@pulse/shared"

const VenueCategoryEnum = z.enum(["CAFE", "RESTAURANT", "RETAIL", "SERVICE", "OTHER"])

export const venueRouter = router({
  list: publicProcedure
    .input(
      z.object({
        city: z.string().optional(),
        category: VenueCategoryEnum.optional(),
        isPartner: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const venues = await ctx.db.venue.findMany({
        where: {
          ...(input.city ? { city: { equals: input.city, mode: "insensitive" } } : {}),
          ...(input.category ? { category: input.category } : {}),
          ...(input.isPartner !== undefined ? { isPartner: input.isPartner } : {}),
        },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor } } : {}),
        orderBy: [{ isPartner: "desc" }, { pointsPerCurrency: "desc" }, { name: "asc" }],
        select: {
          id: true, name: true, category: true, city: true, country: true,
          address: true, lat: true, lng: true, photos: true,
          isPartner: true, pointsPerCurrency: true, currency: true,
          boostMultiplier: true, boostUntil: true,
          subscriptionTier: true,
        },
      })

      let nextCursor: string | undefined
      if (venues.length > input.limit) nextCursor = venues.pop()!.id

      return { venues, nextCursor }
    }),

  detail: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.venue.findUnique({
        where: { id: input.id },
        include: {
          rewards: {
            where: { isActive: true },
            orderBy: { pointsCost: "asc" },
          },
        },
      })
    }),

  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1),
        city: z.string().optional(),
        limit: z.number().default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.venue.findMany({
        where: {
          name: { contains: input.query, mode: "insensitive" },
          ...(input.city ? { city: { equals: input.city, mode: "insensitive" } } : {}),
        },
        take: input.limit,
        select: {
          id: true, name: true, category: true, city: true, address: true,
          isPartner: true, pointsPerCurrency: true, currency: true, photos: true,
        },
      })
    }),

  nearby: protectedProcedure
    .input(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusKm: z.number().min(0.1).max(50).default(1),
        category: VenueCategoryEnum.optional(),
        isPartner: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const box = boundingBox(input.lat, input.lng, input.radiusKm)

      // Step 1: cheap bounding box filter in Postgres
      const candidates = await ctx.db.venue.findMany({
        where: {
          lat: { gte: box.minLat, lte: box.maxLat },
          lng: { gte: box.minLng, lte: box.maxLng },
          ...(input.category ? { category: input.category } : {}),
          ...(input.isPartner !== undefined ? { isPartner: input.isPartner } : {}),
        },
        select: {
          id: true, name: true, category: true, city: true, address: true,
          lat: true, lng: true, photos: true,
          isPartner: true, pointsPerCurrency: true, currency: true,
          boostMultiplier: true, boostUntil: true,
          subscriptionTier: true,
        },
      })

      // Step 2: precise Haversine filter + sort by distance
      const radiusMeters = input.radiusKm * 1000
      return candidates
        .map((v) => ({
          ...v,
          distanceMeters: Math.round(haversineMeters(input.lat, input.lng, v.lat, v.lng)),
        }))
        .filter((v) => v.distanceMeters <= radiusMeters)
        .sort((a, b) => a.distanceMeters - b.distanceMeters)
        .slice(0, input.limit)
    }),

  // The PULSE core: venues competing by points rate — partners sorted by generosity
  rateLeaderboard: publicProcedure
    .input(
      z.object({
        city: z.string().optional(),
        category: VenueCategoryEnum.optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const venues = await ctx.db.venue.findMany({
        where: {
          isPartner: true,
          pointsPerCurrency: { not: null },
          ...(input.city ? { city: { equals: input.city, mode: "insensitive" } } : {}),
          ...(input.category ? { category: input.category } : {}),
        },
        orderBy: [
          // FEATURED venues bubble to top regardless of rate, then PRO, then BASIC/null,
          // then within each tier rate desc. Postgres sorts NULL last — we want
          // FEATURED first (alphabetically: BASIC < FEATURED < PRO), so sort by
          // tier desc then rate desc — but we need FEATURED > PRO > BASIC > null.
          // Easiest: sort by a synthetic — fall back to client-side reorder below.
          { pointsPerCurrency: "desc" },
        ],
        take: input.limit,
        select: {
          id: true, name: true, category: true, city: true, address: true,
          lat: true, lng: true, photos: true,
          pointsPerCurrency: true, currency: true,
          boostMultiplier: true, boostUntil: true,
          subscriptionTier: true,
        },
      })

      // Annotate with effective rate (applying active boosts), then reorder so
      // FEATURED tier surfaces first while preserving rate ordering within each tier.
      const TIER_RANK: Record<string, number> = { FEATURED: 3, PRO: 2, BASIC: 1 }
      const now = new Date()
      return venues
        .map((v) => {
          const boostActive = v.boostUntil && v.boostUntil > now
          const effectiveRate = v.pointsPerCurrency! * (boostActive ? (v.boostMultiplier ?? 1) : 1)
          const rsdPerPoint = Math.round(1 / effectiveRate)
          return { ...v, effectiveRate, rsdPerPoint, boostActive: !!boostActive }
        })
        .sort((a, b) => {
          const ta = TIER_RANK[a.subscriptionTier ?? ""] ?? 0
          const tb = TIER_RANK[b.subscriptionTier ?? ""] ?? 0
          if (ta !== tb) return tb - ta
          return b.effectiveRate - a.effectiveRate
        })
    }),
})
