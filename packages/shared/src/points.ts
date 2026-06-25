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

  // Единый баланс: тратим earned, затем welcome (без лимита на транзакцию и
  // кулдауна — welcome полноценные). Сгоревшие welcome не используются.
  const fromEarned = Math.min(amount, wallet.earnedPoints)
  let remaining = amount - fromEarned

  let fromWelcome = 0
  if (remaining > 0 && !welcomeExpired && wallet.welcomePoints > 0) {
    fromWelcome = Math.min(remaining, wallet.welcomePoints)
    remaining -= fromWelcome
  }

  if (remaining > 0) {
    return { ok: false, error: "INSUFFICIENT_POINTS" }
  }

  return { ok: true, fromEarned, fromWelcome }
}
