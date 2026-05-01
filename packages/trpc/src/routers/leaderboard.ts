import { z } from "zod"
import { router, publicProcedure, protectedProcedure } from "../trpc"

export const leaderboardRouter = router({
  city: publicProcedure
    .input(
      z.object({
        city: z.string(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const users = await ctx.db.user.findMany({
        where: {
          homeCity: { equals: input.city, mode: "insensitive" },
          onboardingDone: true,
        },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          earnedPoints: true,
          welcomePoints: true,
          currentStreak: true,
        },
        orderBy: [{ earnedPoints: "desc" }, { welcomePoints: "desc" }],
        take: input.limit,
      })

      return {
        entries: users.map((u, i) => ({
          rank: i + 1,
          userId: u.id,
          name: u.name ?? "Anonymous",
          avatarUrl: u.avatarUrl,
          totalPoints: u.earnedPoints + u.welcomePoints,
          currentStreak: u.currentStreak,
        })),
      }
    }),

  global: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const users = await ctx.db.user.findMany({
        where: { onboardingDone: true },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          homeCity: true,
          earnedPoints: true,
          welcomePoints: true,
          currentStreak: true,
        },
        orderBy: [{ earnedPoints: "desc" }, { welcomePoints: "desc" }],
        take: input.limit,
      })

      return {
        entries: users.map((u, i) => ({
          rank: i + 1,
          userId: u.id,
          name: u.name ?? "Anonymous",
          avatarUrl: u.avatarUrl,
          homeCity: u.homeCity,
          totalPoints: u.earnedPoints + u.welcomePoints,
          currentStreak: u.currentStreak,
        })),
      }
    }),

  // Authenticated: get the current user's rank in their city
  myRank: protectedProcedure.query(async ({ ctx }) => {
    const me = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: { homeCity: true, earnedPoints: true, welcomePoints: true },
    })
    if (!me?.homeCity) return { cityRank: null, globalRank: null }

    const myTotal = me.earnedPoints + me.welcomePoints

    const [cityRank, globalRank] = await Promise.all([
      ctx.db.user.count({
        where: {
          homeCity: { equals: me.homeCity, mode: "insensitive" },
          onboardingDone: true,
          OR: [
            { earnedPoints: { gt: me.earnedPoints } },
            { earnedPoints: me.earnedPoints, welcomePoints: { gt: me.welcomePoints } },
          ],
        },
      }),
      ctx.db.user.count({
        where: {
          onboardingDone: true,
          OR: [
            { earnedPoints: { gt: me.earnedPoints } },
            { earnedPoints: me.earnedPoints, welcomePoints: { gt: me.welcomePoints } },
          ],
        },
      }),
    ])

    return {
      cityRank: cityRank + 1,
      globalRank: globalRank + 1,
      totalPoints: myTotal,
      city: me.homeCity,
    }
  }),
})
