import { describe, it, expect } from "vitest"
import { calcSpend } from "@pulse/shared"

const baseWallet = {
  earnedPoints: 0,
  welcomePoints: 500,
  welcomeExpiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000),
  lastWelcomeUsedAt: null,
}

describe("calcSpend", () => {
  it("spends earnedPoints first", () => {
    const result = calcSpend({ ...baseWallet, earnedPoints: 200 }, 150)
    expect(result).toEqual({ ok: true, fromEarned: 150, fromWelcome: 0 })
  })

  it("falls through to welcomePoints when earned is insufficient", () => {
    const result = calcSpend({ ...baseWallet, earnedPoints: 30 }, 80)
    expect(result).toEqual({ ok: true, fromEarned: 30, fromWelcome: 50 })
  })

  it("caps welcome spend at 100 per transaction", () => {
    const result = calcSpend({ ...baseWallet, earnedPoints: 0 }, 150)
    expect(result).toEqual({ ok: false, error: "INSUFFICIENT_POINTS" })
  })

  it("allows exactly 100 from welcome", () => {
    const result = calcSpend({ ...baseWallet, earnedPoints: 0 }, 100)
    expect(result).toEqual({ ok: true, fromEarned: 0, fromWelcome: 100 })
  })

  it("blocks second welcome transaction within 24h", () => {
    const result = calcSpend(
      { ...baseWallet, earnedPoints: 0, lastWelcomeUsedAt: new Date() },
      50
    )
    expect(result).toEqual({ ok: false, error: "WELCOME_DAILY_LIMIT" })
  })

  it("allows welcome transaction after 24h cooldown", () => {
    const yesterday = new Date(Date.now() - 25 * 3600 * 1000)
    const result = calcSpend(
      { ...baseWallet, earnedPoints: 0, lastWelcomeUsedAt: yesterday },
      100
    )
    expect(result).toEqual({ ok: true, fromEarned: 0, fromWelcome: 100 })
  })

  it("returns error when all points insufficient", () => {
    const result = calcSpend({ ...baseWallet, earnedPoints: 0, welcomePoints: 0 }, 50)
    expect(result).toEqual({ ok: false, error: "INSUFFICIENT_POINTS" })
  })

  it("does not use expired welcome points", () => {
    const expired = { ...baseWallet, welcomeExpiresAt: new Date(Date.now() - 1000) }
    const result = calcSpend(expired, 50)
    expect(result).toEqual({ ok: false, error: "INSUFFICIENT_POINTS" })
  })
})
