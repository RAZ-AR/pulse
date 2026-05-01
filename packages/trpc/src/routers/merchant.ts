import { z } from "zod"
import { router, merchantProcedure } from "../trpc"

export const merchantRouter = router({
  dashboard: merchantProcedure.query(async ({ ctx }) => {
    const venues = await ctx.db.venue.findMany({
      where: { ownerId: ctx.merchantId },
      select: { id: true, name: true },
    })
    // TODO (Tier 2 step 12): aggregate metrics, comparisons
    return { venues, metrics: null }
  }),

  updateRate: merchantProcedure
    .input(
      z.object({
        venueId: z.string(),
        pointsPerCurrency: z.number().positive(),
        currency: z.string().length(3),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.venue.update({
        where: { id: input.venueId, ownerId: ctx.merchantId },
        data: {
          pointsPerCurrency: input.pointsPerCurrency,
          currency: input.currency,
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
      return ctx.db.reward.create({
        data: { ...input, venueId: input.venueId },
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
        where: {
          venueId: input.venueId,
          venue: { ownerId: ctx.merchantId },
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
      })
      let nextCursor: string | undefined
      if (transactions.length > input.limit) {
        nextCursor = transactions.pop()!.id
      }
      return { transactions, nextCursor }
    }),
})
