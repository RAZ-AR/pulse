import { z } from "zod"
import { router, protectedProcedure } from "../trpc"

export const socialRouter = router({
  gift: protectedProcedure
    .input(
      z.object({
        receiverId: z.string(),
        amount: z.number().min(50).max(500),
        message: z.string().max(200).optional(),
      })
    )
    .mutation(async () => {
      // TODO (Tier 3 step 17): validate limits, transfer earnedPoints only
      return { success: false }
    }),

  friends: protectedProcedure.query(async ({ ctx }) => {
    // Referrals as a proxy for friends in MVP
    return ctx.db.user.findMany({
      where: { referredById: ctx.userId },
      select: { id: true, name: true, avatarUrl: true },
    })
  }),

  feed: protectedProcedure
    .input(z.object({ limit: z.number().default(20) }))
    .query(async () => {
      // TODO (Tier 3 step 18): friends activity feed
      return { items: [] }
    }),
})
