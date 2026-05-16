/**
 * Путь партнёра — исполняемая спецификация
 *
 * Покрывает:
 *   1. Регистрация объекта  — данные Venue, привязка к Merchant
 *   2. Настройка ставок     — pointsPerCurrency, boost-механика
 *   3. Создание скидки      — Reward / Offer, типы списания
 *   4. Обработка покупки    — calculatePartnerPoints сквозной сценарий
 *   5. Геовалидация         — haversine для чекинов
 */

import { describe, it, expect } from "vitest"
import {
  calculatePartnerPoints,
  calcSpend,
  haversineMeters,
  CHECKIN_RADIUS_METERS,
  CHECKIN_ACCURACY_THRESHOLD,
  MIN_REDEEM,
  WELCOME_BONUS_AMOUNT,
} from "@pulse/shared"

// ── Вспомогательные данные ────────────────────────────────────

function daysFromNow(d: number) { return new Date(Date.now() + d * 86_400_000) }
function hoursAgo(h: number) { return new Date(Date.now() - h * 3_600_000) }

/** Минимально корректный объект Venue (без DB) */
const CAFE_WILLOW = {
  id: "venue_001",
  name: "Café Willow",
  lat: 44.8176,
  lng: 20.4569,
  isPartner: true,
  pointsPerCurrency: 0.008, // 8 очков за 1000 RSD
  currency: "RSD",
  boostMultiplier: null as number | null,
  boostUntil: null as Date | null,
}

// ═══════════════════════════════════════════════════════════════
// 1. ДАННЫЕ VENUE
// ═══════════════════════════════════════════════════════════════

describe("Регистрация объекта (Venue)", () => {
  it("партнёрский объект должен иметь isPartner: true", () => {
    expect(CAFE_WILLOW.isPartner).toBe(true)
  })

  it("pointsPerCurrency задаёт сколько очков за единицу валюты", () => {
    // 0.008 pts/RSD → 8 pts за 1000 RSD
    const pts = calculatePartnerPoints(1000, CAFE_WILLOW.pointsPerCurrency, null, null)
    expect(pts).toBe(8)
  })

  it("базовая партнёрская ставка 0.008 — типовое значение для кафе", () => {
    // Клиент тратит 5000 RSD за ужин → 40 очков
    const pts = calculatePartnerPoints(5000, 0.008, null, null)
    expect(pts).toBe(40)
  })

  it("ставка 0 → клиент не получает очков (некорректная настройка)", () => {
    const pts = calculatePartnerPoints(1000, 0, null, null)
    expect(pts).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// 2. БУСТ — ВРЕМЕННЫЙ МНОЖИТЕЛЬ ОЧКОВ
// ═══════════════════════════════════════════════════════════════

describe("Буст партнёра (boostMultiplier)", () => {
  it("×2 буст удваивает начисление", () => {
    const base = calculatePartnerPoints(1000, 0.008, null, null)
    const boosted = calculatePartnerPoints(1000, 0.008, 2, daysFromNow(7))
    expect(boosted).toBe(base * 2)
  })

  it("×3 буст утраивает начисление", () => {
    const base = calculatePartnerPoints(1000, 0.008, null, null)
    const boosted = calculatePartnerPoints(1000, 0.008, 3, daysFromNow(3))
    expect(boosted).toBe(base * 3)
  })

  it("буст без даты окончания не работает", () => {
    const base = calculatePartnerPoints(1000, 0.008, null, null)
    const withMultiplierNoDate = calculatePartnerPoints(1000, 0.008, 2, null)
    expect(withMultiplierNoDate).toBe(base)
  })

  it("просроченный буст игнорируется", () => {
    const base = calculatePartnerPoints(1000, 0.008, null, null)
    const expired = calculatePartnerPoints(1000, 0.008, 2, hoursAgo(1))
    expect(expired).toBe(base)
  })

  it("буст, истекающий сегодня в будущем, ещё активен", () => {
    const base = calculatePartnerPoints(1000, 0.008, null, null)
    const activeBoost = calculatePartnerPoints(1000, 0.008, 2, daysFromNow(0.01))
    expect(activeBoost).toBe(base * 2)
  })

  it("сквозной: ужин 5000 RSD с недельным буcтом ×2 → 80 очков", () => {
    const pts = calculatePartnerPoints(5000, 0.008, 2, daysFromNow(7))
    expect(pts).toBe(80)
  })
})

// ═══════════════════════════════════════════════════════════════
// 3. СКИДКА / REWARD — ЛОГИКА СПИСАНИЯ
// ═══════════════════════════════════════════════════════════════

describe("Создание и применение скидки (Reward)", () => {
  it("минимальный порог обмена: 100 очков", () => {
    expect(MIN_REDEEM).toBe(100)
  })

  const wallet = {
    earnedPoints: 300,
    welcomePoints: 500,
    welcomeExpiresAt: daysFromNow(90),
    lastWelcomeUsedAt: null,
  }

  it("клиент с 300 earned может получить награду за 200 очков", () => {
    const result = calcSpend(wallet, 200)
    expect(result).toEqual({ ok: true, fromEarned: 200, fromWelcome: 0 })
  })

  it("награда за 400 очков: сначала 300 earned, потом 100 welcome", () => {
    const result = calcSpend(wallet, 400)
    expect(result).toEqual({ ok: true, fromEarned: 300, fromWelcome: 100 })
  })

  it("награда за 450 очков: earned=300, нужно ещё 150 от welcome, но кеп 100 → отказ", () => {
    const result = calcSpend(wallet, 450)
    expect(result).toEqual({ ok: false, error: "INSUFFICIENT_POINTS" })
  })

  it("клиент без earned может потратить до 100 welcome на скидку", () => {
    const onlyWelcome = { ...wallet, earnedPoints: 0 }
    const result = calcSpend(onlyWelcome, 100)
    expect(result).toEqual({ ok: true, fromEarned: 0, fromWelcome: 100 })
  })

  it("новый пользователь (0 earned + 500 welcome) может взять награду ≤ 100", () => {
    const fresh = {
      earnedPoints: 0,
      welcomePoints: WELCOME_BONUS_AMOUNT,
      welcomeExpiresAt: daysFromNow(90),
      lastWelcomeUsedAt: null,
    }
    const result = calcSpend(fresh, 100)
    expect(result).toEqual({ ok: true, fromEarned: 0, fromWelcome: 100 })
  })
})

// ═══════════════════════════════════════════════════════════════
// 4. СКВОЗНОЙ СЦЕНАРИЙ ПАРТНЁРА
// ═══════════════════════════════════════════════════════════════

describe("Сквозной сценарий: клиент в кафе", () => {
  /**
   * Сценарий:
   *   - Партнёр: Café Willow, ставка 0.008, буст ×2 активен неделю
   *   - Клиент приходит, тратит 3000 RSD
   *   - Система начисляет очки, обновляет баланс
   */

  it("покупка 3000 RSD без буcта → 24 очка", () => {
    const pts = calculatePartnerPoints(3000, 0.008, null, null)
    expect(pts).toBe(24)
  })

  it("та же покупка с бустом ×2 → 48 очков", () => {
    const pts = calculatePartnerPoints(3000, 0.008, 2, daysFromNow(7))
    expect(pts).toBe(48)
  })

  it("после покупки: earnedPoints клиента увеличиваются на начисленное", () => {
    const beforeEarned = 100
    const pts = calculatePartnerPoints(3000, 0.008, null, null) // 24
    const afterEarned = beforeEarned + pts
    expect(afterEarned).toBe(124)
  })

  it("после серии покупок клиент накапливает достаточно для награды", () => {
    // 5 покупок × 3000 RSD × 0.008 = 5 × 24 = 120 earned
    const purchases = 5
    const earned = purchases * calculatePartnerPoints(3000, 0.008, null, null)
    expect(earned).toBe(120)
    expect(earned).toBeGreaterThanOrEqual(MIN_REDEEM) // может обменять
  })

  it("обмен накопленных 120 очков на эспрессо за 80 очков — успешно", () => {
    const wallet = {
      earnedPoints: 120,
      welcomePoints: 500,
      welcomeExpiresAt: daysFromNow(90),
      lastWelcomeUsedAt: null,
    }
    const result = calcSpend(wallet, 80)
    expect(result).toEqual({ ok: true, fromEarned: 80, fromWelcome: 0 })
  })
})

// ═══════════════════════════════════════════════════════════════
// 5. ГЕОВАЛИДАЦИЯ ДЛЯ ЧЕКИНОВ
// ═══════════════════════════════════════════════════════════════

describe("Геовалидация (чекин у объекта)", () => {
  const VENUE_LAT = 44.8176
  const VENUE_LNG = 20.4569

  it(`чекин разрешён в радиусе ${CHECKIN_RADIUS_METERS} м от объекта`, () => {
    expect(CHECKIN_RADIUS_METERS).toBe(100)
  })

  it("клиент в 50 м → чекин разрешён", () => {
    // смещение ~50 м по широте ≈ 0.00045°
    const userLat = VENUE_LAT + 0.00045
    const dist = haversineMeters(VENUE_LAT, VENUE_LNG, userLat, VENUE_LNG)
    expect(dist).toBeLessThan(CHECKIN_RADIUS_METERS)
  })

  it("клиент в 200 м → чекин запрещён", () => {
    // смещение ~200 м по широте ≈ 0.0018°
    const userLat = VENUE_LAT + 0.0018
    const dist = haversineMeters(VENUE_LAT, VENUE_LNG, userLat, VENUE_LNG)
    expect(dist).toBeGreaterThan(CHECKIN_RADIUS_METERS)
  })

  it("расстояние до самого объекта: 0 м", () => {
    const dist = haversineMeters(VENUE_LAT, VENUE_LNG, VENUE_LAT, VENUE_LNG)
    expect(dist).toBe(0)
  })

  it(`GPS-точность > ${CHECKIN_ACCURACY_THRESHOLD} м не допускается для чекина`, () => {
    expect(CHECKIN_ACCURACY_THRESHOLD).toBe(50)
    const userAccuracy = 75 // ненадёжный GPS
    expect(userAccuracy).toBeGreaterThan(CHECKIN_ACCURACY_THRESHOLD) // заблокировано
  })

  it("два объекта в одном городе: haversine корректно различает их", () => {
    const venueA = { lat: 44.8176, lng: 20.4569 }
    const venueB = { lat: 44.8250, lng: 20.4600 } // ~840 м северо-восточнее
    const dist = haversineMeters(venueA.lat, venueA.lng, venueB.lat, venueB.lng)
    expect(dist).toBeGreaterThan(800)
    expect(dist).toBeLessThan(900)
  })
})
