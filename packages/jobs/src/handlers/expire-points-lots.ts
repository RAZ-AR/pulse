import { db } from "@pulse/db"

// Списывает истёкшие партии начисленных баллов (промо с pointsExpireDays).
// Аддитивно поверх earnedPoints: уменьшаем баланс, но не уходим в минус
// (если юзер уже потратил эти баллы — списываем сколько есть).
export async function expirePointsLots() {
  const now = new Date()

  const due = await db.pointsExpiry.findMany({
    where: { burnedAt: null, expiresAt: { lte: now } },
    select: { id: true, userId: true, amount: true },
  })
  if (due.length === 0) return { burned: 0, points: 0 }

  let points = 0
  for (const lot of due) {
    await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: lot.userId },
        select: { earnedPoints: true },
      })
      const burn = Math.min(lot.amount, user?.earnedPoints ?? 0)
      if (burn > 0) {
        await tx.user.update({
          where: { id: lot.userId },
          data: { earnedPoints: { decrement: burn } },
        })
        points += burn
      }
      await tx.pointsExpiry.update({
        where: { id: lot.id },
        data: { burnedAt: now },
      })
    })
  }

  return { burned: due.length, points }
}
