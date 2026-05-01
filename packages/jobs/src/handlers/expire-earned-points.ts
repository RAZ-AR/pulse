import { db } from "@pulse/db"

// Runs monthly — zeros earned points for users inactive > 12 months
export async function expireEarnedPoints() {
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)

  // Users with no transaction in the last 12 months
  const inactive = await db.user.findMany({
    where: {
      earnedPoints: { gt: 0 },
      transactions: { none: { createdAt: { gte: cutoff } } },
    },
    select: { id: true },
  })

  if (inactive.length === 0) return { expired: 0 }

  const result = await db.user.updateMany({
    where: { id: { in: inactive.map((u) => u.id) } },
    data: { earnedPoints: 0 },
  })
  return { expired: result.count }
}
