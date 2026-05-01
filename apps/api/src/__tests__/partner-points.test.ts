import { describe, it, expect } from "vitest"
import { calculatePartnerPoints } from "@pulse/shared"

function futureDate(hoursFromNow: number): Date {
  return new Date(Date.now() + hoursFromNow * 3_600_000)
}

function pastDate(hoursAgo: number): Date {
  return new Date(Date.now() - hoursAgo * 3_600_000)
}

describe("calculatePartnerPoints", () => {
  it("applies base rate with no boost", () => {
    expect(calculatePartnerPoints(1000, 0.008, null, null)).toBe(8)
  })

  it("floors fractional points", () => {
    expect(calculatePartnerPoints(100, 0.008, null, null)).toBe(0)
    expect(calculatePartnerPoints(125, 0.008, null, null)).toBe(1)
  })

  it("applies boost multiplier when active", () => {
    expect(calculatePartnerPoints(1000, 0.008, 2, futureDate(1))).toBe(16)
  })

  it("ignores multiplier when boost has expired", () => {
    expect(calculatePartnerPoints(1000, 0.008, 2, pastDate(1))).toBe(8)
  })

  it("ignores multiplier when boostUntil is null", () => {
    expect(calculatePartnerPoints(1000, 0.008, 2, null)).toBe(8)
  })

  it("ignores multiplier when boostMultiplier is null", () => {
    expect(calculatePartnerPoints(1000, 0.008, null, futureDate(1))).toBe(8)
  })

  it("handles large amounts correctly", () => {
    // 50_000 RSD × 0.008 pts/RSD = 400 pts
    expect(calculatePartnerPoints(50_000, 0.008, null, null)).toBe(400)
  })

  it("applies 3× boost to large amount", () => {
    expect(calculatePartnerPoints(50_000, 0.008, 3, futureDate(24))).toBe(1200)
  })
})
