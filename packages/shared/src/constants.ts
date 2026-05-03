// ── Points mechanics ──────────────────────────────────────────
export const SCAN_RATE_RATIO = 10 // partner rate is 10x better than scan rate
export const MIN_REDEEM = 100 // minimum points to redeem
export const SCAN_POINTS_PER_CURRENCY = 0.001 // 1 point per 1000 RSD (baseline scan rate)

/** Partner points calculation — apply active boost if any */
export function calculatePartnerPoints(
  amount: number,
  pointsPerCurrency: number,
  boostMultiplier: number | null | undefined,
  boostUntil: Date | null | undefined,
): number {
  const boostActive = boostUntil != null && boostUntil > new Date()
  const multiplier = boostActive && boostMultiplier ? boostMultiplier : 1
  return Math.floor(amount * pointsPerCurrency * multiplier)
}

// ── Welcome bonus (spec §4.6) ─────────────────────────────────
export const WELCOME_BONUS_AMOUNT = 500
export const WELCOME_MAX_PER_TRANSACTION = 100
export const WELCOME_COOLDOWN_HOURS = 24
export const WELCOME_EXPIRY_DAYS = 90

// ── Referral bonuses (spec §4.5) ─────────────────────────────
export const REFERRAL_REWARD_POINTS = 100 // referrer gets after first purchase
export const REFERRAL_SIGNUP_POINTS = 50  // referee gets immediately

// ── Checkin mechanics ─────────────────────────────────────────
export const CHECKIN_POINTS = 5
export const CHECKIN_RADIUS_METERS = 100
export const CHECKIN_ACCURACY_THRESHOLD = 50

// ── Receipt scan limits (anti-fraud, spec §8.1) ───────────────
export const RECEIPT_MAX_AGE_DAYS = 7
export const RECEIPT_DAILY_LIMIT = 10
export const RECEIPT_HOURLY_LIMIT = 3
export const RECEIPT_MANUAL_REVIEW_THRESHOLD = 10_000 // RSD
export const RECEIPT_SUSPICIOUS_DAILY_COUNT = 5
export const OCR_CONFIDENCE_THRESHOLD = 0.85

// ── Points gifting (spec §4.7) ────────────────────────────────
export const GIFT_MIN_AMOUNT = 50
export const GIFT_DAILY_LIMIT = 500

// ── Steps multiplier (spec §4.3) ──────────────────────────────
/** Returns earnings multiplier based on today's step count. */
export function stepMultiplier(steps: number): number {
  if (steps >= 15000) return 1.3
  if (steps >= 10000) return 1.2
  if (steps >= 5000) return 1.1
  return 1.0
}

// ── Streak milestones (spec §5.1) ─────────────────────────────
export const STREAK_MILESTONES: Record<number, number> = {
  7: 50,
  30: 200,
  100: 1000,
}
export const STREAK_FORGIVENESS_HOURS = 36

// ── Supported locales ─────────────────────────────────────────
export const SUPPORTED_LOCALES = ["en", "ru", "sr"] as const
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: SupportedLocale = "en"
