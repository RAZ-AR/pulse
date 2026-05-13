import { createHash } from "node:crypto"
import Anthropic from "@anthropic-ai/sdk"

// ── Types ─────────────────────────────────────────────────────

export type OcrReceiptData = {
  vendor: string | null
  total: number | null
  currency: string | null
  date: string | null   // ISO YYYY-MM-DD
  time: string | null   // HH:MM
  receiptNumber: string | null
}

export type OcrResult = {
  data: OcrReceiptData
  confidence: number   // 0–1
  source: "claude" | "google_vision"
}

// ── Prompts ───────────────────────────────────────────────────

const OCR_PROMPT = `You process a receipt photo from a venue in Serbia, Russia, or Armenia.
Extract exactly these fields and return ONLY valid JSON:
{
  "vendor": string or null,
  "total": number or null (final total, NOT subtotals),
  "currency": "RSD"|"EUR"|"AMD"|"RUB"|"USD" or null,
  "date": "YYYY-MM-DD" or null,
  "time": "HH:MM" or null,
  "receiptNumber": string or null
}
If a field is unreadable use null. Do NOT invent values.
For total: use "ukupno", "total", "итого", "ընդամենը" — the bottom line.`

// ── Claude (primary) ──────────────────────────────────────────

async function fetchAsBase64(url: string): Promise<{ data: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" }> {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const ct = res.headers.get("content-type") ?? "image/jpeg"
  const mediaType = (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(ct) ? ct : "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp"
  return { data: Buffer.from(buf).toString("base64"), mediaType }
}

export async function extractWithClaude(imageUrl: string): Promise<OcrResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const img = await fetchAsBase64(imageUrl)

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
          { type: "text", text: OCR_PROMPT },
        ],
      },
    ],
  })

  const block = message.content[0]
  if (!block || block.type !== "text") throw new Error("Claude returned no text")

  const jsonMatch = block.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error("Claude returned no JSON")

  const parsed = JSON.parse(jsonMatch[0]) as OcrReceiptData
  return { data: parsed, confidence: computeConfidence(parsed), source: "claude" }
}

// ── Google Vision (fallback) ──────────────────────────────────

export async function extractWithGoogleVision(imageUrl: string): Promise<OcrResult> {
  const key = process.env.GOOGLE_CLOUD_API_KEY
  if (!key) throw new Error("GOOGLE_CLOUD_API_KEY not set")

  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ image: { source: { imageUri: imageUrl } }, features: [{ type: "TEXT_DETECTION" }] }],
    }),
  })

  if (!res.ok) throw new Error(`Google Vision HTTP ${res.status}`)

  type VisionResponse = { responses: [{ fullTextAnnotation?: { text: string } }] }
  const body = await res.json() as VisionResponse
  const rawText = body.responses[0]?.fullTextAnnotation?.text ?? ""
  const data = parseRawText(rawText)

  return { data, confidence: computeConfidence(data) * 0.85, source: "google_vision" }
}

// ── Main entrypoint ───────────────────────────────────────────

export async function extractReceiptData(imageUrl: string): Promise<OcrResult> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await extractWithClaude(imageUrl)
    } catch (e) {
      console.error("[OCR] Claude failed, falling back:", e)
    }
  }

  if (process.env.GOOGLE_CLOUD_API_KEY) {
    return await extractWithGoogleVision(imageUrl)
  }

  throw new Error("No OCR provider configured. Set ANTHROPIC_API_KEY or GOOGLE_CLOUD_API_KEY.")
}

// ── Receipt hash (anti-fraud dedup) ──────────────────────────

export function computeReceiptHash(data: {
  vendor: string
  total: number
  currency: string
  date: string
  receiptNumber?: string | null
}): string {
  const normalized = [
    data.vendor.toLowerCase().replace(/\s+/g, ""),
    data.date,
    String(Math.round(data.total * 100)), // avoid float precision issues
    data.currency.toUpperCase(),
    data.receiptNumber ? data.receiptNumber.slice(-4) : "",
  ].join("|")

  return createHash("sha256").update(normalized).digest("hex")
}

// ── Helpers ───────────────────────────────────────────────────

function computeConfidence(data: OcrReceiptData): number {
  const criticalFields = [data.vendor, data.total, data.currency, data.date]
  const filled = criticalFields.filter((f) => f !== null).length
  return filled / criticalFields.length
}

function parseRawText(text: string): OcrReceiptData {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)

  const totalPatterns = [
    /(?:total|ukupno|итого|ընդամենը)[:\s]+([0-9][0-9.,]*)/i,
    /([0-9][0-9.,]{2,})\s*(?:rsd|din|рсд)/i,
  ]
  let total: number | null = null
  for (const pat of totalPatterns) {
    for (const line of lines) {
      const m = line.match(pat)
      if (m?.[1]) { total = parseFloat(m[1].replace(",", ".")); break }
    }
    if (total !== null) break
  }

  let date: string | null = null
  for (const line of lines) {
    const m = line.match(/(\d{4}-\d{2}-\d{2}|\d{2}[./]\d{2}[./]\d{4})/)
    if (m?.[1]) {
      const raw = m[1]
      if (raw.includes("-")) {
        date = raw
      } else {
        const sep = raw.includes(".") ? "." : "/"
        const [d, mo, y] = raw.split(sep)
        date = `${y}-${mo?.padStart(2, "0")}-${d?.padStart(2, "0")}`
      }
      break
    }
  }

  const t = text.toLowerCase()
  let currency: string | null = null
  if (t.includes("rsd") || t.includes("din")) currency = "RSD"
  else if (t.includes("eur") || t.includes("€")) currency = "EUR"
  else if (t.includes("amd") || t.includes("֏")) currency = "AMD"
  else if (t.includes("rub") || t.includes("руб")) currency = "RUB"

  return { vendor: lines[0] ?? null, total, currency, date, time: null, receiptNumber: null }
}
