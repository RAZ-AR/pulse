import { Telegraf } from "telegraf"
import { db } from "./lib/db"
import { runBirthdayBonus } from "./lib/birthday-cron"

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set")

const bot = new Telegraf(token)

function botLang(code: string | undefined): "ru" | "sr" | "en" {
  if (!code) return "en"
  if (code.startsWith("ru")) return "ru"
  if (code.startsWith("sr") || code.startsWith("bs") || code.startsWith("hr")) return "sr"
  return "en"
}

const WELCOME = {
  ru: (name: string) => `👋 Привет, ${name}!\n\nДобро пожаловать в *ayoo* — программа лояльности, где заведения соревнуются за тебя баллами.\n\n🎁 Тебя ждут *500 приветственных баллов* — открой приложение, чтобы активировать их!`,
  sr: (name: string) => `👋 Zdravo, ${name}!\n\nDobrodošao u *ayoo* — program lojalnosti gde mesta se takmiče za tebe bodovima.\n\n🎁 Čeka te *500 dobrodošlica bodova* — otvori aplikaciju da ih aktiviraš!`,
  en: (name: string) => `👋 Hi, ${name}!\n\nWelcome to *ayoo* — a loyalty app where venues compete for you with points.\n\n🎁 *500 welcome points* are waiting for you — open the app to activate them!`,
}

const WELCOME_BACK = {
  ru: (name: string) => `👋 С возвращением, ${name}! Открой приложение, чтобы посмотреть свои баллы.`,
  sr: (name: string) => `👋 Dobrodošao nazad, ${name}! Otvori aplikaciju da vidiš svoje bodove.`,
  en: (name: string) => `👋 Welcome back, ${name}! Open the app to check your points.`,
}

const OPEN_BTN = { ru: "🚀 Открыть ayoo", sr: "🚀 Otvori ayoo", en: "🚀 Open ayoo" }

bot.start(async (ctx) => {
  const payload = ctx.payload?.trim()
  const lang = botLang(ctx.from.language_code)
  const miniAppUrl = process.env.MINI_APP_URL ?? "https://t.me/ayoo_loyalty_bot/app"

  if (payload?.startsWith("gift_")) {
    const token = payload.slice(5)
    const telegramId = String(ctx.from.id)

    const user = await db.user.findUnique({
      where: { telegramId },
      select: { id: true, onboardingDone: true },
    })

    if (!user || !user.onboardingDone) {
      const giftTexts = {
        ru: "🎁 Тебе подарили баллы ayoo! Открой приложение, чтобы получить их.",
        sr: "🎁 Poklonili su ti ayoo bodove! Otvori aplikaciju da ih preuzmеš.",
        en: "🎁 Someone gifted you ayoo points! Open the app to claim them.",
      }
      await ctx.reply(giftTexts[lang], {
        reply_markup: {
          inline_keyboard: [[{
            text: OPEN_BTN[lang],
            web_app: { url: `${miniAppUrl}?startapp=gift_${token}` },
          }]],
        },
      })
      return
    }

    const link = await db.giftLink.findUnique({
      where: { token },
      select: { id: true, senderId: true, amount: true, status: true, expiresAt: true },
    })

    if (!link) {
      await ctx.reply("❌ Ссылка не найдена или уже истекла.")
      return
    }
    if (link.status !== "PENDING") {
      await ctx.reply(link.status === "CLAIMED" ? "✅ Эти баллы уже были получены." : "❌ Ссылка истекла.")
      return
    }
    if (link.expiresAt < new Date()) {
      await db.giftLink.update({ where: { id: link.id }, data: { status: "EXPIRED" } })
      await ctx.reply("❌ Срок действия ссылки истёк.")
      return
    }
    if (link.senderId === user.id) {
      await ctx.reply("❌ Нельзя получить свой собственный подарок.")
      return
    }

    await db.$transaction(async (tx) => {
      await tx.giftLink.update({
        where: { id: link.id },
        data: { status: "CLAIMED", recipientId: user.id, claimedAt: new Date() },
      })
      await tx.user.update({
        where: { id: user.id },
        data: {
          earnedPoints: { increment: link.amount },
          totalEarnedLifetime: { increment: link.amount },
        },
      })
      await tx.transaction.create({
        data: {
          userId: user.id,
          type: "GIFT_RECEIVED",
          pointsEarned: link.amount,
          status: "VERIFIED",
          verifiedAt: new Date(),
        },
      })
    })

    await ctx.reply(`🎁 Отлично! *+${link.amount} баллов* зачислено на твой счёт ayoo!`, { parse_mode: "Markdown" })
    return
  }

  const firstName = ctx.from.first_name ?? "friend"
  const telegramId = String(ctx.from.id)
  const user = await db.user.findUnique({
    where: { telegramId },
    select: { onboardingDone: true },
  })

  await ctx.reply(user?.onboardingDone ? WELCOME_BACK[lang](firstName) : WELCOME[lang](firstName), {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[{
        text: OPEN_BTN[lang],
        web_app: { url: miniAppUrl },
      }]],
    },
  })
})

function scheduleDailyAt(hour: number, minute: number, task: () => void) {
  function msUntilNext() {
    const now = new Date()
    const next = new Date(now)
    next.setHours(hour, minute, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    return next.getTime() - now.getTime()
  }
  setTimeout(function run() {
    task()
    setTimeout(run, msUntilNext())
  }, msUntilNext())
}

export function startBot() {
  const webhookUrl = process.env.BOT_WEBHOOK_URL

  if (webhookUrl) {
    bot.telegram.setWebhook(webhookUrl).then(() => {
      console.log(`[bot] Webhook set: ${webhookUrl}`)
    })
  } else {
    bot.launch().then(() => {
      console.log("[bot] Started in polling mode")
    })
  }

  scheduleDailyAt(9, 0, () => {
    runBirthdayBonus(db).catch((e) => console.error("[birthday-cron] error:", e))
  })

  process.once("SIGINT", () => bot.stop("SIGINT"))
  process.once("SIGTERM", () => bot.stop("SIGTERM"))
}

if (require.main === module) {
  startBot()
}

export { bot }
