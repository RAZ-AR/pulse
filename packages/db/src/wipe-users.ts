/**
 * Danger: wipes ALL user + merchant data for a clean test from scratch.
 * Keeps the catalog: Venue (~10k import), Badge, Challenge.
 *
 * Run:  pnpm --filter @pulse/db db:wipe-users
 * Deletes children before parents (few FKs use ON DELETE CASCADE).
 */
import { db } from "./index"

async function main() {
  console.log("⚠️  Wiping user + merchant data (keeping Venue / Badge / Challenge catalog)…")

  // activity & content (children first)
  await db.offerRedemption.deleteMany()
  await db.redemption.deleteMany()
  await db.reward.deleteMany()
  await db.offer.deleteMany()
  await db.checkin.deleteMany()
  await db.transaction.deleteMany()
  await db.pointsGift.deleteMany()
  await db.giftLink.deleteMany()
  await db.userChallenge.deleteMany()
  await db.userBadge.deleteMany()
  await db.review.deleteMany()
  await db.staffMember.deleteMany()
  await db.staffInvite.deleteMany()
  await db.venueImportLog.deleteMany()

  // auth
  await db.verificationToken.deleteMany()
  await db.account.deleteMany()

  // detach kept venues from merchants, then drop merchants + users
  await db.venue.updateMany({ data: { ownerId: null } })
  const merchants = await db.merchant.deleteMany()
  const users = await db.user.deleteMany()

  const venues = await db.venue.count()
  console.log(`✅ Done. Removed ${users.count} users, ${merchants.count} merchants. Venues kept: ${venues}.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
