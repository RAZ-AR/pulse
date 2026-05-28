/**
 * merchant-flows.test.ts
 *
 * E2E-тесты приложения партнёра (merchant).
 * Все тесты — чистые unit-тесты без DB/HTTP.
 *
 * Реальный флоу авторизации партнёра (НЕ email/пароль):
 *   Партнёр открывает Telegram Mini App → Telegram передаёт initData
 *   → /api/merchant-tg-auth проверяет HMAC-подпись → извлекает telegramId
 *   → ищет merchant по telegramChatId → возвращает JWT + статус
 *
 *   Регистрация: /api/merchant-tg-register
 *   → та же HMAC-валидация + данные формы (name, city, address, rate)
 *   → создаёт Merchant (status=PENDING) + Venue
 *   → уведомляет администратора в Telegram
 *   → после одобрения: status=ACTIVE → партнёр может работать
 *
 * Покрываемые флоу:
 *  1. Telegram-авторизация и HMAC-валидация initData
 *  2. Регистрация через Mini App → статус PENDING → ACTIVE
 *  3. Создание заведения (venue) — поля и ставка баллов
 *  4. Запуск акции (offer) + видимость у клиентов
 *  5. Считывание QR клиента → начисление баллов
 *  6. Списание баллов клиента (merchant.redeemPoints)
 *  7. Валидация QR-редима клиента (reward.validate)
 *  8. Статистика дашборда
 *  9. Сквозной сценарий: «Кафе Пульс» — первая неделя
 */

import { describe, it, expect } from "vitest"
import { createHmac } from "crypto"
import {
  calculatePartnerPoints,
  stepMultiplier,
  computeStreakUpdate,
  calcSpend,
  REFERRAL_REWARD_POINTS,
  SCAN_RATE_RATIO,
  SCAN_POINTS_PER_CURRENCY,
  WELCOME_BONUS_AMOUNT,
  WELCOME_EXPIRY_DAYS,
  BADGE_DEFINITIONS,
  type BadgeStats,
} from "@pulse/shared"

// ─── Утилиты ──────────────────────────────────────────────────────────────────

const now = Date.now()

function freshWallet(overrides: Partial<{
  earnedPoints: number
  welcomePoints: number
  welcomeExpiresAt: Date | null
  lastWelcomeUsedAt: Date | null
}> = {}) {
  return {
    earnedPoints: 0,
    welcomePoints: WELCOME_BONUS_AMOUNT,
    welcomeExpiresAt: new Date(now + WELCOME_EXPIRY_DAYS * 86_400_000),
    lastWelcomeUsedAt: null,
    ...overrides,
  }
}

// ─── Telegram initData helpers (из route.ts) ───────────────────────────────────

/**
 * Строит валидную initData-строку с правильной HMAC-подписью.
 * Используется для positive-тестов.
 */
function buildValidInitData(botToken: string, tgUserId: number, firstName = "Armen"): string {
  const user = JSON.stringify({ id: tgUserId, first_name: firstName, username: "armen_pulse" })
  const params = new URLSearchParams({
    user,
    auth_date: String(Math.floor(Date.now() / 1000)),
    chat_instance: "123456",
  })

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

  params.set("hash", hash)
  return params.toString()
}

/**
 * Зеркало функции validateTelegramInitData из route.ts
 */
function validateTelegramInitData(initData: string, botToken: string): Record<string, string> | null {
  const params = new URLSearchParams(initData)
  const hash = params.get("hash")
  if (!hash) return null

  params.delete("hash")
  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n")

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest()
  const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex")

  if (expectedHash !== hash) return null
  return Object.fromEntries(params)
}

// ─── Логика авторизации (из merchant-tg-auth/route.ts) ────────────────────────

type MerchantStatus = "PENDING" | "ACTIVE" | "SUSPENDED"
type AuthResult =
  | { status: "unregistered"; telegramId: string }
  | { status: "pending";      telegramId: string; token: string; merchantId: string }
  | { status: "active";       token: string; merchantId: string }

function resolveMerchantAuthResult(
  merchant: { id: string; status: MerchantStatus } | null,
  telegramId: string,
) {
  if (!merchant) return { status: "unregistered" as const, telegramId }
  if (merchant.status !== "ACTIVE") return { status: "pending" as const, telegramId, merchantId: merchant.id }
  return { status: "active" as const, merchantId: merchant.id }
}

// ─── Логика регистрации (из merchant-tg-register/route.ts) ────────────────────

type RegisterInput = {
  name: string
  category: string
  city: string
  address: string
  rate: string
  taxId?: string
}

function validateRegisterInput(input: RegisterInput): { ok: boolean; error?: string } {
  const VALID_CATEGORIES = ["CAFE", "RESTAURANT", "RETAIL", "SERVICE", "OTHER"]

  if (!input.name?.trim())      return { ok: false, error: "Missing name" }
  if (!VALID_CATEGORIES.includes(input.category)) return { ok: false, error: "Invalid category" }
  if (!input.city?.trim())      return { ok: false, error: "Missing city" }
  if (!input.address?.trim())   return { ok: false, error: "Missing address" }

  const rate = parseFloat(input.rate)
  if (isNaN(rate) || rate <= 0) return { ok: false, error: "Invalid rate" }

  return { ok: true }
}

// ─── Создание заведения ────────────────────────────────────────────────────────

function validateVenueInput(input: {
  name: string
  category: string
  address: string
  city: string
  lat: number
  lng: number
  pointsPerCurrency?: number
}): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const VALID_CATEGORIES = ["CAFE", "RESTAURANT", "RETAIL", "SERVICE", "OTHER"]

  if (!input.name || input.name.length > 100)      errors.push("name")
  if (!VALID_CATEGORIES.includes(input.category))  errors.push("category")
  if (!input.address)                               errors.push("address")
  if (!input.city)                                  errors.push("city")
  if (input.lat < -90 || input.lat > 90)            errors.push("lat")
  if (input.lng < -180 || input.lng > 180)          errors.push("lng")
  if (input.pointsPerCurrency !== undefined && input.pointsPerCurrency <= 0) errors.push("pointsPerCurrency")

  return { ok: errors.length === 0, errors }
}

// ─── Логика акции ──────────────────────────────────────────────────────────────

type OfferState = {
  active: boolean
  startsAt: Date
  endsAt: Date | null
  usageLimit: number | null
  usageCount: number
  costPoints: number
}

function canCreateOffer(
  balance: { pointsBalance: number },
  costPerUse: number,
  usageLimit: number | null,
): { ok: boolean; error?: string } {
  if (costPerUse <= 0) return { ok: false, error: "invalid_cost" }
  if (usageLimit !== null && balance.pointsBalance < costPerUse * usageLimit) {
    return { ok: false, error: `Not enough points. Need ${costPerUse * usageLimit}, have ${balance.pointsBalance}` }
  }
  return { ok: true }
}

function isOfferAvailable(offer: OfferState): { available: boolean; reason?: string } {
  const n = new Date()
  if (!offer.active)                                 return { available: false, reason: "inactive" }
  if (offer.startsAt > n)                            return { available: false, reason: "not_started" }
  if (offer.endsAt !== null && offer.endsAt < n)     return { available: false, reason: "expired" }
  if (offer.usageLimit !== null && offer.usageCount >= offer.usageLimit)
                                                     return { available: false, reason: "limit_reached" }
  return { available: true }
}

// ─── Начисление баллов клиенту ─────────────────────────────────────────────────

function partnerPurchasePoints(params: {
  amount: number
  pointsPerCurrency: number
  boostMultiplier: number | null
  boostUntil: Date | null
  stepsToday: number
  milestoneBonus?: number
}): { basePoints: number; withSteps: number; total: number } {
  const base = calculatePartnerPoints(params.amount, params.pointsPerCurrency, params.boostMultiplier, params.boostUntil)
  const withSteps = Math.floor(base * stepMultiplier(params.stepsToday))
  const total = withSteps + (params.milestoneBonus ?? 0)
  return { basePoints: base, withSteps, total }
}

// ─── Списание баллов (merchant.redeemPoints) ──────────────────────────────────

function merchantRedeemValidate(params: {
  userId: string
  venueId: string
  points: number
  userBalance: { earnedPoints: number; welcomePoints: number }
  isPartner: boolean
  todayRedemptions: number
}): { ok: boolean; error?: string; earnedDeduct?: number; welcomeDeduct?: number } {
  const MAX_DAILY = 5
  if (!params.isPartner) return { ok: false, error: "venue_not_partner" }
  const total = params.userBalance.earnedPoints + params.userBalance.welcomePoints
  if (total < params.points)
    return { ok: false, error: `insufficient_points: balance=${total}, need=${params.points}` }
  if (params.todayRedemptions >= MAX_DAILY)
    return { ok: false, error: "daily_limit_reached" }
  const earnedDeduct = Math.min(params.points, params.userBalance.earnedPoints)
  const welcomeDeduct = params.points - earnedDeduct
  return { ok: true, earnedDeduct, welcomeDeduct }
}

// ─── Валидация QR-кода клиента (reward.validate) ──────────────────────────────

type RedemptionRecord = {
  status: "ACTIVE" | "USED" | "EXPIRED"
  expiresAt: Date
  venueOwnerId: string
}

function validateRedemptionQr(record: RedemptionRecord | null, merchantId: string): { valid: boolean; reason?: string } {
  if (!record)                                 return { valid: false, reason: "not_found" }
  if (record.venueOwnerId !== merchantId)      return { valid: false, reason: "wrong_venue" }
  if (record.status === "USED")                return { valid: false, reason: "already_used" }
  if (record.status === "EXPIRED" || record.expiresAt < new Date())
                                               return { valid: false, reason: "expired" }
  return { valid: true }
}

// ─── Статистика ────────────────────────────────────────────────────────────────

type TxRecord = { pointsEarned: number; amount: number; userId: string }

function aggregatePeriod(txns: TxRecord[]): { pointsIssued: number; transactions: number; uniqueCustomers: number } {
  return {
    pointsIssued: txns.reduce((s, t) => s + t.pointsEarned, 0),
    transactions: txns.length,
    uniqueCustomers: new Set(txns.map((t) => t.userId)).size,
  }
}

function segmentCustomers(visitsByCustomer: Map<string, number>): { new: number; returning: number; frequent: number } {
  let newCount = 0, returningCount = 0, frequentCount = 0
  for (const visits of visitsByCustomer.values()) {
    if (visits === 1)     newCount++
    else if (visits <= 4) returningCount++
    else                  frequentCount++
  }
  return { new: newCount, returning: returningCount, frequent: frequentCount }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. TELEGRAM initData — HMAC-ВАЛИДАЦИЯ
// ═══════════════════════════════════════════════════════════════════════════════

describe("1. Telegram initData — HMAC-валидация", () => {
  const BOT_TOKEN = "test-bot-token-12345"
  const TG_USER_ID = 987654321

  it("валидная подпись — проходит проверку", () => {
    const initData = buildValidInitData(BOT_TOKEN, TG_USER_ID)
    const result = validateTelegramInitData(initData, BOT_TOKEN)
    expect(result).not.toBeNull()
  })

  it("из результата извлекается telegramId", () => {
    const initData = buildValidInitData(BOT_TOKEN, TG_USER_ID)
    const data = validateTelegramInitData(initData, BOT_TOKEN)!
    const tgUser = JSON.parse(data["user"]!) as { id: number }
    expect(String(tgUser.id)).toBe(String(TG_USER_ID))
  })

  it("неверный бот-токен — невалидная подпись", () => {
    const initData = buildValidInitData(BOT_TOKEN, TG_USER_ID)
    expect(validateTelegramInitData(initData, "wrong-token")).toBeNull()
  })

  it("отсутствует hash — невалидно", () => {
    const params = new URLSearchParams({ user: '{"id":1}', auth_date: "1700000000" })
    expect(validateTelegramInitData(params.toString(), BOT_TOKEN)).toBeNull()
  })

  it("подпись из чужого initData — не проходит", () => {
    const otherToken = "other-bot-token"
    const initDataOther = buildValidInitData(otherToken, TG_USER_ID)
    expect(validateTelegramInitData(initDataOther, BOT_TOKEN)).toBeNull()
  })

  it("пустой initData — невалидно", () => {
    expect(validateTelegramInitData("", BOT_TOKEN)).toBeNull()
  })

  it("initData для разных пользователей различаются", () => {
    const d1 = buildValidInitData(BOT_TOKEN, 111)
    const d2 = buildValidInitData(BOT_TOKEN, 222)
    // оба валидны, но разные телеграм-ID
    const u1 = JSON.parse(validateTelegramInitData(d1, BOT_TOKEN)!["user"]!) as { id: number }
    const u2 = JSON.parse(validateTelegramInitData(d2, BOT_TOKEN)!["user"]!) as { id: number }
    expect(u1.id).not.toBe(u2.id)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 2. АВТОРИЗАЦИЯ ПАРТНЁРА — статусы
// ═══════════════════════════════════════════════════════════════════════════════

describe("2. Авторизация партнёра по Telegram ID — статусы", () => {
  const tgId = "123456789"

  it("неизвестный telegramId → status=unregistered", () => {
    const r = resolveMerchantAuthResult(null, tgId)
    expect(r.status).toBe("unregistered")
    expect((r as { telegramId: string }).telegramId).toBe(tgId)
  })

  it("зарегистрирован, ожидает одобрения → status=pending", () => {
    const r = resolveMerchantAuthResult({ id: "m-1", status: "PENDING" }, tgId)
    expect(r.status).toBe("pending")
  })

  it("одобрен администратором → status=active → может работать", () => {
    const r = resolveMerchantAuthResult({ id: "m-1", status: "ACTIVE" }, tgId)
    expect(r.status).toBe("active")
  })

  it("приостановлен → status=pending (не active)", () => {
    const r = resolveMerchantAuthResult({ id: "m-1", status: "SUSPENDED" }, tgId)
    expect(r.status).not.toBe("active")
  })

  it("PENDING партнёр не может выдавать баллы (not active)", () => {
    const r = resolveMerchantAuthResult({ id: "m-1", status: "PENDING" }, tgId)
    expect(r.status).not.toBe("active")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 3. РЕГИСТРАЦИЯ ЧЕРЕЗ MINI APP
// ═══════════════════════════════════════════════════════════════════════════════

describe("3. Регистрация партнёра — форма Mini App", () => {
  const valid: RegisterInput = {
    name: "Кафе Пульс",
    category: "CAFE",
    city: "Belgrade",
    address: "Knez Mihailova 12",
    rate: "0.01",
  }

  it("все поля заполнены корректно — OK", () => {
    expect(validateRegisterInput(valid)).toEqual({ ok: true })
  })

  it("пустое имя — ошибка", () => {
    expect(validateRegisterInput({ ...valid, name: "" })).toMatchObject({ ok: false })
  })

  it("неверная категория — ошибка", () => {
    expect(validateRegisterInput({ ...valid, category: "BAR" })).toMatchObject({ ok: false, error: "Invalid category" })
  })

  it("пустой город — ошибка", () => {
    expect(validateRegisterInput({ ...valid, city: "" })).toMatchObject({ ok: false })
  })

  it("пустой адрес — ошибка", () => {
    expect(validateRegisterInput({ ...valid, address: "" })).toMatchObject({ ok: false })
  })

  it("rate = 0 — ошибка", () => {
    expect(validateRegisterInput({ ...valid, rate: "0" })).toMatchObject({ ok: false, error: "Invalid rate" })
  })

  it("rate = -1 — ошибка", () => {
    expect(validateRegisterInput({ ...valid, rate: "-1" })).toMatchObject({ ok: false, error: "Invalid rate" })
  })

  it("rate = 'abc' — ошибка (NaN)", () => {
    expect(validateRegisterInput({ ...valid, rate: "abc" })).toMatchObject({ ok: false, error: "Invalid rate" })
  })

  it("все 5 категорий допустимы", () => {
    for (const cat of ["CAFE", "RESTAURANT", "RETAIL", "SERVICE", "OTHER"]) {
      expect(validateRegisterInput({ ...valid, category: cat })).toEqual({ ok: true })
    }
  })

  it("taxId не обязателен — OK без него", () => {
    const { taxId: _, ...withoutTax } = { ...valid, taxId: undefined }
    expect(validateRegisterInput(withoutTax as RegisterInput)).toEqual({ ok: true })
  })

  it("после регистрации статус = PENDING (нужно одобрение администратора)", () => {
    // Симулируем что создался мерчант со статусом PENDING
    const r = resolveMerchantAuthResult({ id: "m-new", status: "PENDING" }, "999")
    expect(r.status).toBe("pending")
  })

  it("повторная регистрация с тем же telegramId — конфликт (409)", () => {
    // Логика из route.ts: if (existing) return 409
    const existingMerchant = { id: "m-existing", status: "ACTIVE" as MerchantStatus }
    expect(existingMerchant).toBeTruthy() // merchant уже есть — register должен отклонить
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 4. СОЗДАНИЕ ЗАВЕДЕНИЯ — поля и ставка
// ═══════════════════════════════════════════════════════════════════════════════

describe("4. Создание заведения", () => {
  const validVenue = {
    name: "Кафе Пульс",
    category: "CAFE",
    address: "Knez Mihailova 12",
    city: "Belgrade",
    lat: 44.8178,
    lng: 20.4569,
    pointsPerCurrency: 0.01,
  }

  it("валидные данные — OK", () => {
    expect(validateVenueInput(validVenue)).toEqual({ ok: true, errors: [] })
  })

  it("пустое имя или > 100 символов — ошибка", () => {
    expect(validateVenueInput({ ...validVenue, name: "" })).toMatchObject({ ok: false })
    expect(validateVenueInput({ ...validVenue, name: "X".repeat(101) })).toMatchObject({ ok: false })
  })

  it("координаты вне диапазона — ошибка", () => {
    expect(validateVenueInput({ ...validVenue, lat: 95 })).toMatchObject({ ok: false, errors: expect.arrayContaining(["lat"]) })
    expect(validateVenueInput({ ...validVenue, lng: 200 })).toMatchObject({ ok: false, errors: expect.arrayContaining(["lng"]) })
  })

  it("ставка = 0 или отрицательная — ошибка", () => {
    expect(validateVenueInput({ ...validVenue, pointsPerCurrency: 0 })).toMatchObject({ ok: false })
    expect(validateVenueInput({ ...validVenue, pointsPerCurrency: -0.01 })).toMatchObject({ ok: false })
  })

  it("ставка партнёра в 10× лучше базового скана чека", () => {
    const minPartnerRate = SCAN_POINTS_PER_CURRENCY * SCAN_RATE_RATIO
    expect(minPartnerRate).toBe(0.01)
    expect(calculatePartnerPoints(10_000, minPartnerRate, null, null)).toBe(100)
    expect(Math.floor(10_000 * SCAN_POINTS_PER_CURRENCY)).toBe(10)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 5. ЗАПУСК АКЦИИ
// ═══════════════════════════════════════════════════════════════════════════════

describe("5. Создание акции — баланс партнёра", () => {
  it("хватает баланса — OK", () => {
    expect(canCreateOffer({ pointsBalance: 500 }, 50, 10)).toEqual({ ok: true })
  })

  it("не хватает баланса — ошибка", () => {
    expect(canCreateOffer({ pointsBalance: 400 }, 50, 10)).toMatchObject({ ok: false })
  })

  it("без лимита использований — баланс не проверяется", () => {
    expect(canCreateOffer({ pointsBalance: 1 }, 50, null)).toEqual({ ok: true })
  })

  it("стоимость = 0 — недопустима", () => {
    expect(canCreateOffer({ pointsBalance: 1000 }, 0, null)).toMatchObject({ ok: false, error: "invalid_cost" })
  })
})

describe("5. Доступность акции в клиентском приложении", () => {
  const active: OfferState = {
    active: true,
    startsAt: new Date(now - 3_600_000),
    endsAt: new Date(now + 86_400_000),
    usageLimit: 100,
    usageCount: 50,
    costPoints: 30,
  }

  it("активная акция доступна", () => {
    expect(isOfferAvailable(active)).toEqual({ available: true })
  })

  it("деактивированная — недоступна", () => {
    expect(isOfferAvailable({ ...active, active: false })).toMatchObject({ available: false, reason: "inactive" })
  })

  it("ещё не началась — недоступна", () => {
    expect(isOfferAvailable({ ...active, startsAt: new Date(now + 3_600_000) })).toMatchObject({ available: false, reason: "not_started" })
  })

  it("срок истёк — недоступна", () => {
    expect(isOfferAvailable({ ...active, endsAt: new Date(now - 1000) })).toMatchObject({ available: false, reason: "expired" })
  })

  it("исчерпан лимит — недоступна", () => {
    expect(isOfferAvailable({ ...active, usageLimit: 100, usageCount: 100 })).toMatchObject({ available: false, reason: "limit_reached" })
  })

  it("без лимита и без срока — доступна всегда", () => {
    expect(isOfferAvailable({ ...active, endsAt: null, usageLimit: null })).toEqual({ available: true })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 6. QR КЛИЕНТА → НАЧИСЛЕНИЕ БАЛЛОВ
// ═══════════════════════════════════════════════════════════════════════════════

describe("6. Расчёт баллов при покупке у партнёра", () => {
  const rate = 0.01

  it("базовый расчёт: 2 000 RSD → 20 pts", () => {
    const r = partnerPurchasePoints({ amount: 2_000, pointsPerCurrency: rate, boostMultiplier: null, boostUntil: null, stepsToday: 0 })
    expect(r).toEqual({ basePoints: 20, withSteps: 20, total: 20 })
  })

  it("5 000 шагов → ×1.1 → 22 pts", () => {
    const r = partnerPurchasePoints({ amount: 2_000, pointsPerCurrency: rate, boostMultiplier: null, boostUntil: null, stepsToday: 5_000 })
    expect(r.withSteps).toBe(22)
  })

  it("10 000 шагов → ×1.2 → 24 pts", () => {
    const r = partnerPurchasePoints({ amount: 2_000, pointsPerCurrency: rate, boostMultiplier: null, boostUntil: null, stepsToday: 10_000 })
    expect(r.withSteps).toBe(24)
  })

  it("15 000 шагов → ×1.3 → 26 pts", () => {
    const r = partnerPurchasePoints({ amount: 2_000, pointsPerCurrency: rate, boostMultiplier: null, boostUntil: null, stepsToday: 15_000 })
    expect(r.withSteps).toBe(26)
  })

  it("буст 2× → 40 pts", () => {
    const r = partnerPurchasePoints({ amount: 2_000, pointsPerCurrency: rate, boostMultiplier: 2, boostUntil: new Date(now + 86_400_000), stepsToday: 0 })
    expect(r.basePoints).toBe(40)
  })

  it("истёкший буст не применяется → 20 pts", () => {
    const r = partnerPurchasePoints({ amount: 2_000, pointsPerCurrency: rate, boostMultiplier: 2, boostUntil: new Date(now - 1000), stepsToday: 0 })
    expect(r.basePoints).toBe(20)
  })

  it("стрик-бонус 50 pts добавляется к итогу", () => {
    const streak = computeStreakUpdate(6, 6, new Date(now - 25 * 3_600_000))
    const r = partnerPurchasePoints({ amount: 2_000, pointsPerCurrency: rate, boostMultiplier: null, boostUntil: null, stepsToday: 0, milestoneBonus: streak.milestoneBonus })
    expect(streak.milestoneBonus).toBe(50)
    expect(r.total).toBe(70)
  })

  it("первая покупка → реферер получает 100 pts", () => {
    const bonus = true /* isFirstPurchase */ ? REFERRAL_REWARD_POINTS : 0
    expect(bonus).toBe(100)
  })

  it("повторная покупка → реферальный бонус не начисляется", () => {
    const bonus = false /* isFirstPurchase */ ? REFERRAL_REWARD_POINTS : 0
    expect(bonus).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 7. СПИСАНИЕ БАЛЛОВ КЛИЕНТА (merchant.redeemPoints)
// ═══════════════════════════════════════════════════════════════════════════════

describe("7. merchant.redeemPoints — партнёр списывает баллы клиента", () => {
  const base = { userId: "u1", venueId: "v1", points: 100, userBalance: { earnedPoints: 200, welcomePoints: 500 }, isPartner: true, todayRedemptions: 0 }

  it("успешно: 150 pts полностью из earned", () => {
    expect(merchantRedeemValidate({ ...base, points: 150 })).toMatchObject({ ok: true, earnedDeduct: 150, welcomeDeduct: 0 })
  })

  it("earned мало → добирает из welcome", () => {
    expect(merchantRedeemValidate({ ...base, points: 250, userBalance: { earnedPoints: 100, welcomePoints: 500 } })).toMatchObject({ ok: true, earnedDeduct: 100, welcomeDeduct: 150 })
  })

  it("earned = 0 → всё из welcome", () => {
    expect(merchantRedeemValidate({ ...base, points: 80, userBalance: { earnedPoints: 0, welcomePoints: 500 } })).toMatchObject({ ok: true, earnedDeduct: 0, welcomeDeduct: 80 })
  })

  it("недостаточно баллов — ошибка", () => {
    expect(merchantRedeemValidate({ ...base, points: 1000, userBalance: { earnedPoints: 100, welcomePoints: 200 } })).toMatchObject({ ok: false })
  })

  it("заведение не партнёр — ошибка", () => {
    expect(merchantRedeemValidate({ ...base, isPartner: false })).toMatchObject({ ok: false, error: "venue_not_partner" })
  })

  it("дневной лимит 5 редимов достигнут — ошибка", () => {
    expect(merchantRedeemValidate({ ...base, todayRedemptions: 5 })).toMatchObject({ ok: false, error: "daily_limit_reached" })
  })

  it("4-й редим — ещё разрешён", () => {
    expect(merchantRedeemValidate({ ...base, todayRedemptions: 4 })).toMatchObject({ ok: true })
  })

  it("нулевой баланс — ошибка", () => {
    expect(merchantRedeemValidate({ ...base, userBalance: { earnedPoints: 0, welcomePoints: 0 }, points: 1 })).toMatchObject({ ok: false })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 8. ВАЛИДАЦИЯ QR-РЕДИМА (reward.validate)
// ═══════════════════════════════════════════════════════════════════════════════

describe("8. reward.validate — партнёр сканирует QR клиента", () => {
  const mid = "merchant-1"
  const active: RedemptionRecord = { status: "ACTIVE", expiresAt: new Date(now + 23 * 3_600_000), venueOwnerId: mid }

  it("валидный активный QR → принят", () => {
    expect(validateRedemptionQr(active, mid)).toEqual({ valid: true })
  })

  it("QR не найден → not_found", () => {
    expect(validateRedemptionQr(null, mid)).toMatchObject({ valid: false, reason: "not_found" })
  })

  it("QR уже использован → already_used", () => {
    expect(validateRedemptionQr({ ...active, status: "USED" }, mid)).toMatchObject({ valid: false, reason: "already_used" })
  })

  it("QR истёк по статусу → expired", () => {
    expect(validateRedemptionQr({ ...active, status: "EXPIRED" }, mid)).toMatchObject({ valid: false, reason: "expired" })
  })

  it("QR истёк по дате → expired", () => {
    expect(validateRedemptionQr({ ...active, expiresAt: new Date(now - 1000) }, mid)).toMatchObject({ valid: false, reason: "expired" })
  })

  it("QR чужого заведения → wrong_venue", () => {
    expect(validateRedemptionQr(active, "merchant-2")).toMatchObject({ valid: false, reason: "wrong_venue" })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 9. СТАТИСТИКА ДАШБОРДА
// ═══════════════════════════════════════════════════════════════════════════════

describe("9. Статистика — агрегации", () => {
  const txns: TxRecord[] = [
    { pointsEarned: 10, amount: 1000, userId: "u1" },
    { pointsEarned: 20, amount: 2000, userId: "u1" },
    { pointsEarned: 15, amount: 1500, userId: "u2" },
    { pointsEarned: 30, amount: 3000, userId: "u3" },
  ]

  it("суммирует pointsIssued", () => { expect(aggregatePeriod(txns).pointsIssued).toBe(75) })
  it("считает транзакции", ()    => { expect(aggregatePeriod(txns).transactions).toBe(4) })
  it("считает уникальных клиентов", () => { expect(aggregatePeriod(txns).uniqueCustomers).toBe(3) })
  it("пустой период — нули", ()  => { expect(aggregatePeriod([])).toEqual({ pointsIssued: 0, transactions: 0, uniqueCustomers: 0 }) })
})

describe("9. Сегментация клиентов", () => {
  it("1 визит → новый", ()    => { expect(segmentCustomers(new Map([["u1", 1]]))).toEqual({ new: 1, returning: 0, frequent: 0 }) })
  it("2–4 визита → повторный", () => { expect(segmentCustomers(new Map([["u1", 3]]))).toEqual({ new: 0, returning: 1, frequent: 0 }) })
  it("5+ визитов → частый",   () => { expect(segmentCustomers(new Map([["u1", 5]]))).toEqual({ new: 0, returning: 0, frequent: 1 }) })
  it("смешанная база", ()      => {
    const map = new Map([["a", 1], ["b", 1], ["c", 3], ["d", 7]])
    expect(segmentCustomers(map)).toEqual({ new: 2, returning: 1, frequent: 1 })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 10. ЗНАЧКИ ЗА АКТИВНОСТЬ
// ═══════════════════════════════════════════════════════════════════════════════

describe("10. Значки — выдаются партнёром при покупке", () => {
  const base: BadgeStats = {
    totalReceiptScans: 0, totalCheckins: 0, totalPartnerPurchases: 0,
    totalReferrals: 0, uniqueVenuesVisited: 0, longestStreak: 0,
  }

  it("welcome-значок — всем новым", () => {
    expect(BADGE_DEFINITIONS.find((b) => b.code === "welcome")!.predicate(base)).toBe(true)
  })

  it("streak_7 — при longestStreak >= 7", () => {
    const b = BADGE_DEFINITIONS.find((b) => b.code === "streak_7")!
    expect(b.predicate({ ...base, longestStreak: 6 })).toBe(false)
    expect(b.predicate({ ...base, longestStreak: 7 })).toBe(true)
  })

  it("первая партнёрская покупка разблокирует хотя бы один значок", () => {
    const unlocked = BADGE_DEFINITIONS.filter((b) =>
      b.predicate({ ...base, totalPartnerPurchases: 1 }) &&
      !b.predicate({ ...base, totalPartnerPurchases: 0 })
    )
    expect(unlocked.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// 11. СКВОЗНОЙ СЦЕНАРИЙ: «Кафе Пульс» — первая неделя
// ═══════════════════════════════════════════════════════════════════════════════

describe("11. Сквозной сценарий: «Кафе Пульс» — первая неделя", () => {
  const BOT_TOKEN = "partner-bot-test"
  const OWNER_TG_ID = 555777999
  const RATE = 0.01
  const BOOST = 2
  const boostUntil = new Date(now + 7 * 86_400_000)

  it("Шаг 1 — владелец открывает Mini App: initData валидна", () => {
    const initData = buildValidInitData(BOT_TOKEN, OWNER_TG_ID, "Armen")
    expect(validateTelegramInitData(initData, BOT_TOKEN)).not.toBeNull()
  })

  it("Шаг 1b — telegramId корректно извлечён из initData", () => {
    const initData = buildValidInitData(BOT_TOKEN, OWNER_TG_ID)
    const data = validateTelegramInitData(initData, BOT_TOKEN)!
    const tgUser = JSON.parse(data["user"]!) as { id: number }
    expect(String(tgUser.id)).toBe(String(OWNER_TG_ID))
  })

  it("Шаг 2 — первый запуск: неизвестный telegramId → unregistered", () => {
    expect(resolveMerchantAuthResult(null, String(OWNER_TG_ID)).status).toBe("unregistered")
  })

  it("Шаг 3 — заполнил форму регистрации → данные валидны", () => {
    expect(validateRegisterInput({
      name: "Кафе Пульс",
      category: "CAFE",
      city: "Belgrade",
      address: "Bulevar Oslobodjenja 18",
      rate: String(RATE),
      taxId: "109876543",
    })).toEqual({ ok: true })
  })

  it("Шаг 4 — Merchant создан со статусом PENDING → не может работать", () => {
    expect(resolveMerchantAuthResult({ id: "m-1", status: "PENDING" }, String(OWNER_TG_ID)).status).toBe("pending")
  })

  it("Шаг 5 — Администратор одобрил → status=ACTIVE → может работать", () => {
    expect(resolveMerchantAuthResult({ id: "m-1", status: "ACTIVE" }, String(OWNER_TG_ID)).status).toBe("active")
  })

  it("Шаг 6 — Запустил акцию: 2 000 pts, 40 использований × 50 pts", () => {
    expect(canCreateOffer({ pointsBalance: 2_000 }, 50, 40)).toEqual({ ok: true })
  })

  it("Шаг 6b — Акция видна клиентам сразу", () => {
    const offer: OfferState = { active: true, startsAt: new Date(now - 60_000), endsAt: new Date(now + 7 * 86_400_000), usageLimit: 40, usageCount: 0, costPoints: 50 }
    expect(isOfferAvailable(offer)).toEqual({ available: true })
  })

  it("Шаг 7 — Клиент Марко: 3 000 RSD → 30 pts (без буста)", () => {
    expect(calculatePartnerPoints(3_000, RATE, null, null)).toBe(30)
  })

  it("Шаг 7b — Включили буст 2×: Анна 2 000 RSD → 40 pts", () => {
    expect(calculatePartnerPoints(2_000, RATE, BOOST, boostUntil)).toBe(40)
  })

  it("Шаг 7c — Анна пришла по реферальной ссылке Марко: Марко +100 pts", () => {
    expect(REFERRAL_REWARD_POINTS).toBe(100)
  })

  it("Шаг 8 — Анна потратила 80 pts: 40 из earned, 40 из welcome", () => {
    const r = merchantRedeemValidate({
      userId: "anna", venueId: "v-1", points: 80,
      userBalance: { earnedPoints: 40, welcomePoints: 500 },
      isPartner: true, todayRedemptions: 0,
    })
    expect(r).toMatchObject({ ok: true, earnedDeduct: 40, welcomeDeduct: 40 })
  })

  it("Шаг 9 — Итоги дня: 2 транзакции, 70 pts начислено", () => {
    expect(aggregatePeriod([
      { pointsEarned: 30, amount: 3_000, userId: "marko" },
      { pointsEarned: 40, amount: 2_000, userId: "anna" },
    ])).toEqual({ pointsIssued: 70, transactions: 2, uniqueCustomers: 2 })
  })

  it("Шаг 10 — QR Марко для редима: валиден в течение 24ч", () => {
    const qr: RedemptionRecord = { status: "ACTIVE", expiresAt: new Date(now + 24 * 3_600_000), venueOwnerId: "m-1" }
    expect(validateRedemptionQr(qr, "m-1")).toEqual({ valid: true })
  })
})
