/**
 * ui-helpers.test.ts
 *
 * Тесты чистых helper-функций, используемых экранами мобильного приложения.
 * Все функции скопированы 1-в-1 из соответствующих screen-файлов и описывают
 * ожидаемое поведение UI без необходимости рендерить компоненты.
 *
 * Покрываемые экраны:
 *   - (tabs)/index.tsx  — главный дашборд
 *   - (tabs)/rewards.tsx — экран наград
 *   - (tabs)/earn.tsx   — экран начисления
 */

import { describe, it, expect } from "vitest"

// ─── Helpers from (tabs)/index.tsx ───────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString()
}

function daysLeft(d: Date | string | null | undefined): number {
  if (!d) return 0
  return Math.max(0, Math.round((new Date(d).getTime() - Date.now()) / 86_400_000))
}

function distanceLabel(meters: number | null | undefined): string {
  if (meters === null || meters === undefined) return "Nearby"
  if (meters < 1000) return `${Math.round(meters)}m`
  return `${(meters / 1000).toFixed(1)}km`
}

function ratingLabel(rating: number | null | undefined, reviews: number | null | undefined): string {
  if (!rating) return "Google soon"
  return `Google ${rating.toFixed(1)} · ${reviews ?? 0}`
}

function initials(name: string | null | undefined): string {
  return (name ?? "P").slice(0, 1).toUpperCase()
}

const AVATAR_COLORS = ["#3B82F6", "#8B5CF6", "#EC4899", "#EF4444", "#F59E0B", "#10B981", "#6366F1", "#0EA5E9"]

function getAvatarColor(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl?.startsWith("color:")) return null
  const idx = parseInt(avatarUrl.slice(6), 10)
  return AVATAR_COLORS[idx] ?? null
}

type Tier = { name: string; kind: string; next: number; start: number }

function userTier(points: number): Tier {
  if (points <= 1000) return { name: "Росток",    kind: "sprout",      next: 1000,  start: 0    }
  if (points <= 3000) return { name: "Цветок",    kind: "flower",      next: 3000,  start: 1001 }
  if (points <= 5000) return { name: "Гранат",    kind: "pomegranate", next: 5000,  start: 3001 }
  if (points <= 7000) return { name: "Рубин",     kind: "ruby",        next: 7000,  start: 5001 }
  return               { name: "Бриллиант", kind: "diamond",     next: 10000, start: 7001 }
}

function tierProgress(points: number, start: number, next: number): number {
  return Math.max(0.08, Math.min(1, (points - start) / Math.max(1, next - start)))
}

// ─── Helpers from (tabs)/rewards.tsx ─────────────────────────────────────────

function welcomeDaysLeft(welcomeExpiresAt: Date | null | undefined): number | null {
  if (!welcomeExpiresAt) return null
  return Math.max(0, Math.ceil((new Date(welcomeExpiresAt).getTime() - Date.now()) / 86_400_000))
}

function showExpiryWarning(welcomePoints: number, daysLeft: number | null): boolean {
  return welcomePoints > 0 && daysLeft !== null && daysLeft <= 7
}

// ─── Helpers from (tabs)/earn.tsx ────────────────────────────────────────────

const TX_ICONS: Record<string, string> = {
  PARTNER_PURCHASE: "P",
  RECEIPT_SCAN: "⌁",
  CHECKIN_PHOTO: "⌖",
  REWARD_REDEEMED: "□",
  REFERRAL: "+",
  GIFT_RECEIVED: "□",
  GIFT_SENT: "□",
  CHALLENGE_COMPLETE: "✓",
  BONUS: "✦",
}

function txIcon(type: string): string {
  return TX_ICONS[type] ?? "·"
}

function isEarnTx(pointsEarned: number): boolean {
  return pointsEarned > 0
}

// ─── fmt ─────────────────────────────────────────────────────────────────────

describe("fmt — форматирование чисел", () => {
  it("форматирует 0", () => {
    expect(fmt(0)).toBe("0")
  })

  it("форматирует небольшие числа без разделителей", () => {
    expect(fmt(500)).toBe("500")
  })

  it("форматирует 1000+ с разделителями (locale)", () => {
    // locale может давать 1,000 или 1 000 — главное что не "1000" без разделителя
    const result = fmt(1500)
    expect(result).toMatch(/1.500|1,500/)
  })

  it("форматирует большое число", () => {
    const result = fmt(12345)
    expect(result.replace(/[,\s.]/g, "")).toBe("12345")
  })
})

// ─── daysLeft ─────────────────────────────────────────────────────────────────

describe("daysLeft — оставшиеся дни", () => {
  it("возвращает 0 для null", () => {
    expect(daysLeft(null)).toBe(0)
  })

  it("возвращает 0 для undefined", () => {
    expect(daysLeft(undefined)).toBe(0)
  })

  it("возвращает 0 для уже истёкшей даты", () => {
    const past = new Date(Date.now() - 10 * 86_400_000) // -10 дней
    expect(daysLeft(past)).toBe(0)
  })

  it("возвращает ~90 для welcome-бонуса только что выданного", () => {
    const future = new Date(Date.now() + 90 * 86_400_000)
    expect(daysLeft(future)).toBe(90)
  })

  it("принимает строку ISO", () => {
    const future = new Date(Date.now() + 7 * 86_400_000).toISOString()
    expect(daysLeft(future)).toBe(7)
  })

  it("никогда не возвращает отрицательное число", () => {
    const past = new Date(Date.now() - 100 * 86_400_000)
    expect(daysLeft(past)).toBeGreaterThanOrEqual(0)
  })
})

// ─── distanceLabel ───────────────────────────────────────────────────────────

describe("distanceLabel — подпись расстояния", () => {
  it('возвращает "Nearby" для null', () => {
    expect(distanceLabel(null)).toBe("Nearby")
  })

  it('возвращает "Nearby" для undefined', () => {
    expect(distanceLabel(undefined)).toBe("Nearby")
  })

  it("показывает метры для расстояний < 1 км", () => {
    expect(distanceLabel(0)).toBe("0m")
    expect(distanceLabel(50)).toBe("50m")
    expect(distanceLabel(999)).toBe("999m")
  })

  it("показывает км с одним десятичным знаком для >= 1000 м", () => {
    expect(distanceLabel(1000)).toBe("1.0km")
    expect(distanceLabel(1500)).toBe("1.5km")
    expect(distanceLabel(2300)).toBe("2.3km")
  })

  it("корректно округляет метры", () => {
    expect(distanceLabel(149)).toBe("149m")
    expect(distanceLabel(150)).toBe("150m")
  })
})

// ─── ratingLabel ─────────────────────────────────────────────────────────────

describe("ratingLabel — подпись рейтинга Google", () => {
  it('возвращает "Google soon" если рейтинга нет', () => {
    expect(ratingLabel(null, null)).toBe("Google soon")
    expect(ratingLabel(0, 0)).toBe("Google soon")
    expect(ratingLabel(undefined, 5)).toBe("Google soon")
  })

  it("форматирует рейтинг с одним знаком после точки", () => {
    expect(ratingLabel(4.7, 120)).toBe("Google 4.7 · 120")
  })

  it("показывает 0 отзывов если reviews = null", () => {
    expect(ratingLabel(4.5, null)).toBe("Google 4.5 · 0")
  })

  it("форматирует 5.0 правильно", () => {
    expect(ratingLabel(5, 1)).toBe("Google 5.0 · 1")
  })
})

// ─── initials ────────────────────────────────────────────────────────────────

describe("initials — первая буква имени", () => {
  it("возвращает первую букву заглавной", () => {
    expect(initials("Marko")).toBe("M")
    expect(initials("anna")).toBe("A")
  })

  it('возвращает "P" для null (default ayoo)', () => {
    expect(initials(null)).toBe("P")
    expect(initials(undefined)).toBe("P")
  })

  it("работает с кириллицей", () => {
    expect(initials("Армен")).toBe("А")
  })

  it("работает с одним символом", () => {
    expect(initials("X")).toBe("X")
  })
})

// ─── getAvatarColor ───────────────────────────────────────────────────────────

describe("getAvatarColor — цвет аватара из строки color:", () => {
  it("возвращает null для обычного URL", () => {
    expect(getAvatarColor("https://cdn.example.com/avatar.jpg")).toBeNull()
    expect(getAvatarColor(null)).toBeNull()
    expect(getAvatarColor(undefined)).toBeNull()
  })

  it("извлекает первый цвет (индекс 0)", () => {
    expect(getAvatarColor("color:0")).toBe("#3B82F6")
  })

  it("извлекает последний допустимый цвет (индекс 7)", () => {
    expect(getAvatarColor("color:7")).toBe("#0EA5E9")
  })

  it("возвращает null для индекса вне диапазона", () => {
    expect(getAvatarColor("color:99")).toBeNull()
  })

  it("поддерживает все 8 цветов", () => {
    for (let i = 0; i < 8; i++) {
      expect(getAvatarColor(`color:${i}`)).toBeTruthy()
    }
  })
})

// ─── userTier ─────────────────────────────────────────────────────────────────

describe("userTier — уровень пользователя по очкам", () => {
  it("Росток: 0–1000 очков", () => {
    expect(userTier(0).name).toBe("Росток")
    expect(userTier(500).name).toBe("Росток")
    expect(userTier(1000).name).toBe("Росток")
  })

  it("Цветок: 1001–3000", () => {
    expect(userTier(1001).name).toBe("Цветок")
    expect(userTier(2000).name).toBe("Цветок")
    expect(userTier(3000).name).toBe("Цветок")
  })

  it("Гранат: 3001–5000", () => {
    expect(userTier(3001).name).toBe("Гранат")
    expect(userTier(4000).name).toBe("Гранат")
  })

  it("Рубин: 5001–7000", () => {
    expect(userTier(5001).name).toBe("Рубин")
    expect(userTier(7000).name).toBe("Рубин")
  })

  it("Бриллиант: 7001+", () => {
    expect(userTier(7001).name).toBe("Бриллиант")
    expect(userTier(50000).name).toBe("Бриллиант")
  })

  it("на границах — правильный тир", () => {
    expect(userTier(1000).kind).toBe("sprout")
    expect(userTier(1001).kind).toBe("flower")
    expect(userTier(3000).kind).toBe("flower")
    expect(userTier(3001).kind).toBe("pomegranate")
    expect(userTier(5000).kind).toBe("pomegranate")
    expect(userTier(5001).kind).toBe("ruby")
    expect(userTier(7000).kind).toBe("ruby")
    expect(userTier(7001).kind).toBe("diamond")
  })

  it("содержит правильные поля start/next для прогресс-бара", () => {
    const t = userTier(500)
    expect(t.start).toBe(0)
    expect(t.next).toBe(1000)
  })
})

// ─── tierProgress ─────────────────────────────────────────────────────────────

describe("tierProgress — процент заполненности уровня", () => {
  it("минимум 8% (чтобы шар не был пустым)", () => {
    expect(tierProgress(0, 0, 1000)).toBe(0.08)
  })

  it("50% на середине уровня", () => {
    expect(tierProgress(500, 0, 1000)).toBe(0.5)
  })

  it("100% в конце уровня", () => {
    expect(tierProgress(1000, 0, 1000)).toBe(1)
  })

  it("не превышает 100%", () => {
    expect(tierProgress(9999, 0, 1000)).toBe(1)
  })

  it("корректен для уровня Цветок (start=1001, next=3000)", () => {
    const progress = tierProgress(2000, 1001, 3000)
    expect(progress).toBeCloseTo(0.5, 1)
  })

  it("работает корректно для нулевого диапазона (start = next)", () => {
    // Math.max(1, 0) защищает от деления на 0
    expect(tierProgress(5000, 5000, 5000)).toBeGreaterThanOrEqual(0.08)
  })
})

// ─── welcomeExpiryWarning ──────────────────────────────────────────────────────

describe("showExpiryWarning — предупреждение о скором сгорании welcome-баллов", () => {
  it("не показывает если welcome = 0", () => {
    expect(showExpiryWarning(0, 3)).toBe(false)
  })

  it("не показывает если daysLeft = null", () => {
    expect(showExpiryWarning(500, null)).toBe(false)
  })

  it("не показывает если осталось больше 7 дней", () => {
    expect(showExpiryWarning(500, 8)).toBe(false)
    expect(showExpiryWarning(500, 30)).toBe(false)
  })

  it("показывает если осталось ровно 7 дней", () => {
    expect(showExpiryWarning(500, 7)).toBe(true)
  })

  it("показывает если осталось меньше 7 дней", () => {
    expect(showExpiryWarning(500, 3)).toBe(true)
    expect(showExpiryWarning(500, 0)).toBe(true)
  })

  it("показывает для реального welcomeExpiresAt через 5 дней", () => {
    const expires = new Date(Date.now() + 5 * 86_400_000)
    const days = welcomeDaysLeft(expires)
    expect(showExpiryWarning(500, days)).toBe(true)
  })
})

// ─── Transaction display ──────────────────────────────────────────────────────

describe("txIcon — иконка типа транзакции", () => {
  it("иконки для всех известных типов", () => {
    expect(txIcon("PARTNER_PURCHASE")).toBe("P")
    expect(txIcon("RECEIPT_SCAN")).toBe("⌁")
    expect(txIcon("CHECKIN_PHOTO")).toBe("⌖")
    expect(txIcon("REWARD_REDEEMED")).toBe("□")
    expect(txIcon("REFERRAL")).toBe("+")
    expect(txIcon("GIFT_RECEIVED")).toBe("□")
    expect(txIcon("GIFT_SENT")).toBe("□")
    expect(txIcon("CHALLENGE_COMPLETE")).toBe("✓")
    expect(txIcon("BONUS")).toBe("✦")
  })

  it('возвращает "·" для неизвестного типа', () => {
    expect(txIcon("UNKNOWN_TYPE")).toBe("·")
    expect(txIcon("")).toBe("·")
  })
})

describe("isEarnTx — начисление vs списание", () => {
  it("начисление: pointsEarned > 0", () => {
    expect(isEarnTx(100)).toBe(true)
    expect(isEarnTx(1)).toBe(true)
  })

  it("списание / нулевая: pointsEarned = 0", () => {
    expect(isEarnTx(0)).toBe(false)
  })

  it("списание не бывает с отрицательными pointsEarned", () => {
    // reward redeemed записывается как pointsEarned: 0, не отрицательное
    expect(isEarnTx(0)).toBe(false)
  })
})

// ─── Баланс отображения ───────────────────────────────────────────────────────

describe("Суммарный баланс (earnedPoints + welcomePoints)", () => {
  function totalBalance(earned: number, welcome: number): number {
    return earned + welcome
  }

  it("сумма двух кошельков", () => {
    expect(totalBalance(300, 500)).toBe(800)
    expect(totalBalance(0, 500)).toBe(500)
    expect(totalBalance(1200, 0)).toBe(1200)
  })

  it("нулевой баланс для нового пользователя (до начисления welcome)", () => {
    expect(totalBalance(0, 0)).toBe(0)
  })
})

describe("lifetimePoints — накопленные очки за всё время", () => {
  function lifetimePoints(totalEarnedLifetime: number | undefined, earned: number, welcome: number, spent: number): number {
    const total = earned + welcome
    return Math.max(totalEarnedLifetime ?? 0, total + spent)
  }

  it("возвращает totalEarnedLifetime если оно больше", () => {
    expect(lifetimePoints(5000, 300, 200, 100)).toBe(5000)
  })

  it("вычисляет из баланса если lifetime не записан", () => {
    // total = 800, spent = 200 → 1000
    expect(lifetimePoints(0, 300, 500, 200)).toBe(1000)
  })

  it("минимум 0 для нового пользователя", () => {
    expect(lifetimePoints(undefined, 0, 0, 0)).toBe(0)
  })
})
