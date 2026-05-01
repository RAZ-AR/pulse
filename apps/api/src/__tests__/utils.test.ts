import { describe, it, expect } from "vitest"
import { generateReferralCode } from "@pulse/shared"

describe("generateReferralCode", () => {
  it("generates a 6-character code by default", () => {
    expect(generateReferralCode()).toHaveLength(6)
  })

  it("only uses allowed characters", () => {
    const allowed = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/
    for (let i = 0; i < 100; i++) {
      expect(generateReferralCode()).toMatch(allowed)
    }
  })

  it("produces unique codes", () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateReferralCode()))
    // With 32^6 = ~1B combinations, 1000 samples should all be unique
    expect(codes.size).toBe(1000)
  })
})
