import { Scenes } from "telegraf"
import type { Context, WizardState } from "../index"
import { db } from "../lib/db"

const s = (ctx: Context) => ctx.wizard.state as WizardState

export const registerScene = new Scenes.WizardScene<Context>(
  "register",

  // Шаг 1: Название
  async (ctx) => {
    await ctx.reply(
      "Добро пожаловать в PULSE Partner! 🎉\n\nДавайте зарегистрируем ваше заведение.\n\n*Шаг 1/4* — Как называется ваше заведение?",
      { parse_mode: "Markdown" }
    )
    return ctx.wizard.next()
  },

  // Шаг 2: Адрес
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    s(ctx).name = ctx.message.text.trim()
    await ctx.reply("*Шаг 2/4* — Адрес заведения?", { parse_mode: "Markdown" })
    return ctx.wizard.next()
  },

  // Шаг 3: PIB
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    s(ctx).address = ctx.message.text.trim()
    await ctx.reply("*Шаг 3/4* — ИНН / PIB (налоговый номер)?", { parse_mode: "Markdown" })
    return ctx.wizard.next()
  },

  // Шаг 4: Email
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    s(ctx).taxId = ctx.message.text.trim()
    await ctx.reply("*Шаг 4/4* — Контактный email (для уведомлений)?", { parse_mode: "Markdown" })
    return ctx.wizard.next()
  },

  // Финал: сохранить
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const email = ctx.message.text.trim().toLowerCase()
    const chatId = String(ctx.chat!.id)
    const state = s(ctx)

    const existing = await db.merchant.findFirst({
      where: { OR: [{ telegramChatId: chatId }, { email }] },
    })
    if (existing) {
      await ctx.reply("Вы уже зарегистрированы! Используйте /offers или /newoffer.")
      return ctx.scene.leave()
    }

    await db.merchant.create({
      data: {
        name:           state.name,
        address:        state.address,
        taxId:          state.taxId,
        email:          email,
        telegramChatId: chatId,
        status:         "PENDING",
        pointsBalance:  500,
      },
    })

    await ctx.reply(
      `✅ *Заявка принята!*\n\nМы проверим данные и активируем ваш аккаунт в течение 24 часов.\n\nПосле активации вы получите 500 баллов для создания первой акции.\n\nЕсть вопросы? Напишите @pulse_support`,
      { parse_mode: "Markdown" }
    )

    const adminChatId = process.env.ADMIN_CHAT_ID
    if (adminChatId) {
      await ctx.telegram.sendMessage(
        adminChatId,
        `🆕 Новая заявка партнёра:\n*${state.name}*\nАдрес: ${state.address}\nPIB: ${state.taxId}\nEmail: ${email}\nTG: ${chatId}`,
        { parse_mode: "Markdown" }
      )
    }

    return ctx.scene.leave()
  }
)
