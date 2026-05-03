import { router, protectedProcedure, publicProcedure } from "../trpc"

export const badgeRouter = router({
  /**
   * All badges in the system (locked or unlocked) — for the mobile Badges screen.
   * Public so onboarded-but-not-signed-in browsing still shows the achievement set.
   */
  list: publicProcedure.query(async ({ ctx }) => {
    const badges = await ctx.db.badge.findMany({
      select: { id: true, code: true, name: true, description: true, iconUrl: true, rarity: true },
      orderBy: [{ rarity: "asc" }, { name: "asc" }],
    })
    return badges
  }),

  /**
   * Current user's unlocked badges with timestamps.
   */
  mine: protectedProcedure.query(async ({ ctx }) => {
    const userBadges = await ctx.db.userBadge.findMany({
      where: { userId: ctx.userId },
      orderBy: { unlockedAt: "desc" },
      select: {
        unlockedAt: true,
        badge: {
          select: { id: true, code: true, name: true, description: true, iconUrl: true, rarity: true },
        },
      },
    })
    return userBadges.map((ub) => ({ ...ub.badge, unlockedAt: ub.unlockedAt }))
  }),
})
