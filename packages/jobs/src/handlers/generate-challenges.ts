import { db } from "@pulse/db"

type WeekTemplate = {
  type: "VISIT_N_VENUES" | "SPEND_AMOUNT" | "STREAK"
  title: string
  description: string
  rules: Record<string, number>
  pointsReward: number
}

const WEEKLY_TEMPLATES: WeekTemplate[][] = [
  [
    { type: "VISIT_N_VENUES", title: "Explorer", description: "Visit 3 partner venues this week", rules: { count: 3 }, pointsReward: 50 },
    { type: "SPEND_AMOUNT", title: "Big Spender", description: "Spend 1500 RSD at partner venues this week", rules: { threshold: 1500 }, pointsReward: 75 },
    { type: "STREAK", title: "Consistent", description: "Maintain a 3-day check-in streak", rules: { days: 3 }, pointsReward: 40 },
  ],
  [
    { type: "VISIT_N_VENUES", title: "Nomad", description: "Visit 5 partner venues this week", rules: { count: 5 }, pointsReward: 80 },
    { type: "SPEND_AMOUNT", title: "Loyal Customer", description: "Spend 2500 RSD at partner venues this week", rules: { threshold: 2500 }, pointsReward: 100 },
    { type: "STREAK", title: "On a Roll", description: "Maintain a 5-day check-in streak", rules: { days: 5 }, pointsReward: 70 },
  ],
  [
    { type: "VISIT_N_VENUES", title: "Adventurer", description: "Visit 4 partner venues this week", rules: { count: 4 }, pointsReward: 60 },
    { type: "SPEND_AMOUNT", title: "Weekend Warrior", description: "Spend 2000 RSD at partner venues this week", rules: { threshold: 2000 }, pointsReward: 85 },
    { type: "STREAK", title: "Dedicated", description: "Maintain a 4-day check-in streak", rules: { days: 4 }, pointsReward: 55 },
  ],
  [
    { type: "VISIT_N_VENUES", title: "Super Explorer", description: "Visit 7 partner venues this week", rules: { count: 7 }, pointsReward: 120 },
    { type: "SPEND_AMOUNT", title: "High Roller", description: "Spend 3000 RSD at partner venues this week", rules: { threshold: 3000 }, pointsReward: 150 },
    { type: "STREAK", title: "Iron Will", description: "Maintain a 7-day check-in streak", rules: { days: 7 }, pointsReward: 100 },
  ],
]

function getWeekBounds(from: Date): { startDate: Date; endDate: Date } {
  const startDate = new Date(from)
  // Monday 00:00 UTC
  const day = startDate.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  startDate.setUTCDate(startDate.getUTCDate() + diff)
  startDate.setUTCHours(0, 0, 0, 0)

  const endDate = new Date(startDate)
  endDate.setUTCDate(endDate.getUTCDate() + 6)
  endDate.setUTCHours(23, 59, 59, 999)

  return { startDate, endDate }
}

export async function generateWeeklyChallenges() {
  const now = new Date()
  const { startDate, endDate } = getWeekBounds(now)

  // Idempotent: skip if already generated for this week
  const existing = await db.challenge.count({
    where: { startDate: { gte: startDate }, endDate: { lte: endDate } },
  })
  if (existing > 0) {
    return { created: 0, skipped: true, reason: "already_exists" }
  }

  // Pick template set by week number (0-3 rotation)
  const weekNum = Math.floor(startDate.getTime() / (7 * 24 * 3_600_000))
  const templates = WEEKLY_TEMPLATES[weekNum % WEEKLY_TEMPLATES.length]!

  await db.challenge.createMany({
    data: templates.map((t) => ({
      title: t.title,
      description: t.description,
      type: t.type,
      rules: t.rules,
      pointsReward: t.pointsReward,
      startDate,
      endDate,
      isGlobal: true,
    })),
  })

  return { created: templates.length, weekStart: startDate.toISOString() }
}
