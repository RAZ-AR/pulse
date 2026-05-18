import { PrismaClient } from "@pulse/db"
import { sendPushToUser, sendTelegram } from "./push"
import { BIRTHDAY_BONUS_POINTS } from "@pulse/shared"

const MESSAGES = {
  EN: (name: string) => ({
    push: { title: "🎂 Happy Birthday!", body: `${name}, you have +${BIRTHDAY_BONUS_POINTS} pts as a birthday gift!` },
    tg: `🎂 *Happy Birthday, ${name}!*\n\nAs a gift from ayoo — *+${BIRTHDAY_BONUS_POINTS} bonus points* have been added to your account.\n\nEnjoy your day! 🎉`,
  }),
  RU: (name: string) => ({
    push: { title: "🎂 С Днём Рождения!", body: `${name}, тебе подарок — +${BIRTHDAY_BONUS_POINTS} pts!` },
    tg: `🎂 *С Днём Рождения, ${name}!*\n\nПодарок от ayoo — *+${BIRTHDAY_BONUS_POINTS} бонусных баллов* уже на твоём счету.\n\nХорошего праздника! 🎉`,
  }),
  SR: (name: string) => ({
    push: { title: "🎂 Srećan Rođendan!", body: `${name}, poklon za tebe — +${BIRTHDAY_BONUS_POINTS} pts!` },
    tg: `🎂 *Srećan Rođendan, ${name}!*\n\nPoklон od ayoo — *+${BIRTHDAY_BONUS_POINTS} bonus bodova* je na tvom računu.\n\nUživaj u svom danu! 🎉`,
  }),
}

function isBirthdayToday(birthday: Date): boolean {
  const now = new Date()
  return birthday.getMonth() === now.getMonth() && birthday.getDate() === now.getDate()
}

export async function runBirthdayBonus(db: PrismaClient): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Find users whose birthday is today and haven't received bonus yet this year
  const users = await db.user.findMany({
    where: {
      birthday: { not: null },
      OR: [
        { lastBirthdayBonusAt: null },
        { lastBirthdayBonusAt: { lt: today } },
      ],
    },
    select: {
      id: true,
      name: true,
      birthday: true,
      language: true,
      pushToken: true,
      telegramId: true,
      lastBirthdayBonusAt: true,
    },
  })

  const birthday_users = users.filter((u) => u.birthday && isBirthdayToday(u.birthday))
  if (birthday_users.length === 0) return

  for (const u of birthday_users) {
    const lang = (u.language ?? "EN") as "EN" | "RU" | "SR"
    const msgs = MESSAGES[lang] ?? MESSAGES.EN
    const name = u.name ?? "Friend"
    const { push, tg } = msgs(name)

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: u.id },
        data: {
          earnedPoints: { increment: BIRTHDAY_BONUS_POINTS },
          totalEarnedLifetime: { increment: BIRTHDAY_BONUS_POINTS },
          lastBirthdayBonusAt: new Date(),
        },
      })
      await tx.transaction.create({
        data: {
          userId: u.id,
          type: "BIRTHDAY",
          pointsEarned: BIRTHDAY_BONUS_POINTS,
          status: "VERIFIED",
          verifiedAt: new Date(),
        },
      })
    })

    void sendPushToUser(u.pushToken, push.title, push.body)
    if (u.telegramId) void sendTelegram(u.telegramId, tg)
  }

  console.log(`[birthday-cron] Awarded bonus to ${birthday_users.length} user(s)`)
}
