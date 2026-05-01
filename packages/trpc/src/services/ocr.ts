import { createHash } from "node:crypto"
import OpenAI from "openai"

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
  source: "gpt4o" | "google_vision"
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

// ── GPT-4o (primary) ──────────────────────────────────────────

export async function extractWithGpt4o(imageUrl: string): Promise<OcrResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    max_tokens: 400,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
          { type: "text", text: OCR_PROMPT },
        ],
      },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error("GPT-4o returned empty response")

  const parsed = JSON.parse(content) as OcrReceiptData
  const confidence = computeConfidence(parsed)

  return { data: parsed, confidence, source: "gpt4o" }
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

  // Google Vision raw-text parsing is less reliable — cap confidence
  return { data, confidence: computeConfidence(data) * 0.85, source: "google_vision" }
}

// ── Main entrypoint ───────────────────────────────────────────

export async function extractReceiptData(imageUrl: string): Promise<OcrResult> {
  if (process.env.OPENAI_API_KEY) {
    try {
      return await extractWithGpt4o(imageUrl)
    } catch (e) {
      console.error("[OCR] GPT-4o failed, falling back:", e)
    }
  }

  if (process.env.GOOGLE_CLOUD_API_KEY) {
    return await extractWithGoogleVision(imageUrl)
  }

  throw new Error("No OCR provider configured. Set OPENAI_API_KEY or GOOGLE_CLOUD_API_KEY.")
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

  // Total amount
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

  // Date
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

  // Currency
  const t = text.toLowerCase()
  let currency: string | null = null
  if (t.includes("rsd") || t.includes("din")) currency = "RSD"
  else if (t.includes("eur") || t.includes("€")) currency = "EUR"
  else if (t.includes("amd") || t.includes("֏")) currency = "AMD"
  else if (t.includes("rub") || t.includes("руб")) currency = "RUB"

  return { vendor: lines[0] ?? null, total, currency, date, time: null, receiptNumber: null }
}
