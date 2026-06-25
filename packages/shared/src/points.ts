import {
  NEW_MERCHANT_CREDIT_LIMIT,
  NEW_MERCHANT_CREDIT_DAYS,
  ACTIVE_CREDIT_TURNOVER_PCT,
  ACTIVE_CREDIT_DAYS,
} from "./constants"

// Кредитное предложение мерчанту по его обороту баллов за окно.
// Новый (оборот 0) → 500 на 2 дня; активный → max(500, 10% оборота) на 7 дней.
export function computeCreditOffer(turnoverPoints: number): { limit: number; termDays: number } {
  if (turnoverPoints <= 0) {
    return { limit: NEW_MERCHANT_CREDIT_LIMIT, termDays: NEW_MERCHANT_CREDIT_DAYS }
  }
  return {
    limit: Math.max(NEW_MERCHANT_CREDIT_LIMIT, Math.floor(turnoverPoints * ACTIVE_CREDIT_TURNOVER_PCT)),
    termDays: ACTIVE_CREDIT_DAYS,
  }
}

// Действующий кредитный лимит: 0, если срок истёк.
export function effectiveCreditLimit(creditLimit: number, creditDueAt: Date | null, now: Date = new Date()): number {
  if (!creditDueAt || creditDueAt.getTime() <= now.getTime()) return 0
  return creditLimit
}

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
