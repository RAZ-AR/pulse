import { z } from "zod"
import { router, publicProcedure, protectedProcedure } from "../trpc"
import { boundingBox, haversineMeters } from "@pulse/shared"
import { enrichVenueFromGoogle } from "../lib/google-enrich"

const VenueCategoryEnum = z.enum(["CAFE", "RESTAURANT", "RETAIL", "SERVICE", "BEAUTY", "FITNESS", "YOGA", "OTHER"])

const venuePublicSelect = {
  id: true,
  name: true,
  category: true,
  city: true,
  country: true,
  address: true,
  lat: true,
  lng: true,
  photos: true,
  description: true,
  workingHours: true,
  isPartner: true,
  pointsPerCurrency: true,
  currency: true,
  boostMultiplier: true,
  boostUntil: true,
  subscriptionTier: true,
  enableDiscount: true,
  maxDiscountPercent: true,
  googleRating: true,
  googleReviews: true,
  yandexRating: true,
  woltRating: true,
  sourceProvider: true,
  sourcePlaceId: true,
  sourceUrl: true,
  sourceUpdatedAt: true,
  phone: true,
  website: true,
  instagram: true,
  openingHoursText: true,
  specialOffers: true,
  priceLevel: true,
  googleMapsUrl: true,
  lastEnrichedAt: true,
} as const

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
        select: venuePublicSelect,
      })

      let nextCursor: string | undefined
      if (venues.length > input.limit) nextCursor = venues.pop()!.id

      return { venues, nextCursor }
    }),

  detail: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const detailSelect = {
        ...venuePublicSelect,
        rewards: {
          where: { isActive: true },
          select: {
            id: true,
            title: true,
            description: true,
            pointsCost: true,
            imageUrl: true,
            redemptionType: true,
          },
          orderBy: { pointsCost: "asc" as const },
        },
      }

      const venue = await ctx.db.venue.findUnique({ where: { id: input.id }, select: detailSelect })
      if (!venue) return null

      // Lazy Google enrichment: fill rating/hours/price on first open (best-effort, cached).
      const updated = await enrichVenueFromGoogle(ctx.db, {
        id: venue.id,
        name: venue.name,
        city: venue.city,
        lat: venue.lat,
        lng: venue.lng,
        phone: venue.phone,
        website: venue.website,
        lastEnrichedAt: venue.lastEnrichedAt,
      })
      if (!updated) return venue
      return (await ctx.db.venue.findUnique({ where: { id: input.id }, select: detailSelect })) ?? venue
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
        select: venuePublicSelect,
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
        select: venuePublicSelect,
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

  // Yelp-like discovery: search + filters + badges + pagination.
  discover: publicProcedure
    .input(
      z.object({
        query: z.string().trim().optional(),
        city: z.string().optional(),
        categories: z.array(VenueCategoryEnum).optional(),
        partnerOnly: z.boolean().optional(),
        hasOffer: z.boolean().optional(),
        minRating: z.number().min(0).max(5).optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        sort: z.enum(["partner", "rating", "rate", "name"]).default("partner"),
        cursor: z.number().min(0).default(0),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const now = new Date()
      const activeOffer = { active: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }
      const where = {
        ...(input.query ? { name: { contains: input.query, mode: "insensitive" as const } } : {}),
        ...(input.city ? { city: { equals: input.city, mode: "insensitive" as const } } : {}),
        ...(input.categories?.length ? { category: { in: input.categories } } : {}),
        ...(input.partnerOnly ? { isPartner: true } : {}),
        ...(typeof input.minRating === "number" ? { googleRating: { gte: input.minRating } } : {}),
        ...(input.hasOffer ? { offers: { some: activeOffer } } : {}),
      }
      const orderBy =
        input.sort === "rating" ? [{ googleRating: { sort: "desc" as const, nulls: "last" as const } }]
        : input.sort === "rate" ? [{ pointsPerCurrency: { sort: "desc" as const, nulls: "last" as const } }]
        : input.sort === "name" ? [{ name: "asc" as const }]
        : [{ isPartner: "desc" as const }, { googleRating: { sort: "desc" as const, nulls: "last" as const } }]

      const rows = await ctx.db.venue.findMany({
        where,
        orderBy,
        skip: input.cursor,
        take: input.limit + 1,
        select: { ...venuePublicSelect, offers: { where: activeOffer, select: { id: true }, take: 1 } },
      })

      const hasMore = rows.length > input.limit
      const items = rows.slice(0, input.limit).map((v) => {
        const { offers, ...rest } = v
        return {
          ...rest,
          hasOffer: offers.length > 0,
          distanceMeters:
            input.lat != null && input.lng != null
              ? Math.round(haversineMeters(input.lat, input.lng, v.lat, v.lng))
              : null,
        }
      })
      return { items, nextCursor: hasMore ? input.cursor + input.limit : null }
    }),

  // The ayoo core: venues competing by points rate — partners sorted by generosity
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
        select: venuePublicSelect,
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
