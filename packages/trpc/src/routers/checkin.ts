import { z } from "zod"
import { router, protectedProcedure } from "../trpc"

export const checkinRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        venueId: z.string(),
        photoUrl: z.string().url(),
        lat: z.number(),
        lng: z.number(),
      })
    )
    .mutation(async () => {
      // TODO (Tier 2 step 9): geo check, AI photo verification, award points
      return { pointsEarned: 0 }
    }),

  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const checkins = await ctx.db.checkin.findMany({
        where: { userId: ctx.userId },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: { venue: { select: { id: true, name: true } } },
      })
      let nextCursor: string | undefined
      if (checkins.length > input.limit) {
        nextCursor = checkins.pop()!.id
      }
      return { checkins, nextCursor }
    }),
})
