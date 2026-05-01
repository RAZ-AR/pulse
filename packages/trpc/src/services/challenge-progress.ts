import type { db as PrismaDb } from "@pulse/db"

type Tx = Parameters<Parameters<typeof PrismaDb.$transaction>[0]>[0]

type RulesSpend = { threshold: number }
type RulesVisit = { count: number }
type RulesStreak = { days: number }

/**
 * Called after a PARTNER_PURCHASE or RECEIPT_SCAN is confirmed.
 * Increments SPEND_AMOUNT challenges by the RSD amount spent.
 */
export async function trackSpend(tx: Tx, userId: string, amountRsd: number): Promise<void> {
  await progressChallenges(tx, userId, "SPEND_AMOUNT", amountRsd, (rules, progress) => {
    const r = rules as RulesSpend
    return progress >= r.threshold
  })
}

/**
 * Called after a successful CHECKIN_PHOTO.
 * Increments VISIT_N_VENUES challenges by 1.
 */
export async function trackVisit(tx: Tx, userId: string): Promise<void> {
  await progressChallenges(tx, userId, "VISIT_N_VENUES", 1, (rules, progress) => {
    const r = rules as RulesVisit
    return progress >= r.count
  })
}

/**
 * Called after streak is updated.
 * Completes STREAK challenges if current streak >= required days.
 */
export async function trackStreak(tx: Tx, userId: string, currentStreak: number): Promise<void> {
  const now = new Date()
  const active = await tx.userChallenge.findMany({
    where: {
      userId,
      isCompleted: false,
      challenge: { type: "STREAK", startDate: { lte: now }, endDate: { gte: now } },
    },
    include: { challenge: true },
  })

  for (const uc of active) {
    const rules = uc.challenge.rules as RulesStreak
    if (currentStreak >= rules.days) {
      await completeChallenge(tx, uc.id, userId, uc.challenge.pointsReward)
    }
  }
}

// ── Internal helpers ──────────────────────────────────────────

async function progressChallenges(
  tx: Tx,
  userId: string,
  type: "SPEND_AMOUNT" | "VISIT_N_VENUES",
  increment: number,
  isComplete: (rules: unknown, newProgress: number) => boolean,
): Promise<void> {
  const now = new Date()
  const active = await tx.userChallenge.findMany({
    where: {
      userId,
      isCompleted: false,
      challenge: { type, startDate: { lte: now }, endDate: { gte: now } },
    },
    include: { challenge: true },
  })

  for (const uc of active) {
    const newProgress = uc.progress + increment
    await tx.userChallenge.update({
      where: { id: uc.id },
      data: { progress: newProgress },
    })
    if (isComplete(uc.challenge.rules, newProgress)) {
      await completeChallenge(tx, uc.id, userId, uc.challenge.pointsReward)
    }
  }
}

async function completeChallenge(
  tx: Tx,
  userChallengeId: string,
  userId: string,
  pointsReward: number,
): Promise<void> {
  await tx.userChallenge.update({
    where: { id: userChallengeId },
    data: { isCompleted: true, completedAt: new Date() },
  })

  await tx.user.update({
    where: { id: userId },
    data: {
      earnedPoints: { increment: pointsReward },
      totalEarnedLifetime: { increment: pointsReward },
    },
  })

  await tx.transaction.create({
    data: {
      userId,
      type: "CHALLENGE_COMPLETE",
      pointsEarned: pointsReward,
      status: "VERIFIED",
      verifiedAt: new Date(),
    },
  })
}
