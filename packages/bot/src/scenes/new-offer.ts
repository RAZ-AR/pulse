import { Scenes } from "telegraf"
import type { Context, WizardState } from "../index"
import { db } from "../lib/db"
import { generateOfferQr } from "../lib/qr"

const s = (ctx: Context) => ctx.wizard.state as WizardState

export const newOfferScene = new Scenes.WizardScene<Context>(
  "new-offer",

  // Шаг 0: Выбрать заведение (если несколько)
  async (ctx) => {
    const merchant = ctx.merchantData
    if (!merchant) return ctx.scene.leave()

    const venues = await db.venue.findMany({
      where: { ownerId: merchant.id },
      select: { id: true, name: true },
    })

    if (venues.length === 0) {
      await ctx.reply("У вас нет заведений. Обратитесь к поддержке @pulse_support для добавления заведения.")
      return ctx.scene.leave()
    }

    s(ctx).venues = venues

    if (venues.length === 1) {
      s(ctx).venueId = venues[0]!.id
      s(ctx).venueName = venues[0]!.name
      await ctx.reply(
        `🏪 Заведение: *${venues[0]!.name}*\n\n*Шаг 1/4* — Название акции?\n\n_Пример: Капучино + круассан, Скидка на пиццу, Бесплатный десерт_`,
        { parse_mode: "Markdown" }
      )
      return ctx.wizard.next()
    }

    const buttons = venues.map((v) => [`${v.name}`])
    await ctx.reply("Выберите заведение:", {
      reply_markup: { keyboard: buttons, one_time_keyboard: true, resize_keyboard: true },
    })
    return ctx.wizard.next()
  },

  // Шаг 1: Название акции (или выбор заведения если их несколько)
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const text = ctx.message.text.trim()
    const state = s(ctx)

    if (!state.venueId) {
      const venue = state.venues?.find((v) => v.name === text)
      if (!venue) { await ctx.reply("Выберите заведение из списка."); return }
      state.venueId = venue.id
      state.venueName = venue.name
      await ctx.reply(
        `*Шаг 1/4* — Название акции?\n\n_Пример: Капучино + круассан_`,
        { parse_mode: "Markdown", reply_markup: { remove_keyboard: true } }
      )
      return
    }

    state.title = text
    await ctx.reply(
      "*Шаг 2/4* — Сколько баллов получит клиент?\n\n_Например: 50_",
      { parse_mode: "Markdown" }
    )
    return ctx.wizard.next()
  },

  // Шаг 2: Баллы
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const points = parseInt(ctx.message.text.trim(), 10)
    if (isNaN(points) || points <= 0) {
      await ctx.reply("Введите целое положительное число, например: 50")
      return
    }

    const merchant = ctx.merchantData!
    if (merchant.pointsBalance < points) {
      await ctx.reply(
        `❌ Недостаточно баллов.\nВаш баланс: *${merchant.pointsBalance}* pts\nНужно: *${points}* pts на одно использование.\n\nУменьшите количество баллов или пополните баланс.`,
        { parse_mode: "Markdown" }
      )
      return
    }

    s(ctx).pointsReward = points
    await ctx.reply(
      "*Шаг 3/4* — До какой даты действует акция?\n\n_Введите дату в формате ДД.ММ.ГГГГ или напишите «бессрочно»_",
      { parse_mode: "Markdown" }
    )
    return ctx.wizard.next()
  },

  // Шаг 3: Срок
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const text = ctx.message.text.trim().toLowerCase()

    if (text !== "бессрочно") {
      const parts = text.split(".")
      if (parts.length === 3) {
        const [d, m, y] = parts
        const date = new Date(`${y}-${m}-${d}`)
        if (!isNaN(date.getTime()) && date > new Date()) {
          s(ctx).endsAt = date.toISOString()
        } else {
          await ctx.reply("Дата некорректна или уже прошла. Введите снова или напишите «бессрочно».")
          return
        }
      } else {
        await ctx.reply("Формат: ДД.ММ.ГГГГ или «бессрочно»")
        return
      }
    }

    await ctx.reply(
      "*Шаг 4/4* — Лимит использований?\n\n_Введите число (например: 100) или напишите «безлимит»_",
      { parse_mode: "Markdown" }
    )
    return ctx.wizard.next()
  },

  // Финал: создать акцию
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const text = ctx.message.text.trim().toLowerCase()
    const merchant = ctx.merchantData!
    const state = s(ctx)

    let usageLimit: number | null = null
    if (text !== "безлимит") {
      usageLimit = parseInt(text, 10)
      if (isNaN(usageLimit) || usageLimit <= 0) {
        await ctx.reply("Введите число или «безлимит».")
        return
      }
      const totalCost = state.pointsReward * usageLimit
      if (merchant.pointsBalance < totalCost) {
        await ctx.reply(
          `❌ Для ${usageLimit} использований нужно *${totalCost}* pts.\nВаш баланс: *${merchant.pointsBalance}* pts.\n\nУменьшите лимит или количество баллов.`,
          { parse_mode: "Markdown" }
        )
        return
      }
    }

    const offer = await db.offer.create({
      data: {
        venueId:      state.venueId,
        merchantId:   merchant.id,
        title:        state.title,
        pointsReward: state.pointsReward,
        costPoints:   state.pointsReward,
        endsAt:       state.endsAt ? new Date(state.endsAt) : null,
        usageLimit,
      },
    })

    const qrBuffer = await generateOfferQr(offer.qrToken)

    const expiryText = offer.endsAt
      ? `до ${new Date(offer.endsAt).toLocaleDateString("ru-RU")}`
      : "бессрочно"
    const limitText = usageLimit ? `${usageLimit} раз` : "безлимит"

    await ctx.replyWithPhoto(
      { source: qrBuffer },
      {
        caption:
          `✅ *Акция создана!*\n\n` +
          `🏪 ${state.venueName}\n` +
          `🎁 ${offer.title}\n` +
          `⭐ +${offer.pointsReward} баллов клиенту\n` +
          `📅 Срок: ${expiryText}\n` +
          `🔢 Лимит: ${limitText}\n\n` +
          `Распечатайте или покажите этот QR клиентам. Каждый клиент может использовать акцию 1 раз.`,
        parse_mode: "Markdown",
      }
    )

    return ctx.scene.leave()
  }
)
