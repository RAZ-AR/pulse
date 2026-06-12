import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, publicProcedure, protectedProcedure } from "../trpc"

// Reward for the first genuine review at a venue you've actually visited.
const REVIEW_POINTS = 25
const MIN_TEXT_LENGTH = 20
const VISIT_TYPES = ["RECEIPT_SCAN", "CHECKIN_PHOTO", "PARTNER_PURCHASE"] as const

export const reviewRouter = router({
  /**
   * Public list of reviews for a venue, newest first.
   * Used on the Venue Detail screen.
   */
  listByVenue: publicProcedure
    .input(z.object({ venueId: z.string(), limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => {
      const reviews = await ctx.db.review.findMany({
        where: { venueId: input.venueId },
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      })

      const agg = await ctx.db.review.aggregate({
        where: { venueId: input.venueId },
        _avg: { rating: true },
        _count: { _all: true },
      })

      return {
        reviews,
        averageRating: agg._avg.rating ?? null,
        count: agg._count._all,
      }
    }),

  /** A user can leave at most one review per venue (enforced by unique index). */
  upsert: protectedProcedure
    .input(
      z.object({
        venueId: z.string(),
        rating: z.number().int().min(1).max(5),
        text: z.string().max(1000).trim().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const venue = await ctx.db.venue.findUnique({ where: { id: input.venueId }, select: { id: true } })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" })

      const existing = await ctx.db.review.findUnique({
        where: { userId_venueId: { userId: ctx.userId, venueId: input.venueId } },
        select: { id: true, pointsAwarded: true },
      })

      // Points are awarded once, only for a *first* genuine review backed by a
      // real visit (a scan/checkin/purchase at this venue) with enough text.
      const text = input.text?.trim() ?? ""
      let awardPoints = false
      if (!existing && text.length >= MIN_TEXT_LENGTH) {
        const visits = await ctx.db.transaction.count({
          where: { userId: ctx.userId, venueId: input.venueId, type: { in: [...VISIT_TYPES] } },
        })
        awardPoints = visits > 0
      }

      const review = await ctx.db.$transaction(async (tx) => {
        const r = await tx.review.upsert({
          where: { userId_venueId: { userId: ctx.userId, venueId: input.venueId } },
          update: { rating: input.rating, text: input.text ?? null },
          create: {
            userId: ctx.userId,
            venueId: input.venueId,
            rating: input.rating,
            ...(input.text ? { text: input.text } : {}),
            ...(awardPoints ? { pointsAwarded: true } : {}),
          },
        })
        if (awardPoints) {
          await tx.transaction.create({
            data: {
              userId: ctx.userId,
              venueId: input.venueId,
              type: "BONUS",
              pointsEarned: REVIEW_POINTS,
              status: "VERIFIED",
              verifiedAt: new Date(),
            },
          })
          await tx.user.update({
            where: { id: ctx.userId },
            data: { earnedPoints: { increment: REVIEW_POINTS }, totalEarnedLifetime: { increment: REVIEW_POINTS } },
          })
        }
        return r
      })

      return { review, awardedPoints: awardPoints ? REVIEW_POINTS : 0 }
    }),

  /** Returns the current user's review for a venue, if any. */
  myForVenue: protectedProcedure
    .input(z.object({ venueId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.review.findUnique({
        where: { userId_venueId: { userId: ctx.userId, venueId: input.venueId } },
      })
    }),

  delete: protectedProcedure
    .input(z.object({ venueId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.review.findUnique({
        where: { userId_venueId: { userId: ctx.userId, venueId: input.venueId } },
        select: { id: true },
      })
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" })
      await ctx.db.review.delete({ where: { id: existing.id } })
      return { ok: true }
    }),
})
