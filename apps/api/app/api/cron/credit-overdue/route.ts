import { verifyQStashSignature, verifyCronSecret } from "../_verify"
import { PrismaClient } from "@pulse/db"

const db = new PrismaClient()

// Уведомляет мерчантов с просроченным непогашенным кредитом.
// Блокировка начислений уже происходит автоматически (assertMerchantCanAward).
async function run() {
  const botToken = process.env.PARTNER_TELEGRAM_BOT_TOKEN
  const now = new Date()

  const overdue = await db.merchant.findMany({
    where: {
      creditDueAt: { lt: now },
      pointsBalance: { lt: 0 },
      telegramChatId: { not: null },
    },
    select: { id: true, name: true, pointsBalance: true, telegramChatId: true },
  })

  let sent = 0
  if (botToken) {
    for (const m of overdue) {
      const debt = Math.abs(m.pointsBalance)
      const text = [
        `⚠️ *Кредит просрочен — ${m.name}*`,
        ``,
        `Задолженность: *${debt} баллов*.`,
        `Начисление баллов клиентам приостановлено до пополнения баланса.`,
      ].join("\n")
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: m.telegramChatId, text, parse_mode: "Markdown" }),
      })
      sent++
    }
  }

  return { overdue: overdue.length, sent }
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
