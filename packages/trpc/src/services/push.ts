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
