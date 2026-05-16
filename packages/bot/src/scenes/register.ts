import { Scenes } from "telegraf"
import type { Context, WizardState } from "../index"
import { db } from "../lib/db"

const s = (ctx: Context) => ctx.wizard.state as WizardState

// ── Keyboard helpers ──────────────────────────────────────────

function kb(rows: string[][]): object {
  return { reply_markup: { keyboard: rows, one_time_keyboard: true, resize_keyboard: true } }
}

function noKb(): object {
  return { reply_markup: { remove_keyboard: true } }
}

// ── Summary text ──────────────────────────────────────────────

function buildSummary(st: WizardState): string {
  const rateLabel = st.preferredRate === 0.008
    ? "Стандарт (8 pts / 1000 RSD)"
    : st.preferredRate === 0.012
    ? "Премиум (12 pts / 1000 RSD)"
    : `Своя — ${Math.round(st.preferredRate * 1000)} pts / 1000 RSD`

  return (
    `📋 *Проверьте данные:*\n\n` +
    `🏪 *Заведение:* ${st.name}\n` +
    `🍽 *Тип:* ${st.category}\n` +
    `📍 *Город:* ${st.city}\n` +
    `🗺 *Адрес:* ${st.address}\n` +
    `🔗 *Соцсети/сайт:* ${st.social || "не указано"}\n` +
    `📞 *Телефон:* ${st.phone}\n` +
    `📧 *Email:* ${st.email}\n` +
    `🪪 *PIB/ИНН:* ${st.taxId || "не указан"}\n` +
    `⭐ *Ставка:* ${rateLabel}`
  )
}

// ── Scene ─────────────────────────────────────────────────────

export const registerScene = new Scenes.WizardScene<Context>(
  "register",

  // ── Шаг 0: приветствие → спрашиваем название ─────────────
  async (ctx) => {
    await ctx.reply(
      `👋 *Добро пожаловать в PULSE Partner!*\n\n` +
      `Мы поможем вам привлечь новых клиентов через программу лояльности.\n\n` +
      `Займёт около 2 минут. Начнём?\n\n` +
      `*Шаг 1/8* — Как называется ваше заведение?`,
      { parse_mode: "Markdown", ...noKb() }
    )
    return ctx.wizard.next()
  },

  // ── Шаг 1: название → тип заведения ──────────────────────
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    s(ctx).name = ctx.message.text.trim()

    await ctx.reply(
      `*Шаг 2/8* — Тип заведения?`,
      { parse_mode: "Markdown", ...kb([["☕ Кафе", "🍽 Ресторан"], ["🍺 Бар", "🛍 Магазин", "📦 Другое"]]) }
    )
    return ctx.wizard.next()
  },

  // ── Шаг 2: тип → город ───────────────────────────────────
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const text = ctx.message.text.trim()
    // Strip emoji prefix if any
    s(ctx).category = text.replace(/^[^\w]+ ?/, "").trim()
    s(ctx).awaitingCustomCity = false

    await ctx.reply(
      `*Шаг 3/8* — В каком городе?`,
      { parse_mode: "Markdown", ...kb([["Белград", "Нови-Сад", "Ниш"], ["Суботица", "Крагуевац", "✏️ Другой"]]) }
    )
    return ctx.wizard.next()
  },

  // ── Шаг 3: город (+ кастомный) → адрес ──────────────────
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const text = ctx.message.text.trim()

    if (text === "✏️ Другой" || s(ctx).awaitingCustomCity) {
      if (!s(ctx).awaitingCustomCity) {
        // Первый раз — просим написать город
        s(ctx).awaitingCustomCity = true
        await ctx.reply("Введите название вашего города:", noKb())
        return // Остаёмся на том же шаге
      }
      // Второй раз — получили город
      s(ctx).city = text
      s(ctx).awaitingCustomCity = false
    } else {
      s(ctx).city = text
    }

    await ctx.reply(
      `*Шаг 4/8* — Адрес заведения?\n\n_Пример: ул. Кнеза Михаила 12_`,
      { parse_mode: "Markdown", ...noKb() }
    )
    return ctx.wizard.next()
  },

  // ── Шаг 4: адрес → соцсети ───────────────────────────────
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    s(ctx).address = ctx.message.text.trim()

    await ctx.reply(
      `*Шаг 5/8* — Instagram или сайт? (чтобы добавить вас в каталог)\n\n_Например: @mycafe или mycafe.rs_`,
      { parse_mode: "Markdown", ...kb([["⏭ Пропустить"]]) }
    )
    return ctx.wizard.next()
  },

  // ── Шаг 5: соцсети → телефон ─────────────────────────────
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const text = ctx.message.text.trim()
    s(ctx).social = text === "⏭ Пропустить" ? "" : text

    await ctx.reply(
      `*Шаг 6/8* — Контактный номер телефона?`,
      { parse_mode: "Markdown", ...noKb() }
    )
    return ctx.wizard.next()
  },

  // ── Шаг 6: телефон → email ───────────────────────────────
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    s(ctx).phone = ctx.message.text.trim()

    await ctx.reply(
      `*Шаг 7/8* — Email для уведомлений?`,
      { parse_mode: "Markdown", ...noKb() }
    )
    return ctx.wizard.next()
  },

  // ── Шаг 7: email → ставка ────────────────────────────────
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    s(ctx).email = ctx.message.text.trim().toLowerCase()
    s(ctx).awaitingCustomRate = false

    await ctx.reply(
      `*Шаг 8/8* — Ставка начисления баллов?\n\n` +
      `Клиент получает баллы за каждую покупку у вас.\n` +
      `Чем выше ставка — тем привлекательнее для клиентов.`,
      {
        parse_mode: "Markdown",
        ...kb([
          ["⭐ Стандарт — 8 pts / 1000 RSD"],
          ["💎 Премиум — 12 pts / 1000 RSD"],
          ["✏️ Своя ставка"],
        ]),
      }
    )
    return ctx.wizard.next()
  },

  // ── Шаг 8: ставка (+ кастомная) → подтверждение ─────────
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const text = ctx.message.text.trim()

    if (text === "✏️ Своя ставка" || s(ctx).awaitingCustomRate) {
      if (!s(ctx).awaitingCustomRate) {
        s(ctx).awaitingCustomRate = true
        await ctx.reply(
          "Введите количество баллов за 1000 RSD\n\n_Например: 10 (это значит 10 pts за 1000 RSD)_",
          { parse_mode: "Markdown", ...noKb() }
        )
        return
      }
      const pts = parseInt(text, 10)
      if (isNaN(pts) || pts < 1 || pts > 100) {
        await ctx.reply("Введите число от 1 до 100.")
        return
      }
      s(ctx).preferredRate = pts / 1000
      s(ctx).awaitingCustomRate = false
    } else if (text.startsWith("⭐")) {
      s(ctx).preferredRate = 0.008
    } else if (text.startsWith("💎")) {
      s(ctx).preferredRate = 0.012
    } else {
      await ctx.reply("Выберите вариант из меню.")
      return
    }

    await ctx.reply(
      buildSummary(s(ctx)) + "\n\nВсё верно?",
      { parse_mode: "Markdown", ...kb([["✅ Подтвердить", "✏️ Начать заново"]]) }
    )
    return ctx.wizard.next()
  },

  // ── Финал: сохранить заявку ───────────────────────────────
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const text = ctx.message.text.trim()

    if (text === "✏️ Начать заново") {
      await ctx.reply("Хорошо, начнём сначала. Введите /register", noKb())
      return ctx.scene.leave()
    }

    if (text !== "✅ Подтвердить") return

    const chatId = String(ctx.chat!.id)
    const st = s(ctx)

    const existing = await db.merchant.findFirst({
      where: { OR: [{ telegramChatId: chatId }, { email: st.email }] },
    })
    if (existing) {
      await ctx.reply("Вы уже зарегистрированы! Используйте /offers или /newoffer.", noKb())
      return ctx.scene.leave()
    }

    await db.merchant.create({
      data: {
        name:           st.name,
        address:        `${st.city}, ${st.address}`,
        taxId:          st.taxId || null,
        email:          st.email,
        phone:          st.phone || null,
        telegramChatId: chatId,
        status:         "PENDING",
        pointsBalance:  0,
      },
    })

    await ctx.reply(
      `✅ *Заявка принята!*\n\n` +
      `Мы проверим данные и активируем аккаунт в течение 24 часов.\n` +
      `После активации получите стартовые баллы для первой акции.\n\n` +
      `Вопросы? Пишите @pulse_support 🙌`,
      { parse_mode: "Markdown", ...noKb() }
    )

    // Уведомление администратору
    const adminId = process.env.ADMIN_CHAT_ID
    if (adminId) {
      const rateLabel = `${Math.round(st.preferredRate * 1000)} pts/1000 RSD`
      await ctx.telegram.sendMessage(
        adminId,
        `🆕 *Новая заявка партнёра*\n\n` +
        `🏪 ${st.name} (${st.category})\n` +
        `📍 ${st.city}, ${st.address}\n` +
        `🔗 ${st.social || "—"}\n` +
        `📞 ${st.phone}\n` +
        `📧 ${st.email}\n` +
        `🪪 PIB: ${st.taxId || "не указан"}\n` +
        `⭐ Желаемая ставка: ${rateLabel}\n` +
        `TG chatId: \`${chatId}\`\n\n` +
        `/admin activate ${chatId}`,
        { parse_mode: "Markdown" }
      )
    }

    return ctx.scene.leave()
  }
)
