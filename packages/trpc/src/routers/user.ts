import { z } from "zod"
import { router, protectedProcedure } from "../trpc"

export const userRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUnique({ where: { id: ctx.userId } })
  }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional(),
        homeCity: z.string().max(100).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.userId },
        data: input,
      })
    }),

  getStreak: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: { currentStreak: true, longestStreak: true, lastCheckinAt: true },
    })
    return user
  }),

  getReferrals: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findMany({
      where: { referredById: ctx.userId },
      select: { id: true, name: true, createdAt: true },
    })
  }),
})
