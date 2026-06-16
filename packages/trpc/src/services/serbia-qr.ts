import { createHash } from "node:crypto"

// ── Types ─────────────────────────────────────────────────────

export type SerbiaQrData = {
  requestedBy: string      // 8-char store UID in PURS system
  signedBy: string         // 8-char cashier/device UID
  totalCounter: number
  transactionTypeCounter: number
  totalRsd: number         // total in RSD (human-readable)
  date: string             // ISO YYYY-MM-DD
  time: string             // HH:MM
  receiptNumber: string    // requestedBy-signedBy-totalCounter
  vendorName: string | null
  verificationUrl: string
}

// ── Decoder ───────────────────────────────────────────────────

export function decodeSerbiaQrUrl(url: string): SerbiaQrData {
  // Extract the vl parameter from the QR URL
  // e.g. https://suf.purs.gov.rs/v/?vl=A1KB...
  const vl = extractVlParam(url)
  if (!vl) throw new Error("Not a Serbian fiscal receipt QR code")

  const bytes = base64ToBytes(decodeURIComponent(vl))

  // Minimum: 41 bytes data + 16 bytes MD5 hash. Real receipts range ~400-900 bytes.
  if (bytes.length < 57 || bytes.length > 2000) {
    throw new Error(`Invalid payload length: ${bytes.length}`)
  }

  // Last 16 bytes = MD5 hash of the rest
  const data = bytes.slice(0, bytes.length - 16)
  const storedHash = bytes.slice(bytes.length - 16)
  const computedHash = Buffer.from(createHash("md5").update(data).digest())

  for (let i = 0; i < 16; i++) {
    if (storedHash[i] !== computedHash[i]) throw new Error("QR code hash mismatch — invalid receipt")
  }

  // Parse fixed binary structure
  const requestedBy = readAscii(data, 1, 8)
  const signedBy = readAscii(data, 9, 8)
  const totalCounter = readUint32LE(data, 17)
  const transactionTypeCounter = readUint32LE(data, 21)
  const totalPara = readUint64LE(data, 25)   // in para (1/100 of 1/100 RSD = 1/10000 RSD)

  const totalRsd = totalPara / 10000

  // Serbian ESIR uses .NET DateTime.Ticks: 100-nanosecond intervals since 0001-01-01 UTC.
  // Convert to Unix ms before constructing Date.
  const tsTicks = readUint64LEBigInt(data, 33)
  const DOTNET_TO_UNIX_TICKS = 621355968000000000n
  const tsUnixMs = Number((tsTicks - DOTNET_TO_UNIX_TICKS) / 10000n)
  const dt = new Date(tsUnixMs)
  if (isNaN(dt.getTime())) throw new Error(`Invalid receipt timestamp: ${tsTicks}`)
  const date = dt.toISOString().slice(0, 10)
  const time = dt.toISOString().slice(11, 16)

  return {
    requestedBy,
    signedBy,
    totalCounter,
    transactionTypeCounter,
    totalRsd,
    date,
    time,
    receiptNumber: `${requestedBy}-${signedBy}-${totalCounter}`,
    vendorName: null,
    verificationUrl: url,
  }
}

export type VendorInfo = {
  name: string | null
  pib: string | null   // Serbian tax ID, 9 digits
}

// Small in-memory cache (per warm serverless instance) keyed by verification
// URL — avoids re-scraping PURS for the same receipt / store on repeat scans.
const vendorCache = new Map<string, VendorInfo>()

/**
 * Fetches the public PURS verification page and extracts vendor name + PIB.
 * Best-effort: cached, retried once, 6s timeout. Returns nulls on failure,
 * never throws.
 */
export async function fetchVendorInfo(verificationUrl: string): Promise<VendorInfo> {
  const cached = vendorCache.get(verificationUrl)
  if (cached) return cached

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(verificationUrl, {
        headers: { "Accept": "text/html", "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) continue
      const html = await res.text()

      // Vendor name patterns seen in the wild on suf.purs.gov.rs
      const namePatterns = [
        /Naziv prodajnog mesta[^>]*>[^<]*<[^>]*>([^<]+)</i,
        /Naziv obveznika[^>]*>[^<]*<[^>]*>([^<]+)</i,
        /<td[^>]*>\s*Naziv\s*<\/td>\s*<td[^>]*>([^<]+)<\/td>/i,
        /locationName["\s]*:["\s]*"([^"]+)"/i,
      ]
      let name: string | null = null
      for (const pat of namePatterns) {
        const m = html.match(pat)
        if (m?.[1]) { name = m[1].trim(); break }
      }

      // PIB patterns: "PIB: 123456789" or table cell after PIB label
      const pibPatterns = [
        /PIB[^>]*>[^<]*<[^>]*>(\d{8,13})</i,
        /PIB\s*:\s*(\d{8,13})/i,
        /<td[^>]*>\s*PIB\s*<\/td>\s*<td[^>]*>(\d{8,13})<\/td>/i,
      ]
      let pib: string | null = null
      for (const pat of pibPatterns) {
        const m = html.match(pat)
        if (m?.[1]) { pib = m[1].trim(); break }
      }

      const info: VendorInfo = { name, pib }
      if (name || pib) vendorCache.set(verificationUrl, info) // only cache successful resolutions
      return info
    } catch {
      // network/timeout — retry once, then give up
    }
  }
  return { name: null, pib: null }
}

/** @deprecated Use fetchVendorInfo instead */
export async function fetchVendorName(verificationUrl: string): Promise<string | null> {
  return (await fetchVendorInfo(verificationUrl)).name
}

// ── Helpers ───────────────────────────────────────────────────

function extractVlParam(url: string): string | null {
  try {
    const u = new URL(url)
    return u.searchParams.get("vl")
  } catch {
    // plain string — try regex
    const m = url.match(/[?&]vl=([^&]+)/)
    return m ? m[1] ?? null : null
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = Buffer.from(b64, "base64")
  return new Uint8Array(bin.buffer, bin.byteOffset, bin.byteLength)
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  return Buffer.from(bytes.slice(offset, offset + length)).toString("ascii").trim()
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset]! |
    (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) |
    (bytes[offset + 3]! << 24)) >>> 0
  )
}

function readUint64LE(bytes: Uint8Array, offset: number): number {
  const lo = readUint32LE(bytes, offset)
  const hi = readUint32LE(bytes, offset + 4)
  return hi * 0x100000000 + lo
}

function readUint64LEBigInt(bytes: Uint8Array, offset: number): bigint {
  const lo = BigInt(readUint32LE(bytes, offset))
  const hi = BigInt(readUint32LE(bytes, offset + 4))
  return (hi << 32n) | lo
}
