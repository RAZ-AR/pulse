const PURS_HOST = "suf.purs.gov.rs"
const RECEIPT_TIME_ZONE = "Europe/Belgrade"

export type SerbiaReceiptErrorKind = "INVALID" | "UNAVAILABLE"

export class SerbiaReceiptError extends Error {
  constructor(
    message: string,
    readonly kind: SerbiaReceiptErrorKind,
  ) {
    super(message)
    this.name = "SerbiaReceiptError"
  }
}

export type SerbiaQrData = {
  requestedBy: string
  signedBy: string
  totalCounter: number
  transactionTypeCounter: number
  totalRsd: number
  timestamp: string
  date: string
  time: string
  receiptNumber: string
  vendorName: string
  pib: string
  locationName: string
  address: string
  city: string
  verificationUrl: string
}

type JsonObject = Record<string, unknown>

function asObject(value: unknown, field: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SerbiaReceiptError(`Invalid PURS response: ${field}`, "INVALID")
  }
  return value as JsonObject
}

function asString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new SerbiaReceiptError(`Invalid PURS response: ${field}`, "INVALID")
  }
  return value.trim()
}

function asNumber(value: unknown, field: string): number {
  const number = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(number)) {
    throw new SerbiaReceiptError(`Invalid PURS response: ${field}`, "INVALID")
  }
  return number
}

export function normalizeTaxId(value: unknown): string {
  return typeof value === "string" ? value.replace(/\D/g, "") : ""
}

// Buyer ID type prefixes (format "TT:value") that identify a legal entity
// rather than a private shopper: 10 = PIB, 12 = PIB+JBKJS (public sector),
// 14 = PIB (agricultural legal entity), 40 = foreign tax number.
const CORPORATE_BUYER_ID_TYPES = new Set(["10", "12", "14", "40"])

/** True when the receipt was invoiced to a company / public-sector buyer (PIB-based). */
export function isCorporateBuyer(buyer: unknown): boolean {
  if (typeof buyer !== "string") return false
  const type = buyer.split(":")[0]?.trim() ?? ""
  return CORPORATE_BUYER_ID_TYPES.has(type)
}

/** Only the official production verification endpoint may be requested. */
export function normalizeVerificationUrl(input: string): string {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    throw new SerbiaReceiptError("Not a Serbian fiscal receipt QR code", "INVALID")
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== PURS_HOST ||
    !url.pathname.startsWith("/v/") ||
    !url.searchParams.get("vl")
  ) {
    throw new SerbiaReceiptError("Not a Serbian fiscal receipt QR code", "INVALID")
  }

  url.hash = ""
  return url.toString()
}

/** Parse the documented public JSON response returned by the Tax Administration. */
export function parseSerbiaReceiptJson(payload: unknown, verificationUrl: string): SerbiaQrData {
  const root = asObject(payload, "root")
  const request = asObject(root.invoiceRequest, "invoiceRequest")
  const result = asObject(root.invoiceResult, "invoiceResult")

  if (root.isValid !== true) {
    throw new SerbiaReceiptError("Receipt is not valid", "INVALID")
  }
  if (asNumber(request.invoiceType, "invoiceType") !== 0) {
    throw new SerbiaReceiptError("Only normal fiscal receipts are accepted", "INVALID")
  }
  if (asNumber(request.transactionType, "transactionType") !== 0) {
    throw new SerbiaReceiptError("Refund receipts are not accepted", "INVALID")
  }
  // Only private shoppers earn points: reject receipts invoiced to a company
  // (buyer identified by a PIB-based ID type). Personal buyer IDs — JMBG, ID
  // card, passport, etc. — are fine and common on real consumer receipts.
  if (isCorporateBuyer(request.buyer)) {
    throw new SerbiaReceiptError("Business (corporate) receipts are not accepted", "INVALID")
  }

  const pib = normalizeTaxId(request.taxId)
  if (pib.length !== 9) {
    throw new SerbiaReceiptError("Receipt contains an invalid seller PIB", "INVALID")
  }

  const totalRsd = asNumber(result.totalAmount, "totalAmount")
  if (totalRsd <= 0) {
    throw new SerbiaReceiptError("Receipt total must be positive", "INVALID")
  }

  const timestamp = asString(result.sdcTime, "sdcTime")
  const issuedAt = new Date(timestamp)
  if (Number.isNaN(issuedAt.getTime())) {
    throw new SerbiaReceiptError("Receipt contains an invalid date", "INVALID")
  }

  return {
    requestedBy: asString(request.requestedBy, "requestedBy"),
    signedBy: asString(result.signedBy, "signedBy"),
    totalCounter: asNumber(result.totalCounter, "totalCounter"),
    transactionTypeCounter: asNumber(result.transactionTypeCounter, "transactionTypeCounter"),
    totalRsd,
    timestamp: issuedAt.toISOString(),
    date: issuedAt.toISOString().slice(0, 10),
    time: issuedAt.toISOString().slice(11, 16),
    receiptNumber: asString(result.invoiceNumber, "invoiceNumber").toUpperCase(),
    vendorName: asString(request.businessName, "businessName"),
    pib,
    locationName: typeof request.locationName === "string" ? request.locationName.trim() : "",
    address: typeof request.address === "string" ? request.address.trim() : "",
    city: typeof request.city === "string" ? request.city.trim() : "",
    verificationUrl,
  }
}

export function validateReceiptEligibility(
  receipt: SerbiaQrData,
  now = new Date(),
  maxAgeHours = 48,
  maxAmountRsd = 10_000,
): void {
  if (receipt.totalRsd > maxAmountRsd) {
    throw new SerbiaReceiptError(`Only receipts up to ${maxAmountRsd.toLocaleString("en-US")} RSD are accepted`, "INVALID")
  }

  const issuedAt = new Date(receipt.timestamp)
  const ageMs = now.getTime() - issuedAt.getTime()
  // Some fiscal devices run a fast clock or stamp local Belgrade time (UTC+2)
  // into sdcTime, so a fresh receipt can read a couple of hours ahead. The real
  // anti-replay guards are the unique receipt number and the 48h age window, so
  // only reject implausibly future-dated receipts.
  const MAX_FUTURE_SKEW_MS = 3 * 60 * 60_000
  if (ageMs < -MAX_FUTURE_SKEW_MS) {
    throw new SerbiaReceiptError("Receipt date is in the future", "INVALID")
  }
  if (ageMs > maxAgeHours * 60 * 60_000) {
    throw new SerbiaReceiptError(`Receipt is older than ${maxAgeHours} hours`, "INVALID")
  }
}

export function receiptDayInBelgrade(timestamp: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: RECEIPT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestamp))
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

/** Fetch the receipt exactly as documented by PURS; no HTML scraping or OCR. */
export async function fetchSerbiaReceipt(
  inputUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<SerbiaQrData> {
  const verificationUrl = normalizeVerificationUrl(inputUrl)

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetcher(verificationUrl, {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "ayoo-receipt-verifier/1.0",
        },
        signal: AbortSignal.timeout(8_000),
      })
      if (!response.ok) {
        if (response.status >= 500 && attempt === 0) continue
        throw new SerbiaReceiptError(`PURS returned status ${response.status}`, "UNAVAILABLE")
      }
      return parseSerbiaReceiptJson(await response.json(), verificationUrl)
    } catch (error) {
      if (error instanceof SerbiaReceiptError && error.kind === "INVALID") throw error
      if (attempt === 0) continue
      if (error instanceof SerbiaReceiptError) throw error
      throw new SerbiaReceiptError("PURS verification service is unavailable", "UNAVAILABLE")
    }
  }

  throw new SerbiaReceiptError("PURS verification service is unavailable", "UNAVAILABLE")
}
