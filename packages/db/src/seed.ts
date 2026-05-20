/**
 * Seed script — creates Armen's merchant account + Café Willow + JAN
 * Run: pnpm db:seed
 *
 * Coordinates are approximate Belgrade locations.
 * Update with exact addresses before soft launch.
 */
import { hash } from "bcryptjs"
import { db } from "./client"
import { BADGE_DEFINITIONS } from "@pulse/shared"

const MERCHANT_EMAIL = "armen@ayoo.space"
const MERCHANT_PASSWORD = "ayoo-dev-2024!" // change before production

// pointsPerCurrency = 1 / RSD_per_point
// Willow/JAN: 1 point per 125 RSD → 0.008
const WILLOW_JAN_RATE = 1 / 125

async function seed() {
  console.log("🌱 Seeding ayoo database…\n")

  // ── Badges (idempotent upsert by code) ───────────────────────
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
  console.log(`  ↳ ${BADGE_DEFINITIONS.length} badges seeded`)

  // ── Merchant (Armen) ─────────────────────────────────────────
  const passwordHash = await hash(MERCHANT_PASSWORD, 12)

  const merchant = await db.merchant.upsert({
    where: { email: MERCHANT_EMAIL },
    update: {},
    create: {
      email: MERCHANT_EMAIL,
      name: "Armen Razmikovich",
      passwordHash,
    },
  })
  console.log(`✓ Merchant: ${merchant.email}`)

  // ── Café Willow ───────────────────────────────────────────────
  const willow = await db.venue.upsert({
    where: { id: "venue_willow" },
    update: {
      pointsPerCurrency: WILLOW_JAN_RATE,
      subscriptionTier: "FEATURED",
      phone: "+381 11 412 8820",
      website: "https://cafewillow.example",
      instagram: "https://instagram.com/cafewillow.bg",
      openingHoursText: "Mon-Sun 08:00-22:00",
      sourceProvider: "google_maps",
      sourcePlaceId: "demo_bg_willow",
      sourceUrl: "https://maps.google.com/?q=Cafe+Willow+Belgrade",
      sourceUpdatedAt: new Date(),
      specialOffers: ["-30% welcome dessert", "Double points before 11:00", "Free pastry after 6 visits"],
    },
    create: {
      id: "venue_willow",
      name: "Café Willow",
      subscriptionTier: "FEATURED",
      category: "CAFE",
      description: "Specialty coffee and homemade pastries in Dorćol.",
      address: "Skadarska 36, Beograd",
      city: "Belgrade",
      country: "Serbia",
      lat: 44.8198,
      lng: 20.4632,
      photos: [],
      workingHours: {
        mon: "08:00-22:00",
        tue: "08:00-22:00",
        wed: "08:00-22:00",
        thu: "08:00-22:00",
        fri: "08:00-23:00",
        sat: "09:00-23:00",
        sun: "09:00-21:00",
      },
      openingHoursText: "Mon-Sun 08:00-22:00",
      isPartner: true,
      partnerSince: new Date(),
      pointsPerCurrency: WILLOW_JAN_RATE,
      currency: "RSD",
      enableRewards: true,
      enableDiscount: true,
      maxDiscountPercent: 30,
      googleRating: 4.7,
      googleReviews: 428,
      phone: "+381 11 412 8820",
      website: "https://cafewillow.example",
      instagram: "https://instagram.com/cafewillow.bg",
      sourceProvider: "google_maps",
      sourcePlaceId: "demo_bg_willow",
      sourceUrl: "https://maps.google.com/?q=Cafe+Willow+Belgrade",
      sourceUpdatedAt: new Date(),
      specialOffers: ["-30% welcome dessert", "Double points before 11:00", "Free pastry after 6 visits"],
      ownerId: merchant.id,
    },
  })
  console.log(`✓ Venue: ${willow.name} (${willow.lat}, ${willow.lng})`)

  // Willow starter rewards (spec §4.6 — must have ≤100 points)
  await db.reward.upsert({
    where: { id: "reward_willow_espresso" },
    update: {},
    create: {
      id: "reward_willow_espresso",
      venueId: willow.id,
      title: "Espresso",
      description: "Single or double — your choice.",
      pointsCost: 80,
      redemptionType: "FULL_FREE",
      isActive: true,
    },
  })
  await db.reward.upsert({
    where: { id: "reward_willow_filter" },
    update: {},
    create: {
      id: "reward_willow_filter",
      venueId: willow.id,
      title: "Filter Coffee",
      description: "Single origin, brewed fresh.",
      pointsCost: 100,
      redemptionType: "FULL_FREE",
      isActive: true,
    },
  })
  await db.reward.upsert({
    where: { id: "reward_willow_latte" },
    update: {},
    create: {
      id: "reward_willow_latte",
      venueId: willow.id,
      title: "Latte",
      description: "House milk or oat.",
      pointsCost: 200,
      redemptionType: "FULL_FREE",
      isActive: true,
    },
  })
  console.log(`  ↳ 3 rewards (80 / 100 / 200 pts)`)

  // ── JAN ───────────────────────────────────────────────────────
  const jan = await db.venue.upsert({
    where: { id: "venue_jan" },
    update: {
      pointsPerCurrency: WILLOW_JAN_RATE,
      phone: "+381 11 328 4410",
      website: "https://janbelgrade.example",
      instagram: "https://instagram.com/jan.belgrade",
      openingHoursText: "Mon-Sat 12:00-23:00",
      sourceProvider: "google_maps",
      sourcePlaceId: "demo_bg_jan",
      sourceUrl: "https://maps.google.com/?q=JAN+Belgrade",
      sourceUpdatedAt: new Date(),
      specialOffers: ["-50% starter set", "Weekend tasting bonus", "Partner points on every bill"],
    },
    create: {
      id: "venue_jan",
      name: "JAN",
      category: "RESTAURANT",
      description: "Creative Serbian cuisine with a modern twist.",
      address: "Đure Jakšića 12, Beograd",
      city: "Belgrade",
      country: "Serbia",
      lat: 44.8185,
      lng: 20.4608,
      photos: [],
      workingHours: {
        mon: "12:00-23:00",
        tue: "12:00-23:00",
        wed: "12:00-23:00",
        thu: "12:00-23:00",
        fri: "12:00-00:00",
        sat: "12:00-00:00",
        sun: "12:00-22:00",
      },
      openingHoursText: "Mon-Sat 12:00-23:00",
      isPartner: true,
      partnerSince: new Date(),
      pointsPerCurrency: WILLOW_JAN_RATE,
      currency: "RSD",
      enableRewards: true,
      enableDiscount: true,
      maxDiscountPercent: 50,
      googleRating: 4.8,
      googleReviews: 312,
      phone: "+381 11 328 4410",
      website: "https://janbelgrade.example",
      instagram: "https://instagram.com/jan.belgrade",
      sourceProvider: "google_maps",
      sourcePlaceId: "demo_bg_jan",
      sourceUrl: "https://maps.google.com/?q=JAN+Belgrade",
      sourceUpdatedAt: new Date(),
      specialOffers: ["-50% starter set", "Weekend tasting bonus", "Partner points on every bill"],
      ownerId: merchant.id,
    },
  })
  console.log(`✓ Venue: ${jan.name} (${jan.lat}, ${jan.lng})`)

  await db.reward.upsert({
    where: { id: "reward_jan_dessert" },
    update: {},
    create: {
      id: "reward_jan_dessert",
      venueId: jan.id,
      title: "House Dessert",
      description: "Chef's daily dessert selection.",
      pointsCost: 100,
      redemptionType: "FULL_FREE",
      isActive: true,
    },
  })
  await db.reward.upsert({
    where: { id: "reward_jan_starter" },
    update: {},
    create: {
      id: "reward_jan_starter",
      venueId: jan.id,
      title: "Complimentary Starter",
      description: "Seasonal amuse-bouche.",
      pointsCost: 250,
      redemptionType: "FULL_FREE",
      isActive: true,
    },
  })
  console.log(`  ↳ 2 rewards (100 / 250 pts)`)

  // ── Sample challenges (active for 30 days from seed time) ───
  const challengeStart = new Date()
  const challengeEnd = new Date()
  challengeEnd.setDate(challengeEnd.getDate() + 30)

  await db.challenge.upsert({
    where: { id: "challenge_spend_2k" },
    update: { startDate: challengeStart, endDate: challengeEnd },
    create: {
      id: "challenge_spend_2k",
      title: "Big spender",
      description: "Spend 2,000 RSD at ayoo partners this month and earn 100 bonus points.",
      type: "SPEND_AMOUNT",
      rules: { threshold: 2000 },
      pointsReward: 100,
      startDate: challengeStart,
      endDate: challengeEnd,
      isGlobal: true,
    },
  })

  await db.challenge.upsert({
    where: { id: "challenge_visit_3" },
    update: { startDate: challengeStart, endDate: challengeEnd },
    create: {
      id: "challenge_visit_3",
      title: "Neighborhood explorer",
      description: "Check in at 3 different venues this month.",
      type: "VISIT_N_VENUES",
      rules: { count: 3 },
      pointsReward: 75,
      startDate: challengeStart,
      endDate: challengeEnd,
      isGlobal: true,
    },
  })

  await db.challenge.upsert({
    where: { id: "challenge_streak_7" },
    update: { startDate: challengeStart, endDate: challengeEnd },
    create: {
      id: "challenge_streak_7",
      title: "Hot streak",
      description: "Hit a 7-day check-in streak this month — extra rewards on top of milestone bonus.",
      type: "STREAK",
      rules: { days: 7 },
      pointsReward: 50,
      startDate: challengeStart,
      endDate: challengeEnd,
      isGlobal: true,
    },
  })

  // Sponsored challenge — paid placement by Café Willow (FEATURED tier)
  await db.challenge.upsert({
    where: { id: "challenge_willow_spend" },
    update: { startDate: challengeStart, endDate: challengeEnd },
    create: {
      id: "challenge_willow_spend",
      title: "Willow regular",
      description: "Spend 1,500 RSD at Café Willow this month — sponsored by the venue.",
      type: "SPEND_AMOUNT",
      rules: { threshold: 1500 },
      pointsReward: 200,
      startDate: challengeStart,
      endDate: challengeEnd,
      isGlobal: false,
      venueId: "venue_willow",
    },
  })
  console.log(`  ↳ 4 challenges (3 global + 1 sponsored)`)

  console.log(`
✅ Seed complete!

Merchant login:
  Email:    ${MERCHANT_EMAIL}
  Password: ${MERCHANT_PASSWORD}

Venues seeded: Café Willow, JAN (Belgrade, isPartner=true)
Rate: 1 point per 125 RSD (1:8 to scan baseline)
`)
}

seed()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
