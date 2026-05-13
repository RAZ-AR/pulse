import { bot } from "@pulse/bot"

export async function POST(req: Request) {
  const body = await req.json()
  await bot.handleUpdate(body)
  return new Response("ok")
}
