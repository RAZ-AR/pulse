import { z } from "zod"
import { router, publicProcedure } from "../trpc"

export const leaderboardRouter = router({
  city: publicProcedure
    .input(
      z.object({
        city: z.string(),
        period: z.enum(["week", "month"]).default("week"),
        limit: z.number().default(100),
      })
    )
    .query(async () => {
      // TODO (Tier 3 step 15): read from Redis ZSET for performance
      return { entries: [] }
    }),

  global: publicProcedure
    .input(z.object({ limit: z.number().default(100) }))
    .query(async () => {
      // TODO (Tier 3 step 15): Redis ZSET global leaderboard
      return { entries: [] }
    }),
})
