import { Telegraf, Scenes, session } from "telegraf"
import { db } from "./lib/db"
import { registerScene } from "./scenes/register"
import { newOfferScene } from "./scenes/new-offer"
import { acceptPaymentScene } from "./scenes/accept-payment"
import type { Context } from "./types"

// ── Инициализация ─────────────────────────────────────────

const token = process.env.PARTNER_TELEGRAM_BOT_TOKEN
export const isPartnerBotConfigured = Boolean(token)

const partnerBot = new Telegraf<Context>(token ?? "0:missing-partner-token")

const stage = new Scenes.Stage<Context>([
  registerScene,
  newOfferScene,
  acceptPaymentScene,
])

partnerBot.use(session())
partnerBot.use(stage.middleware())

// ── Middleware: загрузить партнёра ────────────────────────

partnerBot.use(async (ctx, next) => {
  if (!ctx.chat) return next()
  const chatId = String(ctx.chat.id)
  const merchant = await db.merchant.findUnique({ where: { telegramChatId: chatId } })
  if (merchant) ctx.merchantData = merchant as Context["state"]["merchant"]
  return next()
})

// ── Helpers ───────────────────────────────────────────────

// ── /start ────────────────────────────────────────────────

partnerBot.start(async (ctx) => {
  const merchant = ctx.merchantData

  if (!merchant) {
    await ctx.reply(
      `👋 Добро пожаловать в *ayoo Partner*.\n\n` +
      `Здесь партнёры регистрируют компанию, создают акции, смотрят баланс и принимают оплату баллами.\n\n` +
      `Начать регистрацию: /register`,
      { parse_mode: "Markdown" }
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
    `/topup — пополнить баланс\n` +
    `/redeem — принять оплату баллами`,
    { parse_mode: "Markdown" }
  )
})

// ── /register ─────────────────────────────────────────────

partnerBot.command("register", async (ctx) => {
  if (ctx.merchantData) {
    await ctx.reply("Вы уже зарегистрированы. Используйте /offers или /newoffer.")
    return
  }
  return ctx.scene.enter("register")
})

// ── /newoffer ─────────────────────────────────────────────

partnerBot.command("newoffer", async (ctx) => {
  if (!ctx.merchantData) return ctx.reply("Сначала зарегистрируйтесь: /register")
  if (ctx.merchantData.status !== "ACTIVE") return ctx.reply("⏳ Ваш аккаунт ещё не активирован.")
  return ctx.scene.enter("new-offer")
})

// ── /offers ───────────────────────────────────────────────

partnerBot.command("offers", async (ctx): Promise<void> => {
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

partnerBot.command("balance", async (ctx): Promise<void> => {
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

partnerBot.command("redeem", async (ctx) => {
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

partnerBot.command("topup", async (ctx): Promise<void> => {
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

partnerBot.action(/^topup_(\d+)$/, async (ctx): Promise<void> => {
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

partnerBot.command("stop", async (ctx): Promise<void> => {
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

partnerBot.command("admin", async (ctx): Promise<void> => {
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

export function startPartnerBot() {
  if (!token) throw new Error("PARTNER_TELEGRAM_BOT_TOKEN not set")

  const webhookUrl = process.env.PARTNER_BOT_WEBHOOK_URL

  if (webhookUrl) {
    partnerBot.telegram.setWebhook(webhookUrl).then(() => {
      console.log(`[partner-bot] Webhook set: ${webhookUrl}`)
    })
  } else {
    partnerBot.launch().then(() => {
      console.log("[partner-bot] Started in polling mode")
    })
  }

  process.once("SIGINT", () => partnerBot.stop("SIGINT"))
  process.once("SIGTERM", () => partnerBot.stop("SIGTERM"))
}

if (require.main === module) {
  startPartnerBot()
}

export { partnerBot }
