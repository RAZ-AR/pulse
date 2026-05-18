import { bot } from "@pulse/bot"

export async function POST(req: Request) {
  try {
    const body = await req.json()
    await bot.handleUpdate(body)
  } catch (e) {
    console.error("[bot] handleUpdate error:", e)
  }
  return new Response("ok")
}
