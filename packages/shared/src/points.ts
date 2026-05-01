import {
  WELCOME_MAX_PER_TRANSACTION,
  WELCOME_COOLDOWN_HOURS,
} from "./constants"

type WalletSnapshot = {
  earnedPoints: number
  welcomePoints: number
  welcomeExpiresAt: Date | null
  lastWelcomeUsedAt: Date | null
}

type SpendResult =
  | { ok: true; fromEarned: number; fromWelcome: number }
  | { ok: false; error: "INSUFFICIENT_POINTS" | "WELCOME_DAILY_LIMIT" | "WELCOME_EXPIRED" }

export function calcSpend(wallet: WalletSnapshot, amount: number): SpendResult {
  const now = Date.now()

  const welcomeExpired =
    !wallet.welcomeExpiresAt || wallet.welcomeExpiresAt.getTime() <= now

  const welcomeOnCooldown =
    wallet.lastWelcomeUsedAt !== null &&
    now - wallet.lastWelcomeUsedAt.getTime() < WELCOME_COOLDOWN_HOURS * 3_600_000

  // Drain earnedPoints first
  const fromEarned = Math.min(amount, wallet.earnedPoints)
  let remaining = amount - fromEarned

  let fromWelcome = 0
  if (remaining > 0) {
    if (welcomeExpired || wallet.welcomePoints <= 0) {
      // No welcome available — check if total covers the rest
    } else if (welcomeOnCooldown) {
      return { ok: false, error: "WELCOME_DAILY_LIMIT" }
    } else {
      fromWelcome = Math.min(remaining, wallet.welcomePoints, WELCOME_MAX_PER_TRANSACTION)
      remaining -= fromWelcome
    }
  }

  if (remaining > 0) {
    return { ok: false, error: "INSUFFICIENT_POINTS" }
  }

  return { ok: true, fromEarned, fromWelcome }
}
