import { Telegraf, Scenes, session, type Context as TelegrafContext } from "telegraf"
import { db } from "./lib/db"
import { registerScene } from "./scenes/register"
import { newOfferScene } from "./scenes/new-offer"
import { acceptPaymentScene } from "./scenes/accept-payment"
import { runBirthdayBonus } from "./lib/birthday-cron"
import type { Merchant } from "@pulse/db"

// ── Типы контекста ────────────────────────────────────────

export interface WizardState extends Scenes.WizardSessionData {
  // ── Register scene ────────────────────────────────────────
  name: string
  category: string        // Кафе / Ресторан / Бар / Магазин / Другое
  city: string
  address: string
  social: string          // Instagram / сайт (может быть пустым)
  phone: string
  email: string
  taxId: string
  preferredRate: number   // pts per RSD: 0.008 = 8pts/1000rsd
  awaitingCustomCity: boolean
  awaitingCustomRate: boolean

  // ── New-offer scene ───────────────────────────────────────
  venueId: string
  venueName: string
  venues: { id: string; name: string }[]
  offerType: string       // Блюдо / Комбо / Скидка / Другое
  title: string
  description: string     // что получает клиент
  pointsReward: number
  endsAt?: string
  awaitingCustomDate: boolean
  awaitingCustomLimit: boolean

  // ── Accept-payment scene ──────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────

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

const OPEN_BTN = { ru: "🚀 Открыть ayoo", sr: "🚀 Otvori ayoo", en: "🚀 Open ayoo" }

const WELCOME_BACK = {
  ru: (name: string) => `👋 С возвращением, ${name}! Открой приложение, чтобы посмотреть свои баллы.`,
  sr: (name: string) => `👋 Dobrodošao nazad, ${name}! Otvori aplikaciju da vidiš svoje bodove.`,
  en: (name: string) => `👋 Welcome back, ${name}! Open the app to check your points.`,
}

// ── /start ────────────────────────────────────────────────

bot.start(async (ctx) => {
  const payload = ctx.payload?.trim() // e.g. "gift_clxxxxxxxx"

  // ── Gift link claim (consumer flow) ──────────────────────
  if (payload?.startsWith("gift_")) {
    const token = payload.slice(5)
    const telegramId = String(ctx.from.id)

    const user = await db.user.findUnique({
      where: { telegramId },
      select: { id: true, onboardingDone: true },
    })

    if (!user || !user.onboardingDone) {
      const miniAppUrl = process.env.MINI_APP_URL ?? "https://t.me/ayoo_loyalty_bot/app"
      const lang = botLang(ctx.from.language_code)
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

    // Existing ayoo user — claim directly
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

  // ── User welcome (non-merchant flow) ─────────────────────
  const merchant = ctx.merchantData

  if (!merchant) {
    const miniAppUrl = process.env.MINI_APP_URL ?? "https://t.me/ayoo_loyalty_bot/app"
    const firstName = ctx.from.first_name ?? "friend"
    const lang = botLang(ctx.from.language_code)
    const telegramId = String(ctx.from.id)

    const user = await db.user.findUnique({
      where: { telegramId },
      select: { onboardingDone: true },
    })

    const text = user?.onboardingDone
      ? WELCOME_BACK[lang](firstName)
      : WELCOME[lang](firstName)

    await ctx.reply(text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{
          text: OPEN_BTN[lang],
          web_app: { url: miniAppUrl },
        }]],
      },
    })
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
    `/topup — пополнить баланс\n` +
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

// ── /topup ────────────────────────────────────────────────

const TOPUP_PACKAGES = [
  { pts: 1000, rsd: 990 },
  { pts: 5000, rsd: 4500 },
  { pts: 10000, rsd: 8500 },
]

bot.command("topup", async (ctx): Promise<void> => {
  const merchant = ctx.merchantData
  if (!merchant) { await ctx.reply("Сначала зарегистрируйтесь: /register"); return }
  if (merchant.status !== "ACTIVE") { await ctx.reply("⏳ Аккаунт ещё не активирован."); return }

  const buttons = TOPUP_PACKAGES.map((p) => [{
    text: `${p.pts.toLocaleString()} pts — ${p.rsd.toLocaleString()} RSD`,
    callback_data: `topup_${p.pts}`,
  }])

  await ctx.reply(
    `💳 *Пополнение баланса*\n\nВыберите пакет:`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: buttons } }
  )
})

bot.action(/^topup_(\d+)$/, async (ctx): Promise<void> => {
  const merchant = ctx.merchantData
  if (!merchant) { await ctx.answerCbQuery(); return }

  const pts = parseInt(ctx.match[1]!, 10)
  const pkg = TOPUP_PACKAGES.find((p) => p.pts === pts)
  if (!pkg) { await ctx.answerCbQuery("Неверный пакет"); return }

  const adminId = process.env.ADMIN_CHAT_ID
  if (adminId) {
    await ctx.telegram.sendMessage(
      adminId,
      `💰 *Запрос пополнения баланса*\n\n` +
      `Партнёр: *${merchant.name}*\n` +
      `chatId: \`${merchant.telegramChatId}\`\n` +
      `Пакет: *${pkg.pts.toLocaleString()} pts* — ${pkg.rsd.toLocaleString()} RSD\n\n` +
      `После получения оплаты: \`/admin credit ${merchant.telegramChatId} ${pkg.pts}\``,
      { parse_mode: "Markdown" }
    )
  }

  const iban = process.env.COMPANY_IBAN ?? "RS35105008123456789"
  const ref = `AYOO-${merchant.id.slice(-6).toUpperCase()}`
  await ctx.editMessageText(
    `✅ *Заявка принята!*\n\n` +
    `Переведите *${pkg.rsd.toLocaleString()} RSD* по реквизитам:\n\n` +
    `🏦 Назначение: ayoo Points\n` +
    `📋 IBAN: \`${iban}\`\n` +
    `🔖 Позив на број: \`${ref}\`\n\n` +
    `После подтверждения оплаты мы зачислим *${pkg.pts.toLocaleString()} pts* на ваш баланс в течение 24 часов.`,
    { parse_mode: "Markdown" }
  )
  await ctx.answerCbQuery()
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

// ── /admin ────────────────────────────────────────────────

bot.command("admin", async (ctx): Promise<void> => {
  const adminId = process.env.ADMIN_CHAT_ID
  if (!adminId || String(ctx.chat!.id) !== adminId) {
    await ctx.reply("❌ Нет доступа.")
    return
  }

  const args = (ctx.message as { text: string }).text.trim().split(/\s+/)
  const sub = args[1]

  if (sub === "list") {
    const pending = await db.merchant.findMany({
      where: { status: "PENDING" },
      select: { id: true, name: true, telegramChatId: true, email: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    })
    if (pending.length === 0) {
      await ctx.reply("✅ Нет заявок в ожидании.")
      return
    }
    const lines = pending.map((m) =>
      `• *${m.name}* (${m.email})\n  chatId: \`${m.telegramChatId}\`\n  id: \`${m.id}\``
    )
    await ctx.reply(`📋 *Заявки на активацию (${pending.length}):*\n\n${lines.join("\n\n")}`, { parse_mode: "Markdown" })
    return
  }

  if (sub === "activate") {
    const targetId = args[2]?.trim()
    if (!targetId) {
      await ctx.reply("Использование: /admin activate <chatId или merchantId>")
      return
    }
    const merchant = await db.merchant.findFirst({
      where: { OR: [{ telegramChatId: targetId }, { id: targetId }] },
    })
    if (!merchant) { await ctx.reply("Партнёр не найден."); return }
    if (merchant.status === "ACTIVE") { await ctx.reply("Уже активен."); return }

    const WELCOME_BALANCE = 500
    await db.merchant.update({
      where: { id: merchant.id },
      data: { status: "ACTIVE", pointsBalance: { increment: WELCOME_BALANCE } },
    })

    if (merchant.telegramChatId) {
      await ctx.telegram.sendMessage(
        merchant.telegramChatId,
        `🎉 *Ваш аккаунт активирован!*\n\n` +
        `Добро пожаловать в ayoo Partners, *${merchant.name}*!\n` +
        `На вашем балансе ${WELCOME_BALANCE} стартовых баллов.\n\n` +
        `Создайте первую акцию: /newoffer`,
        { parse_mode: "Markdown" }
      )
    }

    await ctx.reply(`✅ Партнёр *${merchant.name}* активирован (+${WELCOME_BALANCE} pts). Уведомление отправлено.`, { parse_mode: "Markdown" })
    return
  }

  if (sub === "credit") {
    const targetId = args[2]?.trim()
    const amount = parseInt(args[3] ?? "", 10)
    if (!targetId || isNaN(amount) || amount <= 0) {
      await ctx.reply("Использование: /admin credit <chatId или merchantId> <сумма>")
      return
    }
    const merchant = await db.merchant.findFirst({
      where: { OR: [{ telegramChatId: targetId }, { id: targetId }] },
    })
    if (!merchant) { await ctx.reply("Партнёр не найден."); return }

    const updated = await db.merchant.update({
      where: { id: merchant.id },
      data: { pointsBalance: { increment: amount } },
      select: { pointsBalance: true },
    })

    if (merchant.telegramChatId) {
      await ctx.telegram.sendMessage(
        merchant.telegramChatId,
        `💳 На ваш баланс зачислено *${amount} баллов*.\nТекущий баланс: *${updated.pointsBalance} pts*`,
        { parse_mode: "Markdown" }
      )
    }

    await ctx.reply(`✅ *${merchant.name}* +${amount} pts → баланс ${updated.pointsBalance} pts`, { parse_mode: "Markdown" })
    return
  }

  if (sub === "reject") {
    const targetId = args[2]?.trim()
    if (!targetId) {
      await ctx.reply("Использование: /admin reject <chatId или merchantId>")
      return
    }
    const merchant = await db.merchant.findFirst({
      where: { OR: [{ telegramChatId: targetId }, { id: targetId }] },
    })
    if (!merchant) { await ctx.reply("Партнёр не найден."); return }

    await db.merchant.update({ where: { id: merchant.id }, data: { status: "SUSPENDED" } })

    if (merchant.telegramChatId) {
      await ctx.telegram.sendMessage(
        merchant.telegramChatId,
        `❌ К сожалению, ваша заявка на участие в ayoo Partners не была одобрена.\n\nЕсть вопросы? Напишите @ayoo_support`,
      )
    }

    await ctx.reply(`🗑 Партнёр *${merchant.name}* отклонён.`, { parse_mode: "Markdown" })
    return
  }

  if (sub === "boost") {
    // /admin boost <venueId> <days> <multiplier>
    const venueId = args[2]?.trim()
    const days = parseInt(args[3] ?? "", 10)
    const multiplier = parseFloat(args[4] ?? "")
    if (!venueId || isNaN(days) || days <= 0 || isNaN(multiplier) || multiplier <= 1) {
      await ctx.reply("Использование: /admin boost <venueId> <дней> <множитель>\nПример: /admin boost abc123 7 2.0")
      return
    }
    const venue = await db.venue.findUnique({ where: { id: venueId }, select: { id: true, name: true } })
    if (!venue) { await ctx.reply("Заведение не найдено."); return }

    const boostUntil = new Date(Date.now() + days * 86_400_000)
    await db.venue.update({
      where: { id: venueId },
      data: { boostMultiplier: multiplier, boostUntil },
    })

    await ctx.reply(
      `🚀 Буст установлен:\n*${venue.name}* × ${multiplier} на ${days} дней (до ${boostUntil.toLocaleDateString("ru-RU")})`,
      { parse_mode: "Markdown" }
    )
    return
  }

  await ctx.reply(
    `🔧 *Admin команды:*\n\n` +
    `/admin list — заявки в ожидании\n` +
    `/admin activate <chatId> — активировать партнёра (+500 pts)\n` +
    `/admin reject <chatId> — отклонить заявку\n` +
    `/admin credit <chatId> <сумма> — пополнить баланс\n` +
    `/admin boost <venueId> <дней> <×> — поставить буст заведению`,
    { parse_mode: "Markdown" }
  )
})

// ── Запуск (только при прямом вызове, не при импорте) ────────

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

  // Run birthday bonus daily at 09:00 server time
  scheduleDailyAt(9, 0, () => {
    runBirthdayBonus(db).catch((e) => console.error("[birthday-cron] error:", e))
  })

  process.once("SIGINT", () => bot.stop("SIGINT"))
  process.once("SIGTERM", () => bot.stop("SIGTERM"))
}

// Auto-start when run directly (tsx src/index.ts), not when imported
if (require.main === module) {
  startBot()
}

export { bot }
