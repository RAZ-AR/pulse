import { verifyQStashSignature } from "../_verify"
import { PrismaClient } from "@pulse/db"

const db = new PrismaClient()

export async function POST(req: Request) {
  const err = await verifyQStashSignature(req)
  if (err) return err

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return Response.json({ error: "No bot token" }, { status: 500 })

  const now = new Date()
  const weekFromNow = new Date(now.getTime() + 7 * 24 * 3600 * 1000)

  const merchants = await db.merchant.findMany({
    where: { status: "ACTIVE", telegramChatId: { not: null } },
    include: {
      offers: {
        where: { active: true },
        select: { id: true, title: true, endsAt: true, usageLimit: true, usageCount: true },
      },
    },
  })

  let sent = 0
  for (const merchant of merchants) {
    if (!merchant.telegramChatId) continue

    const activeOffers = merchant.offers.filter(
      (o) => !o.endsAt || o.endsAt > now
    )
    const expiringSoon = merchant.offers.filter(
      (o) => o.endsAt && o.endsAt > now && o.endsAt <= weekFromNow
    )

    const lines = [
      `☀️ *Доброе воскресенье, ${merchant.name}!*\n`,
      `💎 Ваш баланс: *${merchant.pointsBalance} баллов*`,
      `📋 Активных акций: *${activeOffers.length}*`,
    ]

    if (expiringSoon.length > 0) {
      lines.push(`\n⚠️ Акции, истекающие на этой неделе:`)
      expiringSoon.forEach((o) => {
        const date = o.endsAt!.toLocaleDateString("ru-RU")
        lines.push(`• ${o.title} — до ${date}`)
      })
    }

    lines.push(`\nАктуализируйте акции:\n/newoffer — создать новую\n/offers — посмотреть все`)

    const text = lines.join("\n")

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: merchant.telegramChatId,
        text,
        parse_mode: "Markdown",
      }),
    })

    sent++
  }

  return Response.json({ sent })
}
