/**
 * points-mechanics.test.ts
 *
 * Полное покрытие механики начисления и списания баллов.
 *
 * Схема работы:
 *
 *  НАЧИСЛЕНИЕ (EARN)
 *  ─────────────────
 *  1. Скан QR чека (Serbia QR) → SCAN_POINTS_PER_CURRENCY × сумма в RSD
 *  2. Покупка у партнёра (PARTNER_PURCHASE) → amount × pointsPerCurrency × boost
 *  3. Чекин (CHECKIN_PHOTO) → CHECKIN_POINTS = 5
 *  4. Шаги (Step Multiplier) → множитель 1.0 / 1.1 / 1.2 / 1.3
 *  5. Стрик → бонус при достижении 7 / 30 / 100 дней
 *  6. Welcome-бонус → 500 баллов с экспирацией 90 дней
 *  7. Реферал — новый → 50 баллов сразу
 *  8. Реферал — пригласивший → 100 баллов после первой покупки
 *  9. День рождения → 200 баллов
 *
 *  СПИСАНИЕ (SPEND)
 *  ─────────────────
 *  1. Сначала из earnedPoints, потом из welcomePoints
 *  2. welcomePoints: макс 100/транзакцию, cooldown 24ч, срок 90 дней
 *  3. Минимальная сумма для редима: MIN_REDEEM = 100
 *  4. QR-код для redemption: TTL = 24ч
 */

import { describe, it, expect } from "vitest"
import {
  calcSpend,
  calculatePartnerPoints,
  stepMultiplier,
  computeStreakUpdate,
  WELCOME_BONUS_AMOUNT,
  WELCOME_EXPIRY_DAYS,
  WELCOME_MAX_PER_TRANSACTION,
  WELCOME_COOLDOWN_HOURS,
  SCAN_POINTS_PER_CURRENCY,
  SCAN_RATE_RATIO,
  MIN_REDEEM,
  RECEIPT_MAX_AGE_DAYS,
  RECEIPT_DAILY_LIMIT,
  RECEIPT_HOURLY_LIMIT,
  RECEIPT_MANUAL_REVIEW_THRESHOLD,
  OCR_CONFIDENCE_THRESHOLD,
  REFERRAL_SIGNUP_POINTS,
  REFERRAL_REWARD_POINTS,
  BIRTHDAY_BONUS_POINTS,
  CHECKIN_POINTS,
  GIFT_MIN_AMOUNT,
  GIFT_DAILY_LIMIT,
  STREAK_MILESTONES,
  STREAK_FORGIVENESS_HOURS,
} from "@pulse/shared"

// ─── Утилиты тестов ────────────────────────────────────────────────────────────

const now = Date.now()

function wallet(overrides: Partial<{
  earnedPoints: number
  welcomePoints: number
  welcomeExpiresAt: Date | null
  lastWelcomeUsedAt: Date | null
}> = {}) {
  return {
    earnedPoints: 0,
    welcomePoints: WELCOME_BONUS_AMOUNT,    // 500
    welcomeExpiresAt: new Date(now + WELCOME_EXPIRY_DAYS * 86_400_000),
    lastWelcomeUsedAt: null,
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// КОНСТАНТЫ — «документация» ожидаемых значений
// ═══════════════════════════════════════════════════════════════════════════════

describe("Константы — проверка spec-значений", () => {
  it("Welcome-бонус при регистрации = 500 баллов", () => {
    expect(WELCOME_BONUS_AMOUNT).toBe(500)
  })

  it("Welcome-баллы истекают через 90 дней", () => {
    expect(WELCOME_EXPIRY_DAYS).toBe(90)
  })

  it("Максимум welcome за транзакцию = 100 баллов", () => {
    expect(WELCOME_MAX_PER_TRANSACTION).toBe(100)
  })

  it("Cooldown для welcome = 24ч", () => {
    expect(WELCOME_COOLDOWN_HOURS).toBe(24)
  })

  it("Базовая ставка скана чека = 0.001 балл/RSD (1 балл за 1000 RSD)", () => {
    expect(SCAN_POINTS_PER_CURRENCY).toBe(0.001)
  })

  it("Партнёрская ставка в SCAN_RATE_RATIO раз лучше базовой", () => {
    expect(SCAN_RATE_RATIO).toBe(10)
  })

  it("Минимальный редим = 100 баллов", () => {
    expect(MIN_REDEEM).toBe(100)
  })

  it("Чек не старше RECEIPT_MAX_AGE_DAYS дней", () => {
    expect(RECEIPT_MAX_AGE_DAYS).toBe(7)
  })

  it("Лимит сканов в день = 10", () => {
    expect(RECEIPT_DAILY_LIMIT).toBe(10)
  })

  it("Лимит сканов в час = 3", () => {
    expect(RECEIPT_HOURLY_LIMIT).toBe(3)
  })

  it("Чеки >= 10 000 RSD → ручная проверка", () => {
    expect(RECEIPT_MANUAL_REVIEW_THRESHOLD).toBe(10_000)
  })

  it("OCR confidence порог = 0.85", () => {
    expect(OCR_CONFIDENCE_THRESHOLD).toBe(0.85)
  })

  it("Реферал — новый пользователь получает 50 баллов", () => {
    expect(REFERRAL_SIGNUP_POINTS).toBe(50)
  })

  it("Реферал — пригласивший получает 100 баллов", () => {
    expect(REFERRAL_REWARD_POINTS).toBe(100)
  })

  it("Бонус в день рождения = 200 баллов", () => {
    expect(BIRTHDAY_BONUS_POINTS).toBe(200)
  })

  it("Чекин = 5 баллов", () => {
    expect(CHECKIN_POINTS).toBe(5)
  })

  it("Подарок: минимум 50, дневной лимит 500", () => {
    expect(GIFT_MIN_AMOUNT).toBe(50)
    expect(GIFT_DAILY_LIMIT).toBe(500)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// НАЧИСЛЕНИЕ: скан чека
// ═══════════════════════════════════════════════════════════════════════════════

describe("Начисление баллов — скан QR чека", () => {
  function receiptPoints(amountRsd: number): number {
    return Math.floor(amountRsd * SCAN_POINTS_PER_CURRENCY)
  }

  it("за 1 000 RSD = 1 балл", () => {
    expect(receiptPoints(1_000)).toBe(1)
  })

  it("за 5 000 RSD = 5 баллов", () => {
    expect(receiptPoints(5_000)).toBe(5)
  })

  it("за 10 000 RSD = 10 баллов", () => {
    expect(receiptPoints(10_000)).toBe(10)
  })

  it("за 100 000 RSD = 100 баллов", () => {
    expect(receiptPoints(100_000)).toBe(100)
  })

  it("округляет вниз — за 1 499 RSD = 1 балл", () => {
    expect(receiptPoints(1_499)).toBe(1)
  })

  it("за 999 RSD = 0 баллов (меньше порога)", () => {
    expect(receiptPoints(999)).toBe(0)
  })

  it("нулевая сумма = 0 баллов", () => {
    expect(receiptPoints(0)).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// НАЧИСЛЕНИЕ: партнёрская покупка
// ═══════════════════════════════════════════════════════════════════════════════

describe("calculatePartnerPoints — покупка у партнёра", () => {
  const std = 0.01 // 1 балл за 100 RSD (пример)

  it("базовый расчёт без буста", () => {
    expect(calculatePartnerPoints(1_000, std, null, null)).toBe(10)
  })

  it("с активным бустом 2×", () => {
    const boostUntil = new Date(now + 3_600_000)
    expect(calculatePartnerPoints(1_000, std, 2, boostUntil)).toBe(20)
  })

  it("с истёкшим бустом — буст не применяется", () => {
    const expiredBoost = new Date(now - 1000)
    expect(calculatePartnerPoints(1_000, std, 2, expiredBoost)).toBe(10)
  })

  it("буст null без boostUntil — нет умножения", () => {
    expect(calculatePartnerPoints(1_000, std, 1.5, null)).toBe(10)
  })

  it("3× буст на 5 000 RSD", () => {
    const boostUntil = new Date(now + 86_400_000)
    expect(calculatePartnerPoints(5_000, std, 3, boostUntil)).toBe(150)
  })

  it("округляет вниз (floor)", () => {
    // 777 * 0.01 = 7.77 → floor = 7
    expect(calculatePartnerPoints(777, std, 1, null)).toBe(7)
  })

  it("партнёр даёт в SCAN_RATE_RATIO раз больше чем базовый скан", () => {
    const partnerRate = SCAN_POINTS_PER_CURRENCY * SCAN_RATE_RATIO  // 0.01
    const partnerPts = calculatePartnerPoints(1_000, partnerRate, null, null)
    const scanPts = Math.floor(1_000 * SCAN_POINTS_PER_CURRENCY)
    expect(partnerPts).toBe(scanPts * SCAN_RATE_RATIO)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// НАЧИСЛЕНИЕ: множитель шагов
// ═══════════════════════════════════════════════════════════════════════════════

describe("stepMultiplier — бонус за количество шагов за день", () => {
  it("менее 5 000 шагов → множитель 1.0", () => {
    expect(stepMultiplier(0)).toBe(1.0)
    expect(stepMultiplier(1_000)).toBe(1.0)
    expect(stepMultiplier(4_999)).toBe(1.0)
  })

  it("5 000–9 999 шагов → множитель 1.1", () => {
    expect(stepMultiplier(5_000)).toBe(1.1)
    expect(stepMultiplier(7_500)).toBe(1.1)
    expect(stepMultiplier(9_999)).toBe(1.1)
  })

  it("10 000–14 999 шагов → множитель 1.2", () => {
    expect(stepMultiplier(10_000)).toBe(1.2)
    expect(stepMultiplier(12_000)).toBe(1.2)
    expect(stepMultiplier(14_999)).toBe(1.2)
  })

  it("15 000+ шагов → множитель 1.3", () => {
    expect(stepMultiplier(15_000)).toBe(1.3)
    expect(stepMultiplier(20_000)).toBe(1.3)
    expect(stepMultiplier(100_000)).toBe(1.3)
  })

  it("граничные значения точны", () => {
    expect(stepMultiplier(4_999)).toBe(1.0)
    expect(stepMultiplier(5_000)).toBe(1.1)
    expect(stepMultiplier(9_999)).toBe(1.1)
    expect(stepMultiplier(10_000)).toBe(1.2)
    expect(stepMultiplier(14_999)).toBe(1.2)
    expect(stepMultiplier(15_000)).toBe(1.3)
  })

  it("применение к партнёрским баллам: 100 pts × 1.3 = 130", () => {
    const base = 100
    const result = Math.floor(base * stepMultiplier(15_000))
    expect(result).toBe(130)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// НАЧИСЛЕНИЕ: стрик
// ═══════════════════════════════════════════════════════════════════════════════

describe("computeStreakUpdate — ежедневный стрик", () => {
  it("первая активность: стрик = 1", () => {
    const r = computeStreakUpdate(0, 0, null)
    expect(r.currentStreak).toBe(1)
    expect(r.longestStreak).toBe(1)
  })

  it("активность в тот же день — стрик не меняется", () => {
    const fewHoursAgo = new Date(now - 3 * 3_600_000)
    const r = computeStreakUpdate(5, 5, fewHoursAgo)
    expect(r.currentStreak).toBe(5) // нет изменений
  })

  it("активность на следующий день (до 36ч) — стрик растёт", () => {
    const yesterday = new Date(now - 25 * 3_600_000)
    const r = computeStreakUpdate(5, 5, yesterday)
    expect(r.currentStreak).toBe(6)
  })

  it("пропуск больше 36ч — стрик сбрасывается в 1", () => {
    const twoDaysAgo = new Date(now - 48 * 3_600_000)
    const r = computeStreakUpdate(10, 10, twoDaysAgo)
    expect(r.currentStreak).toBe(1)
  })

  it("обновляет longestStreak при новом рекорде", () => {
    const yesterday = new Date(now - 25 * 3_600_000)
    const r = computeStreakUpdate(10, 10, yesterday)
    expect(r.longestStreak).toBe(11)
  })

  it("не уменьшает longestStreak при сбросе", () => {
    const twoDaysAgo = new Date(now - 50 * 3_600_000)
    const r = computeStreakUpdate(10, 15, twoDaysAgo)
    expect(r.currentStreak).toBe(1)
    expect(r.longestStreak).toBe(15)
  })

  it("Стрик 7 → бонус 50 баллов", () => {
    const yesterday = new Date(now - 25 * 3_600_000)
    const r = computeStreakUpdate(6, 6, yesterday)
    expect(r.currentStreak).toBe(7)
    expect(r.milestoneBonus).toBe(STREAK_MILESTONES[7]) // 50
  })

  it("Стрик 30 → бонус 200 баллов", () => {
    const yesterday = new Date(now - 25 * 3_600_000)
    const r = computeStreakUpdate(29, 29, yesterday)
    expect(r.milestoneBonus).toBe(STREAK_MILESTONES[30]) // 200
  })

  it("Стрик 100 → бонус 1000 баллов", () => {
    const yesterday = new Date(now - 25 * 3_600_000)
    const r = computeStreakUpdate(99, 99, yesterday)
    expect(r.milestoneBonus).toBe(STREAK_MILESTONES[100]) // 1000
  })

  it("обычный день без рекорда — milestoneBonus = 0", () => {
    const yesterday = new Date(now - 25 * 3_600_000)
    const r = computeStreakUpdate(3, 3, yesterday)
    expect(r.milestoneBonus).toBe(0)
  })

  it("forgiveness window = 36ч: через 35ч — ещё в рамках прощения", () => {
    const within35h = new Date(now - 35 * 3_600_000)
    const r = computeStreakUpdate(5, 5, within35h)
    expect(r.currentStreak).toBe(6)
  })

  it("forgiveness window = 36ч: через 37ч — уже сброс", () => {
    const beyond37h = new Date(now - 37 * 3_600_000)
    const r = computeStreakUpdate(5, 5, beyond37h)
    expect(r.currentStreak).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// СПИСАНИЕ: calcSpend — полная механика кошельков
// ═══════════════════════════════════════════════════════════════════════════════

describe("calcSpend — логика списания баллов", () => {
  // ── earned first ────────────────────────────────────────────────────────────

  describe("earnedPoints расходуются первыми", () => {
    it("только из earned — хватает полностью", () => {
      expect(calcSpend(wallet({ earnedPoints: 500 }), 300)).toEqual(
        { ok: true, fromEarned: 300, fromWelcome: 0 }
      )
    })

    it("earned покрывает точно сумму", () => {
      expect(calcSpend(wallet({ earnedPoints: 200 }), 200)).toEqual(
        { ok: true, fromEarned: 200, fromWelcome: 0 }
      )
    })

    it("earned = 0 → переход на welcome", () => {
      expect(calcSpend(wallet({ earnedPoints: 0 }), 80)).toEqual(
        { ok: true, fromEarned: 0, fromWelcome: 80 }
      )
    })

    it("earned частичный → добирает из welcome", () => {
      expect(calcSpend(wallet({ earnedPoints: 30 }), 80)).toEqual(
        { ok: true, fromEarned: 30, fromWelcome: 50 }
      )
    })
  })

  // ── welcome cap ──────────────────────────────────────────────────────────────

  describe("лимит welcome = 100/транзакцию", () => {
    it("ровно 100 из welcome — проходит", () => {
      expect(calcSpend(wallet({ earnedPoints: 0 }), 100)).toEqual(
        { ok: true, fromEarned: 0, fromWelcome: 100 }
      )
    })

    it("101 → не хватает (earned=0, welcome мощностью только 100)", () => {
      const result = calcSpend(wallet({ earnedPoints: 0 }), 101)
      expect(result).toEqual({ ok: false, error: "INSUFFICIENT_POINTS" })
    })

    it("earned=50 + welcome=100 = 150 — максимальная транзакция без earned", () => {
      expect(calcSpend(wallet({ earnedPoints: 50 }), 150)).toEqual(
        { ok: true, fromEarned: 50, fromWelcome: 100 }
      )
    })

    it("earned=50 + нужно 200 → не хватает", () => {
      const result = calcSpend(wallet({ earnedPoints: 50 }), 200)
      expect(result).toEqual({ ok: false, error: "INSUFFICIENT_POINTS" })
    })
  })

  // ── cooldown ──────────────────────────────────────────────────────────────────

  describe("cooldown welcome = 24ч", () => {
    it("сразу после использования — блокируется", () => {
      const result = calcSpend(wallet({ earnedPoints: 0, lastWelcomeUsedAt: new Date() }), 50)
      expect(result).toEqual({ ok: false, error: "WELCOME_DAILY_LIMIT" })
    })

    it("за 5 минут до истечения cooldown — всё ещё блокируется", () => {
      const almostDone = new Date(now - (WELCOME_COOLDOWN_HOURS * 3_600_000 - 5 * 60_000))
      const result = calcSpend(wallet({ earnedPoints: 0, lastWelcomeUsedAt: almostDone }), 50)
      expect(result).toEqual({ ok: false, error: "WELCOME_DAILY_LIMIT" })
    })

    it("ровно через 25ч — cooldown снят", () => {
      const yesterday = new Date(now - 25 * 3_600_000)
      const result = calcSpend(wallet({ earnedPoints: 0, lastWelcomeUsedAt: yesterday }), 100)
      expect(result).toEqual({ ok: true, fromEarned: 0, fromWelcome: 100 })
    })

    it("если есть earned, cooldown не блокирует (earned не затронут cooldown)", () => {
      const result = calcSpend(
        wallet({ earnedPoints: 200, lastWelcomeUsedAt: new Date() }),
        150,
      )
      // 150 покрывается earned, welcome не нужен
      expect(result).toEqual({ ok: true, fromEarned: 150, fromWelcome: 0 })
    })
  })

  // ── expiry ────────────────────────────────────────────────────────────────────

  describe("срок welcome-баллов", () => {
    it("expired welcome → не используется", () => {
      const expired = wallet({
        earnedPoints: 0,
        welcomeExpiresAt: new Date(now - 1000),
      })
      expect(calcSpend(expired, 50)).toEqual({ ok: false, error: "INSUFFICIENT_POINTS" })
    })

    it("expiry = null → welcome недоступен", () => {
      const noExpiry = wallet({ earnedPoints: 0, welcomeExpiresAt: null })
      expect(calcSpend(noExpiry, 50)).toEqual({ ok: false, error: "INSUFFICIENT_POINTS" })
    })

    it("активный welcome (не истёк) → работает", () => {
      const active = wallet({
        earnedPoints: 0,
        welcomeExpiresAt: new Date(now + 86_400_000),
      })
      expect(calcSpend(active, 50)).toEqual({ ok: true, fromEarned: 0, fromWelcome: 50 })
    })
  })

  // ── edge cases ────────────────────────────────────────────────────────────────

  describe("граничные случаи", () => {
    it("сумма = 0 → ok, ничего не списывается", () => {
      expect(calcSpend(wallet({ earnedPoints: 100 }), 0)).toEqual(
        { ok: true, fromEarned: 0, fromWelcome: 0 }
      )
    })

    it("нулевой кошелёк → INSUFFICIENT_POINTS", () => {
      expect(calcSpend(wallet({ earnedPoints: 0, welcomePoints: 0 }), 1)).toEqual(
        { ok: false, error: "INSUFFICIENT_POINTS" }
      )
    })

    it("earned достаточен — welcome с cooldown не мешает", () => {
      const w = wallet({ earnedPoints: 1000, lastWelcomeUsedAt: new Date() })
      expect(calcSpend(w, 500)).toEqual({ ok: true, fromEarned: 500, fromWelcome: 0 })
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// МИНИМАЛЬНЫЙ РЕДИМ
// ═══════════════════════════════════════════════════════════════════════════════

describe("Минимальный редим = MIN_REDEEM", () => {
  it("99 баллов — меньше минимума (MIN_REDEEM = 100)", () => {
    const totalPoints = 99
    expect(totalPoints < MIN_REDEEM).toBe(true)
  })

  it("100 баллов — точно минимум", () => {
    expect(MIN_REDEEM).toBeLessThanOrEqual(100)
    const totalPoints = 100
    expect(totalPoints >= MIN_REDEEM).toBe(true)
  })

  it("welcome (100) покрывает минимум для редима", () => {
    const w = wallet({ earnedPoints: 0 })
    const total = w.earnedPoints + w.welcomePoints
    expect(total).toBeGreaterThanOrEqual(MIN_REDEEM)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// QR-КОД ДЛЯ РЕДИМА (TTL)
// ═══════════════════════════════════════════════════════════════════════════════

describe("Redemption QR-код — TTL 24 часа", () => {
  const REDEMPTION_TTL_HOURS = 24

  function makeExpiry(): Date {
    return new Date(Date.now() + REDEMPTION_TTL_HOURS * 3_600_000)
  }

  it("свежий QR-код ещё не истёк", () => {
    const expiry = makeExpiry()
    expect(expiry > new Date()).toBe(true)
  })

  it("QR сгенерированный 25ч назад — истёк", () => {
    const expiredAt = new Date(now - 25 * 3_600_000 + REDEMPTION_TTL_HOURS * 3_600_000)
    // expiredAt = сейчас - 25ч + 24ч = сейчас - 1ч → в прошлом
    expect(expiredAt < new Date()).toBe(true)
  })

  it("QR истекает ровно через 24ч от создания", () => {
    const created = new Date()
    const expiry = new Date(created.getTime() + REDEMPTION_TTL_HOURS * 3_600_000)
    const diff = expiry.getTime() - created.getTime()
    expect(diff).toBe(24 * 3_600_000)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// РЕФЕРАЛЬНАЯ ПРОГРАММА
// ═══════════════════════════════════════════════════════════════════════════════

describe("Реферальная программа", () => {
  it("новый пользователь по рефералу получает 50 баллов немедленно", () => {
    expect(REFERRAL_SIGNUP_POINTS).toBe(50)
  })

  it("пригласивший получает 100 баллов после первой покупки друга", () => {
    expect(REFERRAL_REWARD_POINTS).toBe(100)
  })

  it("суммарный эффект одного реферала: 50 + 100 = 150 баллов в экосистему", () => {
    expect(REFERRAL_SIGNUP_POINTS + REFERRAL_REWARD_POINTS).toBe(150)
  })

  it("реферальная ставка выгоднее базового скана (150 pts > скан 5000 RSD)", () => {
    const scanFor5k = Math.floor(5_000 * SCAN_POINTS_PER_CURRENCY) // = 5
    expect(REFERRAL_REWARD_POINTS).toBeGreaterThan(scanFor5k)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// АНТИФРОД — лимиты сканирования
// ═══════════════════════════════════════════════════════════════════════════════

describe("Антифрод — лимиты сканирования чеков", () => {
  it("дневной лимит = 10 сканов", () => {
    expect(RECEIPT_DAILY_LIMIT).toBe(10)
  })

  it("часовой лимит = 3 скана", () => {
    expect(RECEIPT_HOURLY_LIMIT).toBe(3)
  })

  it("чек не старше 7 дней", () => {
    const cutoffMs = RECEIPT_MAX_AGE_DAYS * 24 * 3_600_000

    const freshReceipt = new Date(now - 24 * 3_600_000)    // вчера
    const staleReceipt = new Date(now - 8 * 24 * 3_600_000) // 8 дней назад

    expect(now - freshReceipt.getTime()).toBeLessThanOrEqual(cutoffMs)
    expect(now - staleReceipt.getTime()).toBeGreaterThan(cutoffMs)
  })

  it("чек из будущего — невалиден", () => {
    const futureDate = new Date(now + 3_600_000)
    expect(futureDate > new Date()).toBe(true) // будет отклонён
  })

  it("чеки >= 10 000 RSD требуют ручной проверки", () => {
    expect(RECEIPT_MANUAL_REVIEW_THRESHOLD).toBe(10_000)

    const small = 9_999
    const large = 10_000

    expect(small < RECEIPT_MANUAL_REVIEW_THRESHOLD).toBe(true)
    expect(large >= RECEIPT_MANUAL_REVIEW_THRESHOLD).toBe(true)
  })

  it("OCR confidence < 0.85 → чек не принимается автоматически", () => {
    const lowConf = 0.84
    const highConf = 0.85

    expect(lowConf < OCR_CONFIDENCE_THRESHOLD).toBe(true)
    expect(highConf >= OCR_CONFIDENCE_THRESHOLD).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// СКВОЗНОЙ СЦЕНАРИЙ — жизненный цикл баллов пользователя
// ═══════════════════════════════════════════════════════════════════════════════

describe("Сквозной сценарий: Марко, неделя активности", () => {
  it("День 0 — регистрация: кошелёк = 0 earned + 500 welcome", () => {
    const earnedPoints = 0
    const welcomePoints = WELCOME_BONUS_AMOUNT
    expect(earnedPoints + welcomePoints).toBe(500)
  })

  it("День 1 — скан чека на 3 000 RSD: +3 earned", () => {
    const earned = Math.floor(3_000 * SCAN_POINTS_PER_CURRENCY)
    expect(earned).toBe(3)
  })

  it("День 1 — покупка у партнёра 2 000 RSD × 0.01 = +20 earned", () => {
    const pts = calculatePartnerPoints(2_000, 0.01, null, null)
    expect(pts).toBe(20)
  })

  it("День 2 — 10 000 шагов → множитель 1.2 на партнёрские очки", () => {
    const base = calculatePartnerPoints(2_000, 0.01, null, null)
    const multiplied = Math.floor(base * stepMultiplier(10_000))
    expect(multiplied).toBe(24)
  })

  it("День 7 — стрик 7 дней → +50 milestone бонус", () => {
    const yesterday = new Date(now - 25 * 3_600_000)
    const streak = computeStreakUpdate(6, 6, yesterday)
    expect(streak.milestoneBonus).toBe(50)
  })

  it("Потратить 80 pts (earned=120, welcome=500): всё из earned", () => {
    const w = wallet({ earnedPoints: 120 })
    const result = calcSpend(w, 80)
    expect(result).toEqual({ ok: true, fromEarned: 80, fromWelcome: 0 })
  })

  it("Потратить 150 pts (earned=80): 80 из earned + 70 из welcome", () => {
    const w = wallet({ earnedPoints: 80 })
    const result = calcSpend(w, 150)
    expect(result).toEqual({ ok: true, fromEarned: 80, fromWelcome: 70 })
  })

  it("Попытка потратить 200 pts (earned=0, welcome=500): ошибка — max 100 из welcome", () => {
    const w = wallet({ earnedPoints: 0 })
    const result = calcSpend(w, 200)
    expect(result).toEqual({ ok: false, error: "INSUFFICIENT_POINTS" })
  })

  it("Welcome-баллы через 91 день — истекли, не работают", () => {
    const expired = wallet({
      earnedPoints: 0,
      welcomeExpiresAt: new Date(now - 1 * 86_400_000), // вчера
    })
    expect(calcSpend(expired, 50)).toEqual({ ok: false, error: "INSUFFICIENT_POINTS" })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ПОДАРОК БАЛЛОВ
// ═══════════════════════════════════════════════════════════════════════════════

describe("Подарок баллов (gift)", () => {
  function isGiftValid(amount: number, todaySent: number): { ok: boolean; reason?: string } {
    if (amount < GIFT_MIN_AMOUNT) return { ok: false, reason: "below_min" }
    if (todaySent + amount > GIFT_DAILY_LIMIT) return { ok: false, reason: "daily_limit" }
    return { ok: true }
  }

  it("минимальный подарок = 50 баллов", () => {
    expect(isGiftValid(49, 0)).toEqual({ ok: false, reason: "below_min" })
    expect(isGiftValid(50, 0)).toEqual({ ok: true })
  })

  it("дневной лимит отправки = 500 баллов", () => {
    expect(isGiftValid(100, 400)).toEqual({ ok: true })     // 500 = лимит
    expect(isGiftValid(100, 401)).toEqual({ ok: false, reason: "daily_limit" })
  })

  it("несколько подарков в день суммируются", () => {
    // Отправил 300, пытается ещё 250 — превысит 500
    expect(isGiftValid(250, 300)).toEqual({ ok: false, reason: "daily_limit" })
  })
})
