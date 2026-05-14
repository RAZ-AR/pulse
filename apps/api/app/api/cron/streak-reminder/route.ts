import { verifyQStashSignature, verifyCronSecret } from "../_verify"
import { PrismaClient } from "@pulse/db"

const db = new PrismaClient()

async function run() {
  const now = new Date()
  // Streak breaks at 36h — warn users between 34h and 36h
  const warnAfter = new Date(now.getTime() - 34 * 3_600_000)
  const warnBefore = new Date(now.getTime() - 36 * 3_600_000)

  const atRisk = await db.user.findMany({
    where: {
      currentStreak: { gt: 0 },
      pushToken: { not: null },
      lastCheckinAt: {
        lt: warnAfter,
        gt: warnBefore,
      },
    },
    select: { id: true, pushToken: true, currentStreak: true },
  })

  if (atRisk.length === 0) return { sent: 0, total: 0 }

  const messages = atRisk.map((u) => ({
    to: u.pushToken!,
    title: "⚡ Streak at risk!",
    body: `Your ${u.currentStreak}-day streak expires in ~2h. Check in now to keep it alive.`,
    data: { screen: "checkin" },
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

// Called daily at 10:00 UTC via Vercel cron (GET) or QStash (POST).
// Finds users whose streak would break within 2h and sends a push reminder.
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
