import { z } from "zod"
import { router, publicProcedure, protectedProcedure, merchantProcedure } from "../trpc"

export const rewardRouter = router({
  list: publicProcedure
    .input(
      z.object({
        venueId: z.string().optional(),
        maxCost: z.number().optional(),
        limit: z.number().default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const rewards = await ctx.db.reward.findMany({
        where: {
          venueId: input.venueId,
          isActive: true,
          pointsCost: input.maxCost ? { lte: input.maxCost } : undefined,
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { pointsCost: "asc" },
        include: { venue: { select: { id: true, name: true, city: true } } },
      })
      let nextCursor: string | undefined
      if (rewards.length > input.limit) {
        nextCursor = rewards.pop()!.id
      }
      return { rewards, nextCursor }
    }),

  redeem: protectedProcedure
    .input(z.object({ rewardId: z.string() }))
    .mutation(async () => {
      // TODO (Tier 1 step 5): spend points, create Redemption, return QR code
      return { redemptionCode: "" }
    }),

  validate: merchantProcedure
    .input(z.object({ redemptionCode: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: verify QR code belongs to this merchant's venue, mark as USED
      const redemption = await ctx.db.redemption.findUnique({
        where: { redemptionCode: input.redemptionCode },
        include: { reward: { include: { venue: true } } },
      })
      if (!redemption) return { valid: false }
      return { valid: redemption.status === "ACTIVE", redemption }
    }),
})
