const REFERRAL_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/I/1

export function generateReferralCode(length = 6): string {
  let code = ""
  for (let i = 0; i < length; i++) {
    code += REFERRAL_CHARS[Math.floor(Math.random() * REFERRAL_CHARS.length)]
  }
  return code
}

/**
 * Generates a 5-digit loyalty card number (10000–99999, no leading zeros).
 * The full 12-digit display loyalty ID shown to users is:
 *   TIMESTAMP_7digits + cardNumber_5digits
 * where the timestamp part is derived from the user's createdAt.
 */
export function generateCardNumber(): string {
  return String(Math.floor(Math.random() * 90000) + 10000)
}

/**
 * Formats the full 12-digit display loyalty ID from a createdAt date and cardNumber.
 * Example: "2026001" + "45678" = "202600145678"
 */
export function formatLoyaltyId(createdAt: Date, cardNumber: string): string {
  const ts = createdAt.getTime().toString().slice(-7) // last 7 digits of unix ms
  return ts + cardNumber
}
