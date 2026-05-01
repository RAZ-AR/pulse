import { z } from "zod"
import { router, publicProcedure, protectedProcedure } from "../trpc"

export const venueRouter = router({
  list: publicProcedure
    .input(
      z.object({
        city: z.string().optional(),
        category: z.enum(["CAFE", "RESTAURANT", "RETAIL", "SERVICE", "OTHER"]).optional(),
        isPartner: z.boolean().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const venues = await ctx.db.venue.findMany({
        where: {
          city: input.city,
          category: input.category,
          isPartner: input.isPartner,
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { name: "asc" },
      })
      let nextCursor: string | undefined
      if (venues.length > input.limit) {
        nextCursor = venues.pop()!.id
      }
      return { venues, nextCursor }
    }),

  detail: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.venue.findUnique({
        where: { id: input.id },
        include: { rewards: { where: { isActive: true } } },
      })
    }),

  search: publicProcedure
    .input(z.object({ query: z.string().min(1), limit: z.number().default(10) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.venue.findMany({
        where: {
          name: { contains: input.query, mode: "insensitive" },
        },
        take: input.limit,
      })
    }),

  nearby: protectedProcedure
    .input(
      z.object({
        lat: z.number(),
        lng: z.number(),
        radiusKm: z.number().default(1),
        limit: z.number().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      // Bounding box approximation; replace with PostGIS for production
      const deg = input.radiusKm / 111
      return ctx.db.venue.findMany({
        where: {
          lat: { gte: input.lat - deg, lte: input.lat + deg },
          lng: { gte: input.lng - deg, lte: input.lng + deg },
        },
        take: input.limit,
        orderBy: { name: "asc" },
      })
    }),
})
