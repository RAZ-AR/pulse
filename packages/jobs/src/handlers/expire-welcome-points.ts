import { db } from "@pulse/db"

// Runs daily — zeros out expired welcome points and notifies affected users
export async function expireWelcomePoints() {
  const now = new Date()

  const expiring = await db.user.findMany({
    where: {
      welcomePoints: { gt: 0 },
      welcomeExpiresAt: { lte: now },
    },
    select: { id: true, pushToken: true, welcomePoints: true },
  })

  if (expiring.length === 0) return { expired: 0 }

  await db.user.updateMany({
    where: { id: { in: expiring.map((u) => u.id) } },
    data: { welcomePoints: 0 },
  })

  const withToken = expiring.filter((u) => u.pushToken)
  if (withToken.length > 0) {
    const messages = withToken.map((u) => ({
      to: u.pushToken!,
      title: "Welcome points expired",
      body: `Your ${u.welcomePoints} welcome points have expired. Earn more with check-ins and receipts!`,
      data: { screen: "earn" },
    }))

    for (let i = 0; i < messages.length; i += 100) {
      try {
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(messages.slice(i, i + 100)),
        })
      } catch {
        // best-effort
      }
    }
  }

  return { expired: expiring.length }
}
