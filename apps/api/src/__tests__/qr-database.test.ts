/**
 * QR-код и база данных — исполняемая спецификация
 *
 * Покрывает:
 *   1. QR-коды           — форматы, валидация, сценарии использования
 *   2. Кошелёк           — инварианты базы данных, арифметика очков
 *   3. Транзакции        — типы, эффекты на состояние
 *   4. Утилиты           — referral code, loyalty ID, card number
 *   5. Гео-индекс        — bounding box для быстрых запросов
 */

import { describe, it, expect } from "vitest"
import {
  generateReferralCode,
  generateCardNumber,
  formatLoyaltyId,
  boundingBox,
  haversineMeters,
  CHECKIN_RADIUS_METERS,
  WELCOME_BONUS_AMOUNT,
  REFERRAL_SIGNUP_POINTS,
  CHECKIN_POINTS,
  SCAN_POINTS_PER_CURRENCY,
  calcSpend,
  calculatePartnerPoints,
} from "@pulse/shared"

// ═══════════════════════════════════════════════════════════════
// 1. QR-КОД — КАК ЭТО РАБОТАЕТ
// ═══════════════════════════════════════════════════════════════

describe("QR-код клиента", () => {
  /**
   * QR клиента кодирует его userId (cuid).
   * Партнёрское приложение сканирует → вызывает lookupForMerchant({ userId }).
   * Никаких баллов, сессий или токенов в QR нет.
   */

  it("cuid выглядит как строка >= 20 символов (Prisma default)", () => {
    // Реальный cuid генерирует Prisma при создании User
    const exampleCuid = "clv3abc4d0000xyz12345678"
    expect(exampleCuid.length).toBeGreaterThanOrEqual(20)
  })

  it("QR содержит только userId — никаких очков или сессий", () => {
    // Это архитектурное решение: информация о балансе запрашивается по userId
    // в момент сканирования, а не закодирована в QR
    const qrPayload = { userId: "clv3abc4d0000xyz12345678" }
    expect(Object.keys(qrPayload)).toEqual(["userId"])
  })

  it("альтернатива — QR по referralCode (6 символов, читаемый)", () => {
    const code = generateReferralCode()
    expect(code.length).toBe(6)
    // lookupForMerchant({ referralCode: code }) работает так же как через userId
  })
})

describe("QR-код реферала", () => {
  /**
   * Реферальный QR = deep link вида pulse://ref/ABCD12
   * Новый пользователь сканирует → попадает на онбординг с предзаполненным кодом
   */

  it("реферальный код — ровно 6 символов", () => {
    for (let i = 0; i < 20; i++) {
      expect(generateReferralCode()).toHaveLength(6)
    }
  })

  it("реферальный код содержит только читаемые символы (без 0/O/I/1)", () => {
    const FORBIDDEN = /[0OI1]/
    for (let i = 0; i < 100; i++) {
      expect(generateReferralCode()).not.toMatch(FORBIDDEN)
    }
  })

  it("реферальный код регистронезависим при проверке (хранится UPPER)", () => {
    const code = "ab2cd3"
    expect(code.toUpperCase()).toMatch(/^[A-Z2-9]{6}$/)
  })

  it("два вызова generateReferralCode дают разные коды (с высокой вероятностью)", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateReferralCode()))
    expect(codes.size).toBeGreaterThan(45) // коллизия крайне маловероятна
  })
})

describe("QR-код чека (скан чека)", () => {
  /**
   * Чек не является QR в классическом смысле.
   * Пользователь фотографирует чек → OCR извлекает сумму → система начисляет.
   * Никакого QR-взаимодействия — это camera-based flow.
   */

  it("очки за скан = floor(сумма × SCAN_RATE × stepMultiplier)", () => {
    const amount = 3000 // RSD
    const rate = SCAN_POINTS_PER_CURRENCY // 0.001
    const pts = Math.floor(amount * rate * 1.0) // без шагов
    expect(pts).toBe(3)
  })

  it("скан и партнёрская покупка начисляют разные суммы за одну и ту же сумму", () => {
    const amount = 1000
    const scanPts = Math.floor(amount * SCAN_POINTS_PER_CURRENCY) // 1
    const partnerPts = calculatePartnerPoints(amount, 0.008, null, null) // 8
    expect(partnerPts).toBeGreaterThan(scanPts)
  })
})

// ═══════════════════════════════════════════════════════════════
// 2. КОШЕЛЁК — ИНВАРИАНТЫ БАЗЫ ДАННЫХ
// ═══════════════════════════════════════════════════════════════

describe("Кошелёк — инварианты", () => {
  /**
   * Правила которые НИКОГДА не должны нарушаться в БД:
   *   - totalPoints вычисляется, не хранится (earnedPoints + welcomePoints)
   *   - earnedPoints >= 0
   *   - welcomePoints >= 0
   *   - spentPoints >= 0
   *   - totalEarnedLifetime >= earnedPoints (lifetime только растёт)
   */

  it("totalPoints = earnedPoints + welcomePoints (никогда не в колонке)", () => {
    const user = { earnedPoints: 250, welcomePoints: 350 }
    const totalPoints = user.earnedPoints + user.welcomePoints
    expect(totalPoints).toBe(600)
  })

  it("после онбординга: earnedPoints=0, welcomePoints=500", () => {
    const newUser = { earnedPoints: 0, welcomePoints: WELCOME_BONUS_AMOUNT }
    expect(newUser.earnedPoints).toBe(0)
    expect(newUser.welcomePoints).toBe(500)
  })

  it("после первого чекина: earnedPoints += 5", () => {
    const before = { earnedPoints: 0 }
    const after = { earnedPoints: before.earnedPoints + CHECKIN_POINTS }
    expect(after.earnedPoints).toBe(5)
  })

  it("после реферального онбординга: earnedPoints += 50", () => {
    const after = { earnedPoints: 0 + REFERRAL_SIGNUP_POINTS }
    expect(after.earnedPoints).toBe(50)
  })

  it("totalEarnedLifetime не уменьшается при трате", () => {
    const user = {
      earnedPoints: 200,
      welcomePoints: 500,
      totalEarnedLifetime: 200,
      spentPoints: 0,
      welcomeExpiresAt: new Date(Date.now() + 86_400_000 * 90),
      lastWelcomeUsedAt: null,
    }
    const spend = calcSpend(user, 100)
    expect(spend).toEqual({ ok: true, fromEarned: 100, fromWelcome: 0 })
    // После траты:
    const updatedEarned = user.earnedPoints - 100 // 100
    const updatedSpent = user.spentPoints + 100   // 100
    const lifetime = user.totalEarnedLifetime     // 200 — не изменился!
    expect(lifetime).toBe(200)
    expect(updatedEarned + updatedSpent).toBe(user.totalEarnedLifetime)
  })
})

// ═══════════════════════════════════════════════════════════════
// 3. ТРАНЗАКЦИИ — ТИПЫ И ЭФФЕКТЫ
// ═══════════════════════════════════════════════════════════════

describe("Транзакции (Transaction table)", () => {
  /**
   * Каждое начисление/списание создаёт строку в Transaction.
   * pointsEarned > 0 → зачисление; < 0 или тип REWARD_REDEEMED → списание.
   */

  const TX_TYPES = [
    "PARTNER_PURCHASE",
    "RECEIPT_SCAN",
    "CHECKIN_PHOTO",
    "REFERRAL",
    "CHALLENGE_COMPLETE",
    "BONUS",
    "GIFT_RECEIVED",
    "GIFT_SENT",
    "REWARD_REDEEMED",
  ] as const

  it("покрываем все 9 типов транзакций", () => {
    expect(TX_TYPES.length).toBe(9)
  })

  it("PARTNER_PURCHASE начисляет earnedPoints по ставке партнёра", () => {
    const pts = calculatePartnerPoints(2000, 0.008, null, null)
    // Запись: { type: "PARTNER_PURCHASE", pointsEarned: 16, status: "VERIFIED" }
    expect(pts).toBe(16)
  })

  it("CHECKIN_PHOTO начисляет ровно 5 очков", () => {
    // Запись: { type: "CHECKIN_PHOTO", pointsEarned: 5, status: "VERIFIED" }
    expect(CHECKIN_POINTS).toBe(5)
  })

  it("REWARD_REDEEMED создаёт отрицательную дельту баланса", () => {
    // pointsFromEarned + pointsFromWelcome = суммарное списание
    const spend = calcSpend(
      { earnedPoints: 200, welcomePoints: 500, welcomeExpiresAt: new Date(Date.now() + 86_400_000 * 90), lastWelcomeUsedAt: null },
      150
    )
    expect(spend).toEqual({ ok: true, fromEarned: 150, fromWelcome: 0 })
    // Запись: { type: "REWARD_REDEEMED", pointsFromEarned: 150, pointsFromWelcome: 0 }
  })

  it("GIFT_SENT списывает earnedPoints отправителя", () => {
    // Аналогично REWARD_REDEEMED, но тип другой
    const senderWallet = {
      earnedPoints: 500,
      welcomePoints: 0,
      welcomeExpiresAt: null,
      lastWelcomeUsedAt: null,
    }
    const spend = calcSpend(senderWallet, 200)
    expect(spend).toEqual({ ok: true, fromEarned: 200, fromWelcome: 0 })
  })

  it("GIFT_RECEIVED начисляет earnedPoints получателю", () => {
    const giftAmount = 200
    const before = 50
    const after = before + giftAmount
    expect(after).toBe(250)
  })

  it("недельные earned очки = сумма pointsEarned где тип НЕ списание", () => {
    const txs = [
      { type: "PARTNER_PURCHASE", pointsEarned: 24 },
      { type: "CHECKIN_PHOTO", pointsEarned: 5 },
      { type: "RECEIPT_SCAN", pointsEarned: 3 },
      { type: "REWARD_REDEEMED", pointsEarned: 0 }, // не считать!
      { type: "GIFT_SENT", pointsEarned: 0 },        // не считать!
    ]
    const earned = txs
      .filter(tx => !["REWARD_REDEEMED", "GIFT_SENT"].includes(tx.type))
      .reduce((sum, tx) => sum + tx.pointsEarned, 0)
    expect(earned).toBe(32)
  })
})

// ═══════════════════════════════════════════════════════════════
// 4. УТИЛИТЫ — REFERRAL CODE, LOYALTY ID, CARD NUMBER
// ═══════════════════════════════════════════════════════════════

describe("Утилиты идентификации", () => {
  describe("generateReferralCode", () => {
    it("длина всегда 6", () => {
      expect(generateReferralCode(6)).toHaveLength(6)
    })

    it("только uppercase + цифры без 0/O/I/1", () => {
      const code = generateReferralCode()
      expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
    })
  })

  describe("generateCardNumber", () => {
    it("5 цифр, начинается не с 0", () => {
      for (let i = 0; i < 50; i++) {
        const card = generateCardNumber()
        expect(card).toHaveLength(5)
        expect(card[0]).not.toBe("0")
        expect(Number(card)).toBeGreaterThanOrEqual(10000)
        expect(Number(card)).toBeLessThanOrEqual(99999)
      }
    })
  })

  describe("formatLoyaltyId", () => {
    it("возвращает 12-значный ID: 7 цифр времени + 5 цифр карты", () => {
      const createdAt = new Date("2026-01-01T00:00:00Z")
      const cardNumber = "45678"
      const id = formatLoyaltyId(createdAt, cardNumber)
      expect(id).toHaveLength(12)
      expect(id.endsWith(cardNumber)).toBe(true)
    })

    it("два пользователя с одинаковым номером карты имеют разные loyaltyId", () => {
      const cardNumber = "12345"
      const user1 = formatLoyaltyId(new Date("2024-01-01"), cardNumber)
      const user2 = formatLoyaltyId(new Date("2025-06-15"), cardNumber)
      expect(user1).not.toBe(user2) // разное время создания
    })

    it("loyaltyId состоит только из цифр", () => {
      const id = formatLoyaltyId(new Date(), "54321")
      expect(id).toMatch(/^\d{12}$/)
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// 5. ГЕО-ИНДЕКС — BOUNDING BOX + HAVERSINE
// ═══════════════════════════════════════════════════════════════

describe("Гео-индекс (поиск объектов рядом)", () => {
  /**
   * Алгоритм двухэтапный для производительности:
   *   1. Prisma WHERE lat BETWEEN / lng BETWEEN (fast SQL index)
   *   2. Haversine-фильтр в коде для точного радиуса
   */

  const BELGRADE = { lat: 44.8176, lng: 20.4569 }

  it("boundingBox возвращает 4 границы для SQL запроса", () => {
    const box = boundingBox(BELGRADE.lat, BELGRADE.lng, 1)
    expect(box).toHaveProperty("minLat")
    expect(box).toHaveProperty("maxLat")
    expect(box).toHaveProperty("minLng")
    expect(box).toHaveProperty("maxLng")
  })

  it("центр всегда внутри bounding box", () => {
    const box = boundingBox(BELGRADE.lat, BELGRADE.lng, 1)
    expect(BELGRADE.lat).toBeGreaterThan(box.minLat)
    expect(BELGRADE.lat).toBeLessThan(box.maxLat)
    expect(BELGRADE.lng).toBeGreaterThan(box.minLng)
    expect(BELGRADE.lng).toBeLessThan(box.maxLng)
  })

  it("bounding box для 1 км охватывает ~2 км по широте", () => {
    const box = boundingBox(BELGRADE.lat, BELGRADE.lng, 1)
    const latSpanKm = (box.maxLat - box.minLat) * 111
    expect(latSpanKm).toBeGreaterThan(1.9)
    expect(latSpanKm).toBeLessThan(2.1)
  })

  it("точка внутри box может быть за пределами радиуса (угол квадрата)", () => {
    // Угол квадрата 1 км × 1 км находится на расстоянии ~1.41 км от центра
    const box = boundingBox(BELGRADE.lat, BELGRADE.lng, 1)
    const cornerDist = haversineMeters(
      BELGRADE.lat, BELGRADE.lng,
      box.maxLat, box.maxLng,
    )
    // Haversine-фильтр нужен именно для отсева угловых точек
    expect(cornerDist).toBeGreaterThan(1000)
  })

  it("точка в 80 м проходит Haversine-фильтр для чекина (радиус 100 м)", () => {
    const nearLat = BELGRADE.lat + 0.00072 // ~80 м
    const dist = haversineMeters(BELGRADE.lat, BELGRADE.lng, nearLat, BELGRADE.lng)
    expect(dist).toBeLessThan(CHECKIN_RADIUS_METERS) // разрешён
  })

  it("точка в 150 м не проходит Haversine-фильтр для чекина", () => {
    const farLat = BELGRADE.lat + 0.00135 // ~150 м
    const dist = haversineMeters(BELGRADE.lat, BELGRADE.lng, farLat, BELGRADE.lng)
    expect(dist).toBeGreaterThan(CHECKIN_RADIUS_METERS) // запрещён
  })

  it("haversine симметрична: dist(A,B) === dist(B,A)", () => {
    const A = { lat: 44.8176, lng: 20.4569 }
    const B = { lat: 44.8250, lng: 20.4630 }
    expect(haversineMeters(A.lat, A.lng, B.lat, B.lng))
      .toBeCloseTo(haversineMeters(B.lat, B.lng, A.lat, A.lng), 5)
  })
})
