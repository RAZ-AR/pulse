import { Scenes } from "telegraf"
import type { Context, WizardState } from "../types"
import { db } from "../lib/db"
import { generateOfferQr } from "../lib/qr"

const s = (ctx: Context) => ctx.wizard.state as WizardState

function kb(rows: string[][]): object {
  return { reply_markup: { keyboard: rows, one_time_keyboard: true, resize_keyboard: true } }
}

function noKb(): object {
  return { reply_markup: { remove_keyboard: true } }
}

/** Разбирает "1 мес" / "3 мес" / "6 мес" / "Бессрочно" в ISO-дату или null */
function parseExpiry(text: string): Date | null | "invalid" {
  const t = text.toLowerCase().trim()
  if (t === "бессрочно" || t === "♾ бессрочно") return null
  const m = t.match(/^(\d+)\s*мес/)
  if (m) {
    const d = new Date()
    d.setMonth(d.getMonth() + parseInt(m[1]!, 10))
    return d
  }
  // ДД.ММ.ГГГГ
  const parts = t.split(".")
  if (parts.length === 3) {
    const [d, mo, y] = parts
    const date = new Date(`${y}-${mo}-${d}`)
    if (!isNaN(date.getTime()) && date > new Date()) return date
    return "invalid"
  }
  return "invalid"
}

export const newOfferScene = new Scenes.WizardScene<Context>(
  "new-offer",

  // ── Шаг 0: выбор заведения ───────────────────────────────
  async (ctx) => {
    const merchant = ctx.merchantData
    if (!merchant) return ctx.scene.leave()

    const venues = await db.venue.findMany({
      where: { ownerId: merchant.id },
      select: { id: true, name: true },
    })

    if (venues.length === 0) {
      await ctx.reply("У вас нет заведений. Напишите @pulse_support для добавления.")
      return ctx.scene.leave()
    }

    s(ctx).venues = venues
    s(ctx).awaitingCustomDate = false
    s(ctx).awaitingCustomLimit = false

    if (venues.length === 1) {
      s(ctx).venueId = venues[0]!.id
      s(ctx).venueName = venues[0]!.name
      await ctx.reply(
        `🏪 Заведение: *${venues[0]!.name}*\n\n` +
        `*Шаг 1/6* — Тип акции?`,
        { parse_mode: "Markdown", ...kb([["🍽 Блюдо", "🍱 Комбо-сет"], ["🏷 Скидка", "🎁 Другое"]]) }
      )
      return ctx.wizard.next()
    }

    await ctx.reply("Выберите заведение:", kb(venues.map((v) => [v.name])))
    return ctx.wizard.next()
  },

  // ── Шаг 1: тип акции (или выбор заведения) ───────────────
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const text = ctx.message.text.trim()
    const state = s(ctx)

    // Если несколько заведений — обрабатываем выбор
    if (!state.venueId) {
      const venue = state.venues?.find((v) => v.name === text)
      if (!venue) { await ctx.reply("Выберите из списка."); return }
      state.venueId = venue.id
      state.venueName = venue.name
      await ctx.reply(
        `*Шаг 1/6* — Тип акции?`,
        { parse_mode: "Markdown", ...kb([["🍽 Блюдо", "🍱 Комбо-сет"], ["🏷 Скидка", "🎁 Другое"]]) }
      )
      return
    }

    state.offerType = text.replace(/^[^\w]+ ?/, "").trim() // убираем эмодзи
    await ctx.reply(
      `*Шаг 2/6* — Название акции?\n\n` +
      `_Пример: Капучино + круассан, Скидка 20% на пиццу_`,
      { parse_mode: "Markdown", ...noKb() }
    )
    return ctx.wizard.next()
  },

  // ── Шаг 2: название → описание ───────────────────────────
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    s(ctx).title = ctx.message.text.trim()

    await ctx.reply(
      `*Шаг 3/6* — Что получает клиент?\n\n` +
      `_Опишите кратко: «Бесплатный капучино при покупке от 500 RSD» или «Скидка 20% на весь счёт»_`,
      { parse_mode: "Markdown" }
    )
    return ctx.wizard.next()
  },

  // ── Шаг 3: описание → баллы ──────────────────────────────
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    s(ctx).description = ctx.message.text.trim()

    await ctx.reply(
      `*Шаг 4/6* — Сколько баллов нужно клиенту?`,
      { parse_mode: "Markdown", ...kb([["50", "100", "200"], ["500", "✏️ Другое"]]) }
    )
    return ctx.wizard.next()
  },

  // ── Шаг 4: баллы → срок ──────────────────────────────────
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const text = ctx.message.text.trim()
    const merchant = ctx.merchantData!

    let points: number
    if (text === "✏️ Другое") {
      await ctx.reply("Введите количество баллов числом:", noKb())
      return // Ждём следующего сообщения на том же шаге
    }

    points = parseInt(text, 10)
    if (isNaN(points) || points <= 0) {
      await ctx.reply("Введите целое положительное число.")
      return
    }
    if (merchant.pointsBalance < points) {
      await ctx.reply(
        `❌ Недостаточно баллов. Ваш баланс: *${merchant.pointsBalance}* pts\n\nПополните баланс: /topup`,
        { parse_mode: "Markdown" }
      )
      return
    }

    s(ctx).pointsReward = points
    await ctx.reply(
      `*Шаг 5/6* — Срок действия акции?`,
      { parse_mode: "Markdown", ...kb([["📅 1 мес", "📅 3 мес", "📅 6 мес"], ["♾ Бессрочно", "✏️ Своя дата"]]) }
    )
    return ctx.wizard.next()
  },

  // ── Шаг 5: срок (+ кастомная дата) → лимит ───────────────
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const text = ctx.message.text.trim()
    const state = s(ctx)

    if (text === "✏️ Своя дата" || state.awaitingCustomDate) {
      if (!state.awaitingCustomDate) {
        state.awaitingCustomDate = true
        await ctx.reply("Введите дату в формате ДД.ММ.ГГГГ:", noKb())
        return
      }
      const date = parseExpiry(text)
      if (date === "invalid") {
        await ctx.reply("Дата некорректна. Введите снова (ДД.ММ.ГГГГ):")
        return
      }
      if (date) state.endsAt = date.toISOString()
      state.awaitingCustomDate = false
    } else {
      const date = parseExpiry(text)
      if (date === "invalid") {
        await ctx.reply("Выберите вариант из меню.")
        return
      }
      if (date) state.endsAt = date.toISOString()
    }

    await ctx.reply(
      `*Шаг 6/6* — Лимит использований?`,
      { parse_mode: "Markdown", ...kb([["50", "100", "500"], ["♾ Безлимит", "✏️ Своё число"]]) }
    )
    return ctx.wizard.next()
  },

  // ── Финал: лимит → создать акцию ─────────────────────────
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const text = ctx.message.text.trim()
    const merchant = ctx.merchantData!
    const state = s(ctx)

    if (text === "✏️ Своё число" || state.awaitingCustomLimit) {
      if (!state.awaitingCustomLimit) {
        state.awaitingCustomLimit = true
        await ctx.reply("Введите число использований:", noKb())
        return
      }
    }

    let usageLimit: number | null = null
    if (text !== "♾ Безлимит" && text !== "✏️ Своё число") {
      usageLimit = parseInt(text, 10)
      if (isNaN(usageLimit) || usageLimit <= 0) {
        await ctx.reply("Введите число или «♾ Безлимит».")
        return
      }
      const totalCost = state.pointsReward * usageLimit
      if (merchant.pointsBalance < totalCost) {
        await ctx.reply(
          `❌ Для ${usageLimit} использований нужно *${totalCost}* pts.\nВаш баланс: *${merchant.pointsBalance}* pts.\n\nПополните: /topup или уменьшите лимит.`,
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
        description:  state.description || null,
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
          `🎯 Тип: ${state.offerType || "—"}\n` +
          `🎁 *${offer.title}*\n` +
          `📝 ${state.description || "—"}\n` +
          `⭐ +${offer.pointsReward} баллов клиенту\n` +
          `📅 Срок: ${expiryText}\n` +
          `🔢 Лимит: ${limitText}\n\n` +
          `Распечатайте или покажите QR-код клиентам при оплате.`,
        parse_mode: "Markdown",
        ...noKb() as object,
      }
    )

    return ctx.scene.leave()
  }
)
