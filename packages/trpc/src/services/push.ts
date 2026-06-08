import type { db as PrismaDb } from "@pulse/db"
import { petStageForPoints } from "@pulse/shared"

type PushMessage = {
  to: string
  title: string
  body: string
  data?: Record<string, unknown> | undefined
}

export async function sendPush(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return
  try {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
    })
  } catch {
    // best-effort: never throw, push is non-critical
  }
}

export async function sendPushToUser(
  pushToken: string | null | undefined,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!pushToken) return
  await sendPush([{ to: pushToken, title, body, data }])
}

// Localized stage names for the evolution push. Egg has no push (it's the start).
const PET_STAGE_NAMES: Record<string, { EN: string; RU: string; SR: string }> = {
  HATCHLING: { EN: "Hatchling", RU: "Птенец", SR: "Pile" },
  KID: { EN: "Kid", RU: "Малыш", SR: "Mali" },
  FOX: { EN: "Fox", RU: "Лис", SR: "Lisica" },
  DRAGON: { EN: "Dragon", RU: "Дракон", SR: "Zmaj" },
  PHOENIX: { EN: "Phoenix", RU: "Феникс", SR: "Feniks" },
}

/**
 * Fire a push when freshly-earned points cross a pet evolution threshold.
 * Call AFTER the earning transaction commits. Best-effort — never throws.
 * `pointsAdded` is what was just credited to totalEarnedLifetime.
 */
export async function notifyPetEvolution(
  db: typeof PrismaDb,
  userId: string,
  pointsAdded: number,
): Promise<void> {
  if (pointsAdded <= 0) return
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { pushToken: true, language: true, petName: true, totalEarnedLifetime: true },
    })
    if (!user?.pushToken) return
    // Un-hatched pets (no name) still show as an egg — don't announce evolutions.
    if (!user.petName?.trim()) return

    const after = user.totalEarnedLifetime
    const before = after - pointsAdded
    const stageAfter = petStageForPoints(after)
    if (stageAfter.index <= petStageForPoints(before).index) return // no crossing

    const lang = (user.language ?? "EN") as "EN" | "RU" | "SR"
    const stageName = PET_STAGE_NAMES[stageAfter.key]?.[lang] ?? stageAfter.key
    const pet = user.petName

    const [title, body] = lang === "RU"
      ? ["✨ Питомец эволюционировал!", `${pet} теперь ${stageName}. Загляни в приложение!`]
      : lang === "SR"
      ? ["✨ Ljubimac je evoluirao!", `${pet} je sada ${stageName}. Otvori aplikaciju!`]
      : ["✨ Your pet evolved!", `${pet} is now a ${stageName}. Open the app to see!`]

    await sendPushToUser(user.pushToken, title, body, { type: "pet_evolution", stage: stageAfter.key })
  } catch {
    // never throw — push is non-critical
  }
}

/** Send a Markdown message to a Telegram chat. Best-effort — never throws. */
export async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId) return
  void fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  }).catch(() => {})
}
