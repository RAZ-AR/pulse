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

  if (bytes.length < 572 || bytes.length > 848) {
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
  const tsMs = readUint64LE(data, 33)        // unix ms

  const totalRsd = totalPara / 10000

  const dt = new Date(tsMs)
  // Serbia is UTC+1 (winter) / UTC+2 (summer); simplest: use ISO and slice
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

// Fetches the public PURS verification page and extracts vendor name.
// This is always a public page — no auth required.
export async function fetchVendorName(verificationUrl: string): Promise<string | null> {
  try {
    const res = await fetch(verificationUrl, {
      headers: { "Accept": "text/html", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const html = await res.text()

    // The page renders fields like "Naziv prodajnog mesta" or "Naziv" in a table
    // Patterns seen in the wild:
    const patterns = [
      /Naziv prodajnog mesta[^>]*>[^<]*<[^>]*>([^<]+)</i,
      /Naziv obveznika[^>]*>[^<]*<[^>]*>([^<]+)</i,
      /<td[^>]*>\s*Naziv\s*<\/td>\s*<td[^>]*>([^<]+)<\/td>/i,
      /locationName["\s]*:["\s]*"([^"]+)"/i,
    ]
    for (const pat of patterns) {
      const m = html.match(pat)
      if (m?.[1]) return m[1].trim()
    }
    return null
  } catch {
    return null
  }
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
  // Safe for values up to 2^53 — enough for timestamps and RSD amounts
  return hi * 0x100000000 + lo
}
