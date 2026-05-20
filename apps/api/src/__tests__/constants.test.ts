import { describe, it, expect } from "vitest"
import {
  SCAN_RATE_RATIO,
  MIN_REDEEM,
  WELCOME_BONUS_AMOUNT,
  WELCOME_MAX_PER_TRANSACTION,
  WELCOME_COOLDOWN_HOURS,
  WELCOME_EXPIRY_DAYS,
} from "@pulse/shared"

describe("ayoo constants", () => {
  it("partner rate is 10x scan rate", () => {
    expect(SCAN_RATE_RATIO).toBe(10)
  })

  it("minimum redemption is 100 points", () => {
    expect(MIN_REDEEM).toBe(100)
  })

  it("welcome bonus is 500 points", () => {
    expect(WELCOME_BONUS_AMOUNT).toBe(500)
  })

  it("welcome max per transaction is 100", () => {
    expect(WELCOME_MAX_PER_TRANSACTION).toBe(100)
  })

  it("welcome cooldown is 24 hours", () => {
    expect(WELCOME_COOLDOWN_HOURS).toBe(24)
  })

  it("welcome expires after 90 days", () => {
    expect(WELCOME_EXPIRY_DAYS).toBe(90)
  })
})
