import { z } from "zod"
import { router, protectedProcedure } from "../trpc"

export const challengeRouter = router({
  active: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.userChallenge.findMany({
      where: { userId: ctx.userId, isCompleted: false },
      include: { challenge: true },
    })
  }),

  join: protectedProcedure
    .input(z.object({ challengeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.userChallenge.create({
        data: { userId: ctx.userId, challengeId: input.challengeId },
      })
    }),

  progress: protectedProcedure
    .input(z.object({ challengeId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.userChallenge.findUnique({
        where: { userId_challengeId: { userId: ctx.userId, challengeId: input.challengeId } },
        include: { challenge: true },
      })
    }),
})
