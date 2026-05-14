import { createHmac } from "node:crypto"

/**
 * Verifies the Upstash QStash HMAC signature.
 * Returns a Response (401) if invalid, null if valid.
 * In development without QSTASH_CURRENT_SIGNING_KEY set, always passes.
 */
export async function verifyQStashSignature(req: Request): Promise<Response | null> {
  const signingKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  if (!signingKey) return null // dev: skip verification

  const signature = req.headers.get("upstash-signature")
  if (!signature) return new Response("Missing signature", { status: 401 })

  const body = await req.text()
  const expected = createHmac("sha256", signingKey).update(body).digest("base64url")

  // QStash sends a JWT — extract the payload signature portion for comparison
  // The signature header is a JWT: header.payload.signature
  const parts = signature.split(".")
  const receivedSig = parts[2]

  if (!receivedSig || !timingSafeEqual(expected, receivedSig)) {
    return new Response("Invalid signature", { status: 401 })
  }

  return null
}

/**
 * Verifies the Vercel native cron secret.
 * Returns a Response (401) if invalid, null if valid.
 * If CRON_SECRET is not set, always passes (dev/no-auth mode).
 */
export function verifyCronSecret(req: Request): Response | null {
  const secret = process.env.CRON_SECRET
  if (!secret) return null
  const auth = req.headers.get("Authorization")
  if (auth !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 })
  return null
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}
