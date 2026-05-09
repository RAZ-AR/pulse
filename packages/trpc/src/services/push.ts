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
