import { isSupportBotConfigured, supportBot } from "@pulse/bot/support"

export async function POST(req: Request) {
  if (!isSupportBotConfigured) {
    console.error("[support-bot] SUPPORT_TELEGRAM_BOT_TOKEN is not configured")
    return new Response("support bot is not configured", { status: 503 })
  }

  try {
    const body = await req.json()
    await supportBot.handleUpdate(body)
  } catch (e) {
    console.error("[support-bot] handleUpdate error:", e)
  }
  return new Response("ok")
}
