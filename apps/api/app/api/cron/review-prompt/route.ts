import { verifyQStashSignature, verifyCronSecret } from "../_verify"
import { PrismaClient } from "@pulse/db"

const db = new PrismaClient()

const VISIT_TYPES = ["RECEIPT_SCAN", "CHECKIN_PHOTO", "PARTNER_PURCHASE"] as const
const REVIEW_POINTS = 25

// Daily: nudge users who visited a venue ~yesterday but haven't reviewed it.
// The visit window is a band so each daily run catches a visit once.
async function run() {
  const now = Date.now()
  const from = new Date(now - 30 * 3_600_000)
  const to = new Date(now - 24 * 3_600_000)

  const visits = await db.transaction.findMany({
    where: {
      type: { in: [...VISIT_TYPES] },
      venueId: { not: null },
      status: "VERIFIED",
      createdAt: { gte: from, lt: to },
      user: { pushToken: { not: null } },
    },
    select: {
      userId: true,
      venueId: true,
      user: { select: { pushToken: true, language: true } },
      venue: { select: { name: true } },
    },
  })
  if (visits.length === 0) return { sent: 0, candidates: 0 }

  // Distinct (user, venue) pairs.
  const pairs = new Map<string, (typeof visits)[number]>()
  for (const v of visits) pairs.set(`${v.userId}:${v.venueId}`, v)

  // Drop pairs the user already reviewed.
  const reviewed = await db.review.findMany({
    where: { OR: [...pairs.values()].map((v) => ({ userId: v.userId, venueId: v.venueId! })) },
    select: { userId: true, venueId: true },
  })
  for (const r of reviewed) pairs.delete(`${r.userId}:${r.venueId}`)

  const messages = [...pairs.values()].map((v) => {
    const lang = String(v.user.language ?? "en").toLowerCase()
    const name = v.venue?.name ?? "this place"
    const title = lang === "ru" ? "Как тебе там?" : lang === "sr" ? "Kako je bilo?" : "How was it?"
    const body =
      lang === "ru" ? `Оставь отзыв о «${name}» и получи +${REVIEW_POINTS} баллов 🎁`
      : lang === "sr" ? `Oceni „${name}" i osvoji +${REVIEW_POINTS} bodova 🎁`
      : `Review ${name} and earn +${REVIEW_POINTS} points 🎁`
    return { to: v.user.pushToken!, title, body, data: { screen: "venue", venueId: v.venueId } }
  })

  let sent = 0
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100)
    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      })
      sent += chunk.length
    } catch { /* best-effort */ }
  }

  return { sent, candidates: pairs.size }
}

export async function GET(req: Request) {
  const err = verifyCronSecret(req)
  if (err) return err
  return Response.json(await run())
}

export async function POST(req: Request) {
  const err = await verifyQStashSignature(req)
  if (err) return err
  return Response.json(await run())
}
