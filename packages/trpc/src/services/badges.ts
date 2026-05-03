import type { db as PrismaDb } from "@pulse/db"
import { BADGE_DEFINITIONS, type BadgeStats } from "@pulse/shared"

type Tx = Parameters<Parameters<typeof PrismaDb.$transaction>[0]>[0]

/**
 * Idempotent: ensures every BADGE_DEFINITION exists in the Badge table.
 * Safe to run on every server start. Matches by `code` slug.
 *
 * Call from `apps/api` startup or admin script (NOT inside hot paths).
 */
export async function ensureBadges(db: typeof PrismaDb): Promise<void> {
  for (const def of BADGE_DEFINITIONS) {
    await db.badge.upsert({
      where: { code: def.code },
      create: {
        code: def.code,
        name: def.name,
        description: def.description,
        iconUrl: def.iconUrl,
        rarity: def.rarity,
        unlockCondition: { description: def.description },
      },
      update: {
        name: def.name,
        description: def.description,
        iconUrl: def.iconUrl,
        rarity: def.rarity,
      },
    })
  }
}

async function loadStats(tx: Tx, userId: string): Promise<BadgeStats> {
  const [user, scanCount, checkinCount, partnerCount, referralCount, distinctVenues] = await Promise.all([
    tx.user.findUnique({ where: { id: userId }, select: { longestStreak: true } }),
    tx.transaction.count({ where: { userId, type: "RECEIPT_SCAN", status: "VERIFIED" } }),
    tx.checkin.count({ where: { userId, status: "VERIFIED" } }),
    tx.transaction.count({ where: { userId, type: "PARTNER_PURCHASE", status: "VERIFIED" } }),
    tx.user.count({ where: { referredById: userId } }),
    tx.transaction.findMany({
      where: { userId, status: "VERIFIED", venueId: { not: null } },
      distinct: ["venueId"],
      select: { venueId: true },
    }),
  ])
  return {
    longestStreak: user?.longestStreak ?? 0,
    totalReceiptScans: scanCount,
    totalCheckins: checkinCount,
    totalPartnerPurchases: partnerCount,
    totalReferrals: referralCount,
    uniqueVenuesVisited: distinctVenues.length,
  }
}

/**
 * Checks all BADGE_DEFINITIONS against current user stats and awards any
 * newly-qualifying badges. Idempotent — `userId+badgeId` is the PK on UserBadge,
 * so duplicate awards are skipped via skipDuplicates.
 *
 * Returns the codes of newly awarded badges (for surface in API responses).
 */
export async function checkAndAwardBadges(tx: Tx, userId: string): Promise<string[]> {
  const stats = await loadStats(tx, userId)

  // Find which badge codes the user qualifies for
  const qualifyingCodes = BADGE_DEFINITIONS
    .filter((def) => def.predicate(stats))
    .map((def) => def.code)
  if (qualifyingCodes.length === 0) return []

  // Look up DB badges by code → id
  const badges = await tx.badge.findMany({
    where: { code: { in: qualifyingCodes } },
    select: { id: true, code: true },
  })
  if (badges.length === 0) return []

  // Find which the user already has
  const existing = await tx.userBadge.findMany({
    where: { userId, badgeId: { in: badges.map((b) => b.id) } },
    select: { badgeId: true },
  })
  const existingIds = new Set(existing.map((e) => e.badgeId))

  const toAward = badges.filter((b) => !existingIds.has(b.id))
  if (toAward.length === 0) return []

  await tx.userBadge.createMany({
    data: toAward.map((b) => ({ userId, badgeId: b.id })),
    skipDuplicates: true,
  })

  return toAward.map((b) => b.code)
}
