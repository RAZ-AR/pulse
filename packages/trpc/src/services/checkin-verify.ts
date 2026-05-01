import Anthropic from "@anthropic-ai/sdk"

export type CheckinVerifyResult = {
  isValid: boolean
  confidence: number
  reason: string
}

const PROMPT = `Is this photo taken at a physical venue (café, restaurant, shop, or similar)?

Check:
1. Photo shows an interior or exterior of a real brick-and-mortar venue
2. Not a stock photo, screenshot, or image sourced from the internet
3. Not a photo of a menu, receipt, or sign only — must show the actual space
4. Not an obvious duplicate or edited version of a previously submitted photo

Return ONLY this JSON:
{"is_valid": boolean, "confidence": 0.0_to_1.0, "reason": "one short sentence"}`

async function fetchAsBase64(url: string): Promise<{ data: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" }> {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const ct = res.headers.get("content-type") ?? "image/jpeg"
  const mediaType = (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(ct) ? ct : "image/jpeg") as "image/jpeg" | "image/png" | "image/gif" | "image/webp"
  return { data: Buffer.from(buf).toString("base64"), mediaType }
}

export async function verifyCheckinPhoto(photoUrl: string): Promise<CheckinVerifyResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { isValid: true, confidence: 1, reason: "verification_skipped_no_key" }
  }

  const client = new Anthropic()
  const img = await fetchAsBase64(photoUrl)

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  })

  const block = message.content[0]
  if (block?.type !== "text") throw new Error("Unexpected Claude response type")

  type Parsed = { is_valid: boolean; confidence: number; reason: string }
  const parsed = JSON.parse(block.text) as Parsed

  return { isValid: parsed.is_valid, confidence: parsed.confidence, reason: parsed.reason }
}
