/**
 * Send an error / problem report to the ayoo support bot.
 * Best-effort — never throws. Call from a "Report a problem" button or an
 * error boundary. Example: reportProblem("Scan failed", { screen: "scan" }).
 */
const API = process.env.EXPO_PUBLIC_API_URL ?? "https://api.ayoo.space"

export async function reportProblem(
  message: string,
  context?: Record<string, unknown>,
  userId?: string | null,
): Promise<void> {
  try {
    await fetch(`${API}/api/support-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        context: context ? JSON.stringify(context) : undefined,
        source: "mobile",
        userId: userId ?? undefined,
      }),
    })
  } catch {
    // ignore — reporting must never break the app
  }
}
