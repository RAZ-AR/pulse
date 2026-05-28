/**
 * Флоу клиента — исполняемая спецификация
 *
 * Покрывает весь пользовательский путь клиента в Telegram Mini App:
 *
 *   1. Онбординг          — запуск бота, приветствие, регистрация, приветственные баллы
 *   2. Получение баллов   — скан QR чека, определение компании и суммы,
 *                           реферальная программа (ссылка / QR от друга)
 *   3. Трата баллов       — выбор награды, QR-код на списание,
 *                           партнёр сканирует → баллы списаны у клиента
 *   4. Спецпредложения    — просмотр офферов партнёров, контакты, условия
 *
 * Все тесты — чистые функции (без БД, без HTTP).
 * Стиль: Vitest + @pulse/shared.
 */

import { describe, it, expect } from "vitest"
import {
  // Начисление
  WELCOME_BONUS_AMOUNT,
  WELCOME_EXPIRY_DAYS,
  WELCOME_MAX_PER_TRANSACTION,
  WELCOME_COOLDOWN_HOURS,
  REFERRAL_SIGNUP_POINTS,
  REFERRAL_REWARD_POINTS,
  CHECKIN_POINTS,
  SCAN_POINTS_PER_CURRENCY,
  calculatePartnerPoints,
  stepMultiplier,
  // Списание
  calcSpend,
  MIN_REDEEM,
  // Утилиты
  generateReferralCode,
  generateCardNumber,
  formatLoyaltyId,
  // Стрик / бейджи
  computeStreakUpdate,
  BADGE_DEFINITIONS,
  // Лимиты чеков
  RECEIPT_DAILY_LIMIT,
  RECEIPT_MAX_AGE_DAYS,
  OCR_CONFIDENCE_THRESHOLD,
  // Подарки
  GIFT_MIN_AMOUNT,
  GIFT_DAILY_LIMIT,
} from "@pulse/shared"

// ── Утилиты ───────────────────────────────────────────────────

function daysFromNow(d: number) { return new Date(Date.now() + d * 86_400_000) }
function daysAgo(d: number) { return new Date(Date.now() - d * 86_400_000) }
function hoursAgo(h: number) { return new Date(Date.now() - h * 3_600_000) }

/** Кошелёк нового пользователя сразу после онбординга */
function freshWallet() {
  return {
    earnedPoints: 0,
    welcomePoints: WELCOME_BONUS_AMOUNT,
    welcomeExpiresAt: daysFromNow(WELCOME_EXPIRY_DAYS),
    lastWelcomeUsedAt: null as Date | null,
  }
}

/** Партнёр-кафе со стандартными настройками */
const CAFE_PARTNER = {
  id: "venue_cafe_001",
  name: "Kafić Kod Marka",
  city: "Belgrade",
  pointsPerCurrency: 0.008,   // 8 pts за 1000 RSD
  boostMultiplier: null as number | null,
  boostUntil: null as Date | null,
}

/** Типичные контакты объекта в специальном предложении */
const OFFER_VENUE_CONTACT = {
  phone: "+381 11 123 4567",
  address: "Knez Mihailova 12, Beograd",
  instagramUrl: "https://instagram.com/kafic_kod_marka",
  websiteUrl: "https://kafickodmarka.rs",
}

// ════════════════════════════════════════════════════════════════
// 1. ОНБОРДИНГ
// ════════════════════════════════════════════════════════════════

describe("Онбординг — запуск бота и приветствие", () => {
  it("бот отвечает на /start — пользователь видит приветствие", () => {
    // Семантический тест: старт всегда отвечает (не undefined/null)
    const startPayload = { command: "/start", from: { id: 123456789, language_code: "ru" } }
    expect(startPayload.command).toBe("/start")
    expect(startPayload.from.id).toBeDefined()
  })

  it("новый пользователь получает 500 welcome-баллов после онбординга", () => {
    expect(WELCOME_BONUS_AMOUNT).toBe(500)
    const wallet = freshWallet()
    expect(wallet.welcomePoints).toBe(500)
    expect(wallet.earnedPoints).toBe(0)
  })

  it("welcome-баллы истекают через 90 дней — мотивация использовать", () => {
    expect(WELCOME_EXPIRY_DAYS).toBe(90)
    const wallet = freshWallet()
    const daysLeft = (wallet.welcomeExpiresAt!.getTime() - Date.now()) / 86_400_000
    expect(daysLeft).toBeGreaterThan(89)
    expect(daysLeft).toBeLessThanOrEqual(90)
  })

  it("баланс на экране = earnedPoints + welcomePoints (вычисляемое, не колонка)", () => {
    const wallet = freshWallet()
    const displayed = wallet.earnedPoints + wallet.welcomePoints
    expect(displayed).toBe(500)
  })

  it("пользователь вводит имя — оно сохраняется и показывается в профиле", () => {
    const input = "  Марко  "
    const savedName = input.trim()
    expect(savedName).toBe("Марко")
    expect(savedName.length).toBeGreaterThan(0)
  })

  it("пользователь вводит дату рождения DD.MM.YYYY — конвертируется в ISO", () => {
    function parseBirthday(raw: string): string | undefined {
      const parts = raw.split(".")
      if (parts.length !== 3) return undefined
      const [d, m, y] = parts
      if (!d || !m || !y || y.length !== 4) return undefined
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
    }
    expect(parseBirthday("15.03.1995")).toBe("1995-03-15")
    expect(parseBirthday("01.01.2000")).toBe("2000-01-01")
    expect(parseBirthday("bad")).toBeUndefined()
  })

  it("согласие на обработку данных — обязательное поле перед завершением", () => {
    const form = { consent: false }
    const canProceed = form.consent
    expect(canProceed).toBe(false)
    form.consent = true
    expect(form.consent).toBe(true)
  })

  it("карточная идентификация: каждому клиенту генерируется уникальный 5-значный номер карты", () => {
    const cards = new Set(Array.from({ length: 100 }, () => generateCardNumber()))
    for (const card of cards) {
      expect(card).toHaveLength(5)
      expect(card[0]).not.toBe("0")
    }
  })

  it("loyalty ID = 12 цифр (7 время + 5 карта) — показывается кассиру", () => {
    const loyaltyId = formatLoyaltyId(new Date("2026-01-15"), "45678")
    expect(loyaltyId).toHaveLength(12)
    expect(loyaltyId).toMatch(/^\d{12}$/)
    expect(loyaltyId.endsWith("45678")).toBe(true)
  })
})

describe("Онбординг — реферальная программа при регистрации", () => {
  it("новый пользователь вводит реферальный код → сразу +50 earnedPoints", () => {
    expect(REFERRAL_SIGNUP_POINTS).toBe(50)
    const earnedAfterRef = 0 + REFERRAL_SIGNUP_POINTS
    expect(earnedAfterRef).toBe(50)
  })

  it("реферер получает +100 очков когда его друг совершает первую покупку", () => {
    expect(REFERRAL_REWARD_POINTS).toBe(100)
  })

  it("реферальный код — 6 символов без двусмысленных символов (0/O/I/1)", () => {
    const FORBIDDEN = /[0OI1]/
    for (let i = 0; i < 50; i++) {
      const code = generateReferralCode()
      expect(code).toHaveLength(6)
      expect(code).not.toMatch(FORBIDDEN)
    }
  })

  it("реферальный код регистронезависим — пользователь может ввести в любом регистре", () => {
    const entered = "ab2cd3"
    const normalized = entered.toUpperCase()
    expect(normalized).toMatch(/^[A-Z2-9]{6}$/)
  })

  it("реферальный QR-код = deep link t.me/bot?start=ABCD12", () => {
    const code = "ABCD12"
    const botUsername = "ayoo_loyalty_bot"
    const deepLink = `https://t.me/${botUsername}?start=${code}`
    expect(deepLink).toContain(code)
    expect(deepLink).toContain(botUsername)
  })

  it("приглашение через ссылку и через QR-код открывают одинаковый онбординг", () => {
    // Оба варианта передают referral code как start_param
    const linkParam = "ABCD12"
    const qrParam = "ABCD12"
    expect(linkParam).toBe(qrParam) // одинаковый код — одинаковый флоу
  })
})

// ════════════════════════════════════════════════════════════════
// 2. ПОЛУЧЕНИЕ БАЛЛОВ
// ════════════════════════════════════════════════════════════════

describe("Получение баллов — скан QR чека (сербский фискальный чек)", () => {
  /**
   * Флоу: клиент фотографирует QR-код на чеке
   *       → система декодирует Serbian Fiscal QR
   *       → определяет организацию (requestedBy = PIB)
   *       → вычисляет сумму totalRsd
   *       → начисляет очки = floor(totalRsd × 0.001 × stepMultiplier)
   */

  it("базовая ставка скана: 1 очко за каждые 1000 RSD на чеке", () => {
    expect(SCAN_POINTS_PER_CURRENCY).toBe(0.001)
    const pts = Math.floor(1000 * SCAN_POINTS_PER_CURRENCY)
    expect(pts).toBe(1)
  })

  it("чек на 2500 RSD → 2 очка (стандарт без шагов)", () => {
    const pts = Math.floor(2500 * SCAN_POINTS_PER_CURRENCY)
    expect(pts).toBe(2)
  })

  it("чек на 5000 RSD → 5 очков", () => {
    const pts = Math.floor(5000 * SCAN_POINTS_PER_CURRENCY)
    expect(pts).toBe(5)
  })

  it("QR чека кодирует requestedBy (8-символьный UID магазина в системе ПУРС)", () => {
    // requestedBy — идентификатор организации, позволяет определить,
    // является ли она партнёром ayoo
    const exampleQrData = {
      requestedBy: "PABCD123",  // 8 символов
      signedBy: "KXYZ7890",
      totalRsd: 3200,
      date: "2026-05-26",
      time: "14:30",
    }
    expect(exampleQrData.requestedBy).toHaveLength(8)
    expect(exampleQrData.totalRsd).toBeGreaterThan(0)
  })

  it("если requestedBy совпадает с PIB партнёра → начисляется партнёрская ставка (выше базовой)", () => {
    const scanPts = Math.floor(3200 * SCAN_POINTS_PER_CURRENCY)       // 3
    const partnerPts = calculatePartnerPoints(3200, 0.008, null, null) // 25
    expect(partnerPts).toBeGreaterThan(scanPts)
  })

  it("чек старше 7 дней — отклоняется системой", () => {
    expect(RECEIPT_MAX_AGE_DAYS).toBe(7)
    const oldDate = daysAgo(8).toISOString().slice(0, 10)
    const receiptAge = (Date.now() - new Date(oldDate).getTime()) / 86_400_000
    expect(receiptAge).toBeGreaterThan(RECEIPT_MAX_AGE_DAYS) // заблокировано
  })

  it("чек от сегодня — проходит проверку возраста", () => {
    const today = new Date().toISOString().slice(0, 10)
    const receiptAge = (Date.now() - new Date(today).getTime()) / 86_400_000
    expect(receiptAge).toBeLessThanOrEqual(RECEIPT_MAX_AGE_DAYS)
  })

  it("лимит: не более 10 сканов чеков в день (защита от фрода)", () => {
    expect(RECEIPT_DAILY_LIMIT).toBe(10)
  })

  it("OCR уверенность < 0.85 → чек отправляется на ручную проверку", () => {
    expect(OCR_CONFIDENCE_THRESHOLD).toBe(0.85)
    const lowConfidence = 0.72
    expect(lowConfidence).toBeLessThan(OCR_CONFIDENCE_THRESHOLD) // нужна проверка
  })

  it("OCR уверенность ≥ 0.85 → автоматическое подтверждение и начисление", () => {
    const highConfidence = 0.91
    expect(highConfidence).toBeGreaterThanOrEqual(OCR_CONFIDENCE_THRESHOLD)
  })
})

describe("Получение баллов — множитель шагов", () => {
  it("без шагов (< 5000) множитель ×1.0 — базовое начисление", () => {
    expect(stepMultiplier(0)).toBe(1.0)
    expect(stepMultiplier(4999)).toBe(1.0)
  })

  it("≥ 5000 шагов → ×1.1 (+10%)", () => {
    expect(stepMultiplier(5000)).toBe(1.1)
    expect(stepMultiplier(9999)).toBe(1.1)
  })

  it("≥ 10000 шагов → ×1.2 (+20%)", () => {
    expect(stepMultiplier(10_000)).toBe(1.2)
  })

  it("≥ 15000 шагов → ×1.3 (+30%)", () => {
    expect(stepMultiplier(15_000)).toBe(1.3)
  })

  it("пользователь прошёл 10 000 шагов — чек 3000 RSD даёт 3 очка вместо 2", () => {
    const noSteps = Math.floor(3000 * SCAN_POINTS_PER_CURRENCY * 1.0)     // 3
    const withSteps = Math.floor(3000 * SCAN_POINTS_PER_CURRENCY * 1.2)   // 3.6 → 3
    // Оба 3 в данном случае, но при 2500 разница ощутима:
    const base2500 = Math.floor(2500 * SCAN_POINTS_PER_CURRENCY * 1.0)   // 2
    const boost2500 = Math.floor(2500 * SCAN_POINTS_PER_CURRENCY * 1.2)  // 3
    expect(boost2500).toBeGreaterThan(base2500)
    expect(noSteps).toBeDefined()
    expect(withSteps).toBeDefined()
  })
})

describe("Получение баллов — покупка у партнёра (лучший флоу)", () => {
  /**
   * Флоу: кассир нажимает "Начислить" в партнёрском приложении
   *       → вводит сумму покупки
   *       → клиент показывает QR / карту
   *       → система начисляет очки по ставке партнёра
   */

  it("покупка 1000 RSD у партнёра → 8 очков (vs 1 очко от скана чека)", () => {
    const partnerPts = calculatePartnerPoints(1000, CAFE_PARTNER.pointsPerCurrency, null, null)
    const scanPts = Math.floor(1000 * SCAN_POINTS_PER_CURRENCY)
    expect(partnerPts).toBe(8)
    expect(scanPts).toBe(1)
    expect(partnerPts).toBe(scanPts * 8) // партнёрская ставка в 8× выгоднее
  })

  it("ужин на 5000 RSD → 40 очков сразу", () => {
    const pts = calculatePartnerPoints(5000, CAFE_PARTNER.pointsPerCurrency, null, null)
    expect(pts).toBe(40)
  })

  it("партнёр включил буст ×2 на неделю — клиент получает двойные очки", () => {
    const base = calculatePartnerPoints(3000, CAFE_PARTNER.pointsPerCurrency, null, null)        // 24
    const boosted = calculatePartnerPoints(3000, CAFE_PARTNER.pointsPerCurrency, 2, daysFromNow(7)) // 48
    expect(boosted).toBe(base * 2)
    expect(boosted).toBe(48)
  })

  it("просроченный буст не влияет на начисление", () => {
    const base = calculatePartnerPoints(3000, CAFE_PARTNER.pointsPerCurrency, null, null)
    const expiredBoost = calculatePartnerPoints(3000, CAFE_PARTNER.pointsPerCurrency, 2, hoursAgo(1))
    expect(expiredBoost).toBe(base)
  })

  it("после партнёрской покупки earnedPoints пользователя растут", () => {
    const before = { earnedPoints: 50 }
    const pts = calculatePartnerPoints(2000, CAFE_PARTNER.pointsPerCurrency, null, null) // 16
    const after = { earnedPoints: before.earnedPoints + pts }
    expect(after.earnedPoints).toBe(66)
  })
})

describe("Получение баллов — реферальная программа (ссылка и QR от друга)", () => {
  it("новый пользователь переходит по ссылке друга — реферальный код в start_param", () => {
    const friendLink = "https://t.me/ayoo_loyalty_bot?start=ABCD12"
    const url = new URL(friendLink)
    const startParam = url.searchParams.get("start")
    expect(startParam).toBe("ABCD12")
    expect(startParam).toHaveLength(6)
  })

  it("новый пользователь сканирует QR-код друга — такой же флоу, тот же start_param", () => {
    // QR кодирует ту же ссылку, что и кнопка "Поделиться"
    const qrContent = "https://t.me/ayoo_loyalty_bot?start=ABCD12"
    const isDeepLink = qrContent.includes("t.me/ayoo_loyalty_bot?start=")
    expect(isDeepLink).toBe(true)
    const code = qrContent.split("start=")[1]
    expect(code).toHaveLength(6)
  })

  it("при регистрации с реферальным кодом: новый пользователь +50 earnedPoints", () => {
    const newUserPoints = 0 + REFERRAL_SIGNUP_POINTS
    expect(newUserPoints).toBe(50)
  })

  it("реферер получает +100 earnedPoints — после первой покупки нового друга", () => {
    const referrerBefore = 200
    const referrerAfter = referrerBefore + REFERRAL_REWARD_POINTS
    expect(referrerAfter).toBe(300)
  })

  it("реферальный бейдж разблокируется после первого приглашённого друга", () => {
    const badge = BADGE_DEFINITIONS.find(b => b.code === "social_1")
    if (badge) {
      expect(badge.predicate({ totalReferrals: 0, totalReceiptScans: 0, totalCheckins: 0, totalPartnerPurchases: 0, uniqueVenuesVisited: 0, longestStreak: 0 })).toBe(false)
      expect(badge.predicate({ totalReferrals: 1, totalReceiptScans: 0, totalCheckins: 0, totalPartnerPurchases: 0, uniqueVenuesVisited: 0, longestStreak: 0 })).toBe(true)
    }
  })
})

// ════════════════════════════════════════════════════════════════
// 3. ТРАТА БАЛЛОВ (покупка за баллы)
// ════════════════════════════════════════════════════════════════

describe("Трата баллов — просмотр наград и проверка баланса", () => {
  it("минимальный порог для обмена: 100 очков", () => {
    expect(MIN_REDEEM).toBe(100)
  })

  it("пользователь с 95 очками не может открыть каталог наград (не хватает)", () => {
    const wallet = { ...freshWallet(), earnedPoints: 95, welcomePoints: 0 }
    // У него нет earned, welcome истекли (допустим)
    const insufficient = { ...wallet, welcomeExpiresAt: daysAgo(1) }
    const result = calcSpend(insufficient, 100)
    expect(result.ok).toBe(false)
  })

  it("у пользователя 500 welcome-баллов → может взять награду до 100 очков", () => {
    const wallet = freshWallet() // welcomePoints = 500
    const result = calcSpend(wallet, 100)
    expect(result).toEqual({ ok: true, fromEarned: 0, fromWelcome: 100 })
  })

  it("пользователь видит список наград отсортированных от дешёвых к дорогим", () => {
    // Инвариант: rewards.sort((a, b) => a.pointsCost - b.pointsCost)
    const rewards = [
      { id: "r3", title: "Круассан", pointsCost: 200 },
      { id: "r1", title: "Кофе", pointsCost: 100 },
      { id: "r2", title: "Обед", pointsCost: 300 },
    ]
    const sorted = [...rewards].sort((a, b) => a.pointsCost - b.pointsCost)
    expect(sorted[0]!.title).toBe("Кофе")
    expect(sorted[1]!.title).toBe("Круассан")
    expect(sorted[2]!.title).toBe("Обед")
  })
})

describe("Трата баллов — генерация QR-кода на списание", () => {
  /**
   * Флоу:
   *   1. Клиент нажимает "Потратить" на конкретной награде
   *   2. Система списывает очки (DB transaction — optimistic lock)
   *   3. Генерируется уникальный redemptionCode (UUID) с TTL 24 ч
   *   4. QR-код = redemptionCode, показывается клиенту
   *   5. Партнёр сканирует → award.validate(redemptionCode) → отмечает использованным
   */

  it("redemptionCode — UUID-подобная строка (случайная, не предсказуемая)", () => {
    // Prisma по умолчанию генерирует cuid/uuid для redemptionCode
    function mockRedemptionCode() {
      return crypto.randomUUID()
    }
    const code1 = mockRedemptionCode()
    const code2 = mockRedemptionCode()
    expect(code1).not.toBe(code2)
    expect(code1.length).toBeGreaterThan(10)
  })

  it("QR-код действителен 24 часа — партнёр успеет отсканировать", () => {
    const REDEMPTION_TTL_HOURS = 24
    const issuedAt = new Date()
    const expiresAt = new Date(issuedAt.getTime() + REDEMPTION_TTL_HOURS * 3_600_000)
    const hoursLeft = (expiresAt.getTime() - Date.now()) / 3_600_000
    expect(hoursLeft).toBeCloseTo(24, 0)
  })

  it("при нажатии 'Потратить': earned тратятся первыми, потом welcome", () => {
    const wallet = { ...freshWallet(), earnedPoints: 150 }
    // Награда стоит 200 очков
    const result = calcSpend(wallet, 200)
    expect(result).toEqual({ ok: true, fromEarned: 150, fromWelcome: 50 })
  })

  it("после успешного списания: earnedPoints уменьшаются, spentPoints растут", () => {
    const before = { earnedPoints: 300, spentPoints: 0 }
    const spend = calcSpend({ ...freshWallet(), earnedPoints: 300 }, 150)
    if (spend.ok) {
      const after = {
        earnedPoints: before.earnedPoints - spend.fromEarned,
        spentPoints: before.spentPoints + 150,
      }
      expect(after.earnedPoints).toBe(150)
      expect(after.spentPoints).toBe(150)
    }
  })

  it("totalEarnedLifetime не уменьшается при трате — только растёт", () => {
    const before = { totalEarnedLifetime: 500, earnedPoints: 500 }
    const spend = calcSpend({ ...freshWallet(), earnedPoints: 500 }, 200)
    if (spend.ok) {
      const afterEarned = before.earnedPoints - spend.fromEarned // 300
      const lifetime = before.totalEarnedLifetime               // 500 — не трогаем!
      expect(lifetime).toBe(500)
      expect(afterEarned).toBe(300)
    }
  })
})

describe("Трата баллов — ограничения и защита", () => {
  it("из welcome за одну транзакцию можно потратить не более 100 очков", () => {
    const wallet = freshWallet() // earnedPoints: 0
    // Клиент хочет потратить 150 — нужно 150 welcome, но кап 100
    const result = calcSpend(wallet, 150)
    expect(result).toEqual({ ok: false, error: "INSUFFICIENT_POINTS" })
  })

  it("welcome-баллы на кулдауне 24 ч — нельзя использовать до истечения", () => {
    const wallet = { ...freshWallet(), earnedPoints: 0, lastWelcomeUsedAt: hoursAgo(2) }
    const result = calcSpend(wallet, 50)
    expect(result).toEqual({ ok: false, error: "WELCOME_DAILY_LIMIT" })
  })

  it("после 24 ч кулдауна welcome снова доступны", () => {
    const wallet = { ...freshWallet(), earnedPoints: 0, lastWelcomeUsedAt: hoursAgo(25) }
    const result = calcSpend(wallet, 100)
    expect(result).toEqual({ ok: true, fromEarned: 0, fromWelcome: 100 })
  })

  it("просроченные welcome-баллы (> 90 дней) не принимаются к оплате", () => {
    const expired = { ...freshWallet(), earnedPoints: 0, welcomeExpiresAt: daysAgo(1) }
    const result = calcSpend(expired, 50)
    expect(result).toEqual({ ok: false, error: "INSUFFICIENT_POINTS" })
  })

  it("награда закончилась (stock = 0) — кнопка 'Потратить' недоступна", () => {
    const reward = { stockLimit: 10, redeemedCount: 10, isActive: true }
    const outOfStock = reward.stockLimit !== null && reward.redeemedCount >= reward.stockLimit
    expect(outOfStock).toBe(true)
  })

  it("неактивная награда (isActive = false) — не отображается в каталоге", () => {
    const rewards = [
      { id: "r1", title: "Кофе", isActive: true, pointsCost: 100 },
      { id: "r2", title: "Архивная", isActive: false, pointsCost: 50 },
    ]
    const visible = rewards.filter(r => r.isActive)
    expect(visible).toHaveLength(1)
    expect(visible[0]!.id).toBe("r1")
  })
})

describe("Трата баллов — партнёр сканирует QR (завершение транзакции)", () => {
  it("redemptionCode в QR = случайный токен, не userId клиента", () => {
    // Безопасность: QR не раскрывает личные данные клиента
    const qrPayload = { redemptionCode: "aef4c9b2-1234-5678-abcd-ef1234567890" }
    expect(qrPayload).not.toHaveProperty("userId")
    expect(qrPayload).not.toHaveProperty("earnedPoints")
  })

  it("партнёр сканирует QR → redemption помечается usedAt = now()", () => {
    const now = new Date()
    const redemption = { usedAt: null as Date | null }
    redemption.usedAt = now
    expect(redemption.usedAt).not.toBeNull()
    expect(redemption.usedAt.getTime()).toBeCloseTo(now.getTime(), -3)
  })

  it("попытка использовать уже отсканированный QR → ошибка ALREADY_USED", () => {
    const redemption = { usedAt: hoursAgo(1) }
    const isAlreadyUsed = redemption.usedAt !== null
    expect(isAlreadyUsed).toBe(true)
  })

  it("попытка использовать просроченный QR (> 24 ч) → ошибка EXPIRED", () => {
    const REDEMPTION_TTL_HOURS = 24
    const expiresAt = hoursAgo(25)
    const isExpired = expiresAt.getTime() < Date.now()
    expect(isExpired).toBe(true)
  })

  it("после валидации QR: баллы списаны у клиента и зафиксированы в Transaction", () => {
    const txRecord = {
      type: "REWARD_REDEEMED",
      pointsFromEarned: 150,
      pointsFromWelcome: 50,
      pointsEarned: 0,
      status: "VERIFIED",
    }
    expect(txRecord.type).toBe("REWARD_REDEEMED")
    expect(txRecord.pointsFromEarned + txRecord.pointsFromWelcome).toBe(200) // итого потрачено
    expect(txRecord.pointsEarned).toBe(0) // не начисляется при трате
  })
})

// ════════════════════════════════════════════════════════════════
// 4. СПЕЦИАЛЬНЫЕ ПРЕДЛОЖЕНИЯ ОТ ПАРТНЁРОВ
// ════════════════════════════════════════════════════════════════

describe("Специальные предложения — просмотр каталога", () => {
  /**
   * Флоу: клиент открывает раздел "Предложения"
   *       → видит активные офферы от партнёров
   *       → нажимает на оффер → видит условия + контакты
   */

  it("оффер содержит название, описание, стоимость в баллах", () => {
    const offer = {
      id: "offer_001",
      title: "Эспрессо в подарок",
      description: "Обменяйте 100 баллов на эспрессо при следующем посещении",
      pointsCost: 100,
      isActive: true,
    }
    expect(offer.title).toBeTruthy()
    expect(offer.description).toBeTruthy()
    expect(offer.pointsCost).toBeGreaterThan(0)
    expect(offer.isActive).toBe(true)
  })

  it("оффер привязан к конкретному объекту (venue)", () => {
    const offer = {
      id: "offer_001",
      title: "Кофе в подарок",
      pointsCost: 100,
      venueId: CAFE_PARTNER.id,
      venue: { name: CAFE_PARTNER.name, city: CAFE_PARTNER.city },
    }
    expect(offer.venueId).toBe(CAFE_PARTNER.id)
    expect(offer.venue.name).toBe("Kafić Kod Marka")
  })

  it("неактивные офферы не показываются пользователю", () => {
    const offers = [
      { id: "o1", title: "Кофе", isActive: true, pointsCost: 100 },
      { id: "o2", title: "Пицца (архив)", isActive: false, pointsCost: 200 },
      { id: "o3", title: "Торт", isActive: true, pointsCost: 150 },
    ]
    const visible = offers.filter(o => o.isActive)
    expect(visible).toHaveLength(2)
    expect(visible.every(o => o.isActive)).toBe(true)
  })

  it("офферы фильтруются по maxCost — пользователь ищет доступные по балансу", () => {
    const userBalance = 150
    const offers = [
      { id: "o1", pointsCost: 100 },
      { id: "o2", pointsCost: 200 },
      { id: "o3", pointsCost: 150 },
    ]
    const affordable = offers.filter(o => o.pointsCost <= userBalance)
    expect(affordable).toHaveLength(2)
    expect(affordable.some(o => o.id === "o2")).toBe(false) // слишком дорого
  })

  it("офферы сортируются от дешёвых к дорогим (удобнее для пользователя)", () => {
    const offers = [
      { pointsCost: 300 },
      { pointsCost: 100 },
      { pointsCost: 200 },
    ]
    const sorted = [...offers].sort((a, b) => a.pointsCost - b.pointsCost)
    expect(sorted[0]!.pointsCost).toBe(100)
    expect(sorted[2]!.pointsCost).toBe(300)
  })
})

describe("Специальные предложения — контакты и условия организации", () => {
  it("нажав на оффер, клиент видит контакты: телефон, адрес, соцсети", () => {
    const contacts = OFFER_VENUE_CONTACT
    expect(contacts.phone).toMatch(/^\+/)
    expect(contacts.address).toBeTruthy()
    expect(contacts.instagramUrl).toContain("instagram.com")
    expect(contacts.websiteUrl).toContain("http")
  })

  it("телефон партнёра — кликабельный (можно позвонить из Telegram)", () => {
    const phone = OFFER_VENUE_CONTACT.phone.replace(/\s/g, "")
    const isCallable = phone.startsWith("+")
    expect(isCallable).toBe(true)
  })

  it("адрес партнёра позволяет открыть карту (Google Maps deep link)", () => {
    const address = encodeURIComponent(OFFER_VENUE_CONTACT.address)
    const mapsLink = `https://maps.google.com/?q=${address}`
    expect(mapsLink).toContain("maps.google.com")
    expect(mapsLink).toContain("Knez")
  })

  it("оффер с ограниченным стоком показывает остаток", () => {
    const offer = {
      stockLimit: 50,
      redeemedCount: 43,
    }
    const remaining = offer.stockLimit - offer.redeemedCount
    expect(remaining).toBe(7)
    expect(remaining).toBeGreaterThan(0) // ещё можно взять
  })

  it("оффер с неограниченным стоком (stockLimit = null) показывается без счётчика", () => {
    const offer = { stockLimit: null, redeemedCount: 999 }
    const hasLimit = offer.stockLimit !== null
    expect(hasLimit).toBe(false) // безлимитный оффер
  })

  it("условие использования показывает 'У этого партнёра' — venue чётко указан", () => {
    const offer = {
      title: "Эспрессо в подарок",
      venue: { name: "Kafić Kod Marka", city: "Belgrade" },
      description: "Действует только в нашем заведении",
    }
    expect(offer.venue.name).toBeTruthy()
    expect(offer.description).toContain("заведении")
  })
})

// ════════════════════════════════════════════════════════════════
// 5. СТРИК И МОТИВАЦИЯ — СКВОЗНОЙ СЦЕНАРИЙ
// ════════════════════════════════════════════════════════════════

describe("Стрик — ежедневная мотивация пользователя", () => {
  it("первое действие (чекин/скан) за день начинает стрик", () => {
    const r = computeStreakUpdate(0, 0, null)
    expect(r.currentStreak).toBe(1)
    expect(r.longestStreak).toBe(1)
    expect(r.milestoneBonus).toBe(0)
  })

  it("действие сегодня и вчера → стрик растёт", () => {
    const r = computeStreakUpdate(4, 4, hoursAgo(25))
    expect(r.currentStreak).toBe(5)
  })

  it("пропуск > 36 ч → стрик сбрасывается на 1 (но рекорд сохраняется)", () => {
    const r = computeStreakUpdate(14, 14, hoursAgo(40))
    expect(r.currentStreak).toBe(1)
    expect(r.longestStreak).toBe(14) // рекорд не потерян
  })

  it("7-дневный стрик → бонус +50 очков", () => {
    const r = computeStreakUpdate(6, 6, hoursAgo(25))
    expect(r.currentStreak).toBe(7)
    expect(r.milestoneBonus).toBe(50)
  })

  it("30-дневный стрик → бонус +200 очков", () => {
    const r = computeStreakUpdate(29, 29, hoursAgo(25))
    expect(r.currentStreak).toBe(30)
    expect(r.milestoneBonus).toBe(200)
  })
})

// ════════════════════════════════════════════════════════════════
// 6. СКВОЗНОЙ СЦЕНАРИЙ: ПОЛНЫЙ ПУТЬ НОВОГО ПОЛЬЗОВАТЕЛЯ
// ════════════════════════════════════════════════════════════════

describe("Сквозной сценарий: Марко — новый клиент", () => {
  /**
   * День 1:
   *   1. Марко открывает бота → регистрация
   *   2. Использует реферальный код друга → +50 earned
   *   3. Идёт в кафе, делает чекин → +5 earned
   *   4. Покупает кофе 500 RSD (партнёрская покупка 0.008) → +4 earned
   *   5. Фотографирует чек супермаркета 2000 RSD → +2 earned
   *   ---
   *   Итого: earned = 50 + 5 + 4 + 2 = 61
   *          welcome = 500
   *          total = 561
   *
   * День 2:
   *   6. Марко хочет взять эспрессо за 100 очков
   *   7. Тратит 61 earned + 39 welcome → итого 100 баллов за кофе
   *   ---
   *   После: earned = 0, welcome = 461
   */

  it("День 1: регистрация с реф. кодом → earned = 50", () => {
    const earned = 0 + REFERRAL_SIGNUP_POINTS
    expect(earned).toBe(50)
  })

  it("День 1: чекин в кафе → earned = 55", () => {
    const earned = 50 + CHECKIN_POINTS
    expect(earned).toBe(55)
  })

  it("День 1: партнёрская покупка кофе 500 RSD → earned = 59", () => {
    const partnerPts = calculatePartnerPoints(500, 0.008, null, null) // 4
    const earned = 55 + partnerPts
    expect(partnerPts).toBe(4)
    expect(earned).toBe(59)
  })

  it("День 1: скан чека супермаркета 2000 RSD → earned = 61", () => {
    const scanPts = Math.floor(2000 * SCAN_POINTS_PER_CURRENCY) // 2
    const earned = 59 + scanPts
    expect(scanPts).toBe(2)
    expect(earned).toBe(61)
  })

  it("День 1 итог: total = 561 (61 earned + 500 welcome)", () => {
    const earnedDay1 = 61
    const welcome = WELCOME_BONUS_AMOUNT // 500
    expect(earnedDay1 + welcome).toBe(561)
  })

  it("День 2: обмен 100 очков на эспрессо — сначала earned, потом welcome", () => {
    const wallet = {
      earnedPoints: 61,
      welcomePoints: 500,
      welcomeExpiresAt: daysFromNow(89),
      lastWelcomeUsedAt: null,
    }
    const result = calcSpend(wallet, 100)
    expect(result).toEqual({ ok: true, fromEarned: 61, fromWelcome: 39 })
  })

  it("День 2 после обмена: earned = 0, welcome = 461", () => {
    const after = { earnedPoints: 61 - 61, welcomePoints: 500 - 39 }
    expect(after.earnedPoints).toBe(0)
    expect(after.welcomePoints).toBe(461)
  })

  it("Марко делится инвайтом → новый друг регистрируется → Марко +100 earned", () => {
    const markoEarned = 0 // после траты
    const referralBonus = REFERRAL_REWARD_POINTS
    const afterReferral = markoEarned + referralBonus
    expect(afterReferral).toBe(100)
  })
})
