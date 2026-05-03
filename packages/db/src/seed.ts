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

const MERCHANT_EMAIL = "armen@pulse.app"
const MERCHANT_PASSWORD = "pulse-dev-2024!" // change before production

// pointsPerCurrency = 1 / RSD_per_point
// Willow/JAN: 1 point per 125 RSD → 0.008
const WILLOW_JAN_RATE = 1 / 125

async function seed() {
  console.log("🌱 Seeding PULSE database…\n")

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
    },
    create: {
      id: "venue_willow",
      name: "Café Willow",
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
      isPartner: true,
      partnerSince: new Date(),
      pointsPerCurrency: WILLOW_JAN_RATE,
      currency: "RSD",
      enableRewards: true,
      enableDiscount: true,
      maxDiscountPercent: 30,
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
      isPartner: true,
      partnerSince: new Date(),
      pointsPerCurrency: WILLOW_JAN_RATE,
      currency: "RSD",
      enableRewards: true,
      enableDiscount: true,
      maxDiscountPercent: 50,
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
