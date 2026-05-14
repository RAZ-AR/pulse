import { Telegraf, Scenes, session, type Context as TelegrafContext } from "telegraf"
import { db } from "./lib/db"
import { registerScene } from "./scenes/register"
import { newOfferScene } from "./scenes/new-offer"
import { acceptPaymentScene } from "./scenes/accept-payment"
import type { Merchant } from "@pulse/db"

// ── Типы контекста ────────────────────────────────────────

export interface WizardState extends Scenes.WizardSessionData {
  name: string
  address: string
  taxId: string
  venueId: string
  venueName: string
  venues: { id: string; name: string }[]
  title: string
  pointsReward: number
  endsAt?: string
  userId: string
  userName: string
  userPoints: number
  amount: number
}

interface SessionData extends Scenes.WizardSession<WizardState> {
  merchant?: Merchant & { pointsBalance: number }
}

export interface Context extends Scenes.WizardContext<WizardState> {
  session: SessionData
  merchantData?: Merchant & { pointsBalance: number }
}

// ── Инициализация ─────────────────────────────────────────

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set")

const bot = new Telegraf<Context>(token)

const stage = new Scenes.Stage<Context>([
  registerScene,
  newOfferScene,
  acceptPaymentScene,
])

bot.use(session())
bot.use(stage.middleware())

// ── Middleware: загрузить партнёра ────────────────────────

bot.use(async (ctx, next) => {
  if (!ctx.chat) return next()
  const chatId = String(ctx.chat.id)
  const merchant = await db.merchant.findUnique({ where: { telegramChatId: chatId } })
  if (merchant) ctx.merchantData = merchant as Context["state"]["merchant"]
  return next()
})

// ── /start ────────────────────────────────────────────────

bot.start(async (ctx) => {
  const merchant = ctx.merchantData

  if (!merchant) {
    await ctx.reply(
      `👋 Привет! Это партнёрский бот PULSE.\n\n` +
      `Хотите участвовать в программе лояльности и привлекать новых клиентов?\n\n` +
      `Нажмите /register чтобы начать регистрацию.`
    )
    return
  }

  if (merchant.status === "PENDING") {
    await ctx.reply("⏳ Ваша заявка на рассмотрении. Мы сообщим вам об активации.")
    return
  }

  await ctx.reply(
    `👋 С возвращением, *${merchant.name}*!\n\n` +
    `💎 Ваш баланс: *${merchant.pointsBalance} баллов*\n\n` +
    `/newoffer — создать акцию\n` +
    `/offers — мои акции\n` +
    `/balance — баланс\n` +
    `/redeem — принять оплату баллами`,
    { parse_mode: "Markdown" }
  )
})

// ── /register ─────────────────────────────────────────────

bot.command("register", async (ctx) => {
  if (ctx.merchantData) {
    await ctx.reply("Вы уже зарегистрированы. Используйте /offers или /newoffer.")
    return
  }
  return ctx.scene.enter("register")
})

// ── /newoffer ─────────────────────────────────────────────

bot.command("newoffer", async (ctx) => {
  if (!ctx.merchantData) return ctx.reply("Сначала зарегистрируйтесь: /register")
  if (ctx.merchantData.status !== "ACTIVE") return ctx.reply("⏳ Ваш аккаунт ещё не активирован.")
  return ctx.scene.enter("new-offer")
})

// ── /offers ───────────────────────────────────────────────

bot.command("offers", async (ctx): Promise<void> => {
  const merchant = ctx.merchantData
  if (!merchant) { await ctx.reply("Сначала зарегистрируйтесь: /register"); return }

  const offers = await db.offer.findMany({
    where: { merchantId: merchant.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { _count: { select: { redemptions: true } } },
  })

  if (offers.length === 0) {
    await ctx.reply("У вас нет акций. Создайте первую: /newoffer")
    return
  }

  const now = new Date()
  const lines = offers.map((o) => {
    const status = !o.active ? "⛔ Остановлена"
      : o.endsAt && o.endsAt < now ? "📅 Истекла"
      : o.usageLimit && o.usageCount >= o.usageLimit ? "🔢 Лимит"
      : "✅ Активна"
    const used = o._count.redemptions
    const limit = o.usageLimit ? `${used}/${o.usageLimit}` : `${used}/∞`
    return `${status} *${o.title}* — +${o.pointsReward} pts (${limit} использований)`
  })

  await ctx.reply(
    `📋 *Ваши акции:*\n\n${lines.join("\n")}\n\nЧтобы остановить акцию — напишите /stop <ID акции>`,
    { parse_mode: "Markdown" }
  )
})

// ── /balance ──────────────────────────────────────────────

bot.command("balance", async (ctx): Promise<void> => {
  const merchant = ctx.merchantData
  if (!merchant) { await ctx.reply("Сначала зарегистрируйтесь: /register"); return }

  await ctx.reply(
    `💎 *Ваш баланс: ${merchant.pointsBalance} баллов*\n\n` +
    `Баллы поступают когда клиенты тратят их у вас.\n` +
    `Используйте баллы для создания акций (/newoffer).`,
    { parse_mode: "Markdown" }
  )
})

// ── /redeem ───────────────────────────────────────────────

bot.command("redeem", async (ctx) => {
  if (!ctx.merchantData) return ctx.reply("Сначала зарегистрируйтесь: /register")
  if (ctx.merchantData.status !== "ACTIVE") return ctx.reply("⏳ Аккаунт ещё не активирован.")
  return ctx.scene.enter("accept-payment")
})

// ── /stop <offerId> ───────────────────────────────────────

bot.command("stop", async (ctx): Promise<void> => {
  const merchant = ctx.merchantData
  if (!merchant) { await ctx.reply("Сначала зарегистрируйтесь: /register"); return }

  const args = (ctx.message as { text: string }).text.split(" ")
  if (args.length < 2) {
    await ctx.reply("Использование: /stop <ID акции>\n\nID акции смотрите в /offers")
    return
  }
  const offerId = args[1]!.trim()
  const offer = await db.offer.findFirst({ where: { id: offerId, merchantId: merchant.id } })
  if (!offer) { await ctx.reply("Акция не найдена."); return }

  await db.offer.update({ where: { id: offerId }, data: { active: false } })
  await ctx.reply(`✅ Акция «${offer.title}» остановлена.`)
})

// ── Запуск ────────────────────────────────────────────────

const webhookUrl = process.env.BOT_WEBHOOK_URL

if (webhookUrl) {
  // Vercel / production: webhook mode
  bot.telegram.setWebhook(webhookUrl).then(() => {
    console.log(`[bot] Webhook set: ${webhookUrl}`)
  })
} else {
  // Local dev: polling mode
  bot.launch().then(() => {
    console.log("[bot] Started in polling mode")
  })
}

process.once("SIGINT", () => bot.stop("SIGINT"))
process.once("SIGTERM", () => bot.stop("SIGTERM"))

export { bot }
