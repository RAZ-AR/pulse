import { verifyQStashSignature, verifyCronSecret } from "../_verify"
import { PrismaClient } from "@pulse/db"

const db = new PrismaClient()

async function run() {
  const now = new Date()
  // Warn users whose welcome points expire in the next 3 days
  const warnFrom = new Date(now.getTime() + 3 * 86_400_000)
  const warnUntil = new Date(now.getTime() + 4 * 86_400_000)

  const atRisk = await db.user.findMany({
    where: {
      welcomePoints: { gt: 0 },
      pushToken: { not: null },
      welcomeExpiresAt: { gte: warnFrom, lt: warnUntil },
    },
    select: { id: true, pushToken: true, welcomePoints: true },
  })

  if (atRisk.length === 0) return { sent: 0, total: 0 }

  const messages = atRisk.map((u) => ({
    to: u.pushToken!,
    title: "⏳ Welcome points expiring soon",
    body: `Your ${u.welcomePoints} welcome points expire in 3 days. Redeem them before they're gone!`,
    data: { screen: "rewards" },
  }))

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
    } catch {
      // best-effort
    }
  }

  return { sent, total: atRisk.length }
}

// Runs daily at 09:00 UTC — warns users 3 days before welcome points expire.
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
