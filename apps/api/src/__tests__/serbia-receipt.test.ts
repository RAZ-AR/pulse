import { describe, expect, it, vi } from "vitest"
import {
  fetchSerbiaReceipt,
  normalizeTaxId,
  normalizeVerificationUrl,
  parseSerbiaReceiptJson,
  receiptDayInBelgrade,
  validateReceiptEligibility,
} from "../../../../packages/trpc/src/services/serbia-qr"

const QR_URL = "https://suf.purs.gov.rs/v/?vl=test-payload"

function validPayload(overrides: Record<string, unknown> = {}) {
  const { invoiceRequest, invoiceResult, ...root } = overrides
  return {
    invoiceRequest: {
      taxId: "109876543",
      businessName: "Primer Market DOO",
      locationName: "Primer Market Dorcol",
      address: "Cara Dusana 10",
      city: "BEOGRAD",
      buyer: null,
      requestedBy: "ABCD1234",
      invoiceType: 0,
      transactionType: 0,
      ...((invoiceRequest as object | undefined) ?? {}),
    },
    invoiceResult: {
      totalAmount: 2_500,
      transactionTypeCounter: 42,
      totalCounter: 99,
      invoiceNumber: "ABCD1234-EFGH5678-99",
      signedBy: "EFGH5678",
      sdcTime: "2026-06-22T12:00:00.000Z",
      ...((invoiceResult as object | undefined) ?? {}),
    },
    isValid: true,
    ...root,
  }
}

describe("Serbian fiscal receipt verification", () => {
  it("accepts only the official HTTPS verification URL", () => {
    expect(normalizeVerificationUrl(QR_URL)).toBe(QR_URL)
    expect(() => normalizeVerificationUrl("https://evil.example/v/?vl=x")).toThrow("Not a Serbian")
    expect(() => normalizeVerificationUrl("http://suf.purs.gov.rs/v/?vl=x")).toThrow("Not a Serbian")
    expect(() => normalizeVerificationUrl("https://suf.purs.gov.rs/other?vl=x")).toThrow("Not a Serbian")
  })

  it("extracts company, PIB, amount, number and date from PURS JSON", () => {
    const receipt = parseSerbiaReceiptJson(validPayload(), QR_URL)
    expect(receipt).toMatchObject({
      vendorName: "Primer Market DOO",
      pib: "109876543",
      totalRsd: 2_500,
      receiptNumber: "ABCD1234-EFGH5678-99",
      requestedBy: "ABCD1234",
      locationName: "Primer Market Dorcol",
    })
  })

  it("rejects invalid, non-sale and corporate-buyer receipts; accepts personal buyer IDs", () => {
    expect(() => parseSerbiaReceiptJson(validPayload({ isValid: false }), QR_URL)).toThrow("not valid")
    expect(() => parseSerbiaReceiptJson(validPayload({ invoiceRequest: { transactionType: 1 } }), QR_URL)).toThrow("Refund")
    expect(() => parseSerbiaReceiptJson(validPayload({ invoiceRequest: { invoiceType: 2 } }), QR_URL)).toThrow("normal")
    // Corporate buyer (PIB, type 10) → business receipt, rejected.
    expect(() => parseSerbiaReceiptJson(validPayload({ invoiceRequest: { buyer: "10:115398625" } }), QR_URL)).toThrow("corporate")
    // Personal buyer IDs (JMBG type 11, ID card type 20) → private shopper, accepted.
    expect(parseSerbiaReceiptJson(validPayload({ invoiceRequest: { buyer: "11:0101990710099" } }), QR_URL).pib).toBe("109876543")
    expect(parseSerbiaReceiptJson(validPayload({ invoiceRequest: { buyer: "20:123456789" } }), QR_URL).pib).toBe("109876543")
  })

  it("accepts up to 10,000 RSD and receipts no older than 48 hours", () => {
    const now = new Date("2026-06-23T12:00:00.000Z")
    const receipt = parseSerbiaReceiptJson(validPayload({
      invoiceResult: { totalAmount: 10_000, sdcTime: "2026-06-21T12:00:00.000Z" },
    }), QR_URL)
    expect(() => validateReceiptEligibility(receipt, now)).not.toThrow()

    expect(() => validateReceiptEligibility({ ...receipt, totalRsd: 10_000.01 }, now)).toThrow("10,000")
    expect(() => validateReceiptEligibility({ ...receipt, timestamp: "2026-06-21T11:59:59.000Z" }, now)).toThrow("48 hours")
  })

  it("uses the PURS JSON endpoint with documented headers", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(validPayload()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })) as unknown as typeof fetch

    await expect(fetchSerbiaReceipt(QR_URL, fetcher)).resolves.toMatchObject({ pib: "109876543" })
    expect(fetcher).toHaveBeenCalledWith(QR_URL, expect.objectContaining({
      headers: expect.objectContaining({ Accept: "application/json" }),
    }))
  })

  it("normalizes PIB and uses Belgrade calendar days", () => {
    expect(normalizeTaxId("PIB: 109 876 543")).toBe("109876543")
    expect(receiptDayInBelgrade("2026-06-22T22:30:00.000Z")).toBe("2026-06-23")
  })
})
