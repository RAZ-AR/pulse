import { db } from "@pulse/db"

// Runs daily — zeros out expired welcome points
export async function expireWelcomePoints() {
  const now = new Date()
  const result = await db.user.updateMany({
    where: {
      welcomePoints: { gt: 0 },
      welcomeExpiresAt: { lte: now },
    },
    data: { welcomePoints: 0 },
  })
  return { expired: result.count }
}
