/**
 * Badge definitions — single source of truth for what badges exist and how they unlock.
 *
 * Stored in DB (Badge table) for FK integrity with UserBadge, but the predicate logic
 * lives in code so it can run in tRPC services.
 *
 * Add new badges by:
 *   1. Adding entry below
 *   2. Running seed/sync (see services/badges.ts ensureBadges)
 *   3. Wiring its check into the relevant event handler (checkin/scan/purchase/signup)
 */

export type BadgeRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY"

export type BadgeStats = {
  totalReceiptScans: number
  totalCheckins: number
  totalPartnerPurchases: number
  totalReferrals: number
  uniqueVenuesVisited: number
  longestStreak: number
}

export type BadgeDefinition = {
  code: string
  name: string
  description: string
  iconUrl: string // emoji for v1; URL when we ship custom art
  rarity: BadgeRarity
  /** Returns true when this user qualifies. Pure fn over BadgeStats. */
  predicate: (stats: BadgeStats) => boolean
}

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  // Onboarding (auto-awarded on signup via BadgeStats with all zeros + welcome flag)
  {
    code: "welcome",
    name: "Welcome aboard",
    description: "Joined ayoo",
    iconUrl: "🎉",
    rarity: "COMMON",
    predicate: () => true, // anyone passing the badge check after signup gets it
  },

  // Streak badges
  {
    code: "streak_7",
    name: "Week warrior",
    description: "7-day streak",
    iconUrl: "🔥",
    rarity: "COMMON",
    predicate: (s) => s.longestStreak >= 7,
  },
  {
    code: "streak_30",
    name: "Month master",
    description: "30-day streak",
    iconUrl: "💪",
    rarity: "RARE",
    predicate: (s) => s.longestStreak >= 30,
  },
  {
    code: "streak_100",
    name: "Century",
    description: "100-day streak — legendary",
    iconUrl: "👑",
    rarity: "LEGENDARY",
    predicate: (s) => s.longestStreak >= 100,
  },

  // Receipt scanning
  {
    code: "receipt_first",
    name: "Receipt rookie",
    description: "Scanned your first receipt",
    iconUrl: "📷",
    rarity: "COMMON",
    predicate: (s) => s.totalReceiptScans >= 1,
  },
  {
    code: "receipt_25",
    name: "Receipt collector",
    description: "Scanned 25 receipts",
    iconUrl: "🧾",
    rarity: "RARE",
    predicate: (s) => s.totalReceiptScans >= 25,
  },

  // Check-ins
  {
    code: "checkin_first",
    name: "First steps",
    description: "Checked in for the first time",
    iconUrl: "📍",
    rarity: "COMMON",
    predicate: (s) => s.totalCheckins >= 1,
  },
  {
    code: "checkin_50",
    name: "Regular",
    description: "50 check-ins",
    iconUrl: "🌟",
    rarity: "RARE",
    predicate: (s) => s.totalCheckins >= 50,
  },

  // Partner purchases
  {
    code: "partner_first",
    name: "Partner perks",
    description: "First partner purchase",
    iconUrl: "💳",
    rarity: "COMMON",
    predicate: (s) => s.totalPartnerPurchases >= 1,
  },
  {
    code: "partner_25",
    name: "Loyal customer",
    description: "25 partner purchases",
    iconUrl: "💎",
    rarity: "RARE",
    predicate: (s) => s.totalPartnerPurchases >= 25,
  },

  // Variety
  {
    code: "explorer_5",
    name: "Explorer",
    description: "Visited 5 different venues",
    iconUrl: "🗺️",
    rarity: "COMMON",
    predicate: (s) => s.uniqueVenuesVisited >= 5,
  },
  {
    code: "explorer_25",
    name: "Globetrotter",
    description: "Visited 25 different venues",
    iconUrl: "🌍",
    rarity: "EPIC",
    predicate: (s) => s.uniqueVenuesVisited >= 25,
  },

  // Social
  {
    code: "referral_first",
    name: "Connector",
    description: "Referred your first friend",
    iconUrl: "🤝",
    rarity: "COMMON",
    predicate: (s) => s.totalReferrals >= 1,
  },
  {
    code: "referral_10",
    name: "Influencer",
    description: "Referred 10 friends",
    iconUrl: "🚀",
    rarity: "EPIC",
    predicate: (s) => s.totalReferrals >= 10,
  },
]

export function getBadgeByCode(code: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find((b) => b.code === code)
}
