import Anthropic from "@anthropic-ai/sdk"

export type VerifyResult = {
  isAuthentic: boolean
  confidence: number
  reason: string
}

const VERIFY_PROMPT = `Is this image a genuine receipt photo from a physical venue?

Check:
1. Real photo — not a screenshot, not a digital render, not an edited image
2. Actually a receipt or bill document (not just any paper)
3. Not a photo of a screen showing a receipt (POS terminal, phone display)
4. Not sourced from the internet (no watermarks, no image-search-style cropping)

Return ONLY this JSON (no other text):
{"is_authentic": boolean, "confidence": 0.0_to_1.0, "reason": "one short sentence"}`

export async function verifyReceiptPhoto(imageUrl: string): Promise<VerifyResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Dev fallback: skip verification if no key configured
    return { isAuthentic: true, confidence: 1, reason: "verification_skipped_no_key" }
  }

  const client = new Anthropic()

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 150,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          { type: "text", text: VERIFY_PROMPT },
        ],
      },
    ],
  })

  const block = message.content[0]
  if (block?.type !== "text") throw new Error("Unexpected Claude response type")

  type Parsed = { is_authentic: boolean; confidence: number; reason: string }
  const parsed = JSON.parse(block.text) as Parsed

  return {
    isAuthentic: parsed.is_authentic,
    confidence: parsed.confidence,
    reason: parsed.reason,
  }
}
