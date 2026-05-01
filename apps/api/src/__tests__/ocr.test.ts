import { describe, it, expect } from "vitest"
import { computeReceiptHash } from "@pulse/trpc/server"

describe("computeReceiptHash", () => {
  const base = {
    vendor: "Café Willow",
    total: 350,
    currency: "RSD",
    date: "2026-05-01",
    receiptNumber: "00123456",
  }

  it("returns a 64-char hex SHA-256", () => {
    const hash = computeReceiptHash(base)
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it("same inputs produce same hash", () => {
    expect(computeReceiptHash(base)).toBe(computeReceiptHash(base))
  })

  it("different amounts produce different hashes", () => {
    expect(computeReceiptHash(base)).not.toBe(
      computeReceiptHash({ ...base, total: 351 })
    )
  })

  it("normalises vendor name (case + whitespace)", () => {
    // Case and internal spaces are normalised
    const h1 = computeReceiptHash({ ...base, vendor: "Cafe Willow" })
    const h2 = computeReceiptHash({ ...base, vendor: "cafe  willow" })
    expect(h1).toBe(h2)
  })

  it("uses only last 4 digits of receipt number", () => {
    const h1 = computeReceiptHash({ ...base, receiptNumber: "00123456" })
    const h2 = computeReceiptHash({ ...base, receiptNumber: "99993456" })
    expect(h1).toBe(h2)
  })
})
