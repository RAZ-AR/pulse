import { isPartnerBotConfigured, partnerBot } from "@pulse/bot/partner"

export async function POST(req: Request) {
  if (!isPartnerBotConfigured) {
    console.error("[partner-bot] PARTNER_TELEGRAM_BOT_TOKEN is not configured")
    return new Response("partner bot is not configured", { status: 503 })
  }

  try {
    const body = await req.json()
    await partnerBot.handleUpdate(body)
  } catch (e) {
    console.error("[partner-bot] handleUpdate error:", e)
  }
  return new Response("ok")
}
