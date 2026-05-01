import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure, publicProcedure } from "../trpc"

export const challengeRouter = router({
  // All active challenges (not yet joined by this user)
  listAvailable: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date()

    // IDs the user has already joined
    const joined = await ctx.db.userChallenge.findMany({
      where: { userId: ctx.userId },
      select: { challengeId: true },
    })
    const joinedIds = joined.map((j) => j.challengeId)

    return ctx.db.challenge.findMany({
      where: {
        startDate: { lte: now },
        endDate: { gte: now },
        ...(joinedIds.length > 0 && { id: { notIn: joinedIds } }),
      },
      orderBy: { endDate: "asc" },
    })
  }),

  // Challenges the user has joined (with progress)
  listMine: protectedProcedure.query(async ({ ctx }) => {
    const now = new Date()
    return ctx.db.userChallenge.findMany({
      where: {
        userId: ctx.userId,
        challenge: { startDate: { lte: now }, endDate: { gte: now } },
      },
      include: { challenge: true },
      orderBy: { challenge: { endDate: "asc" } },
    })
  }),

  // Single challenge detail (public — for deep link / share)
  detail: publicProcedure
    .input(z.object({ challengeId: z.string() }))
    .query(async ({ ctx, input }) => {
      const challenge = await ctx.db.challenge.findUnique({
        where: { id: input.challengeId },
        include: { _count: { select: { participants: true } } },
      })
      if (!challenge) throw new TRPCError({ code: "NOT_FOUND" })
      return challenge
    }),

  // Join a challenge
  join: protectedProcedure
    .input(z.object({ challengeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date()
      const challenge = await ctx.db.challenge.findUnique({
        where: { id: input.challengeId },
        select: { id: true, startDate: true, endDate: true },
      })
      if (!challenge) throw new TRPCError({ code: "NOT_FOUND" })
      if (challenge.endDate < now) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Challenge has ended" })
      }

      return ctx.db.userChallenge.create({
        data: { userId: ctx.userId, challengeId: input.challengeId },
      })
    }),

  // Progress on a specific challenge
  progress: protectedProcedure
    .input(z.object({ challengeId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.userChallenge.findUnique({
        where: { userId_challengeId: { userId: ctx.userId, challengeId: input.challengeId } },
        include: { challenge: true },
      })
    }),
})
