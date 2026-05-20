import { Scenes } from "telegraf"
import type { Context, WizardState } from "../types"
import { db } from "../lib/db"

const s = (ctx: Context) => ctx.wizard.state as WizardState

export const acceptPaymentScene = new Scenes.WizardScene<Context>(
  "accept-payment",

  // Шаг 1: Ввести loyalty ID клиента
  async (ctx) => {
    await ctx.reply(
      "💳 *Принять оплату баллами*\n\nВведите 12-значный ID карты клиента:",
      { parse_mode: "Markdown" }
    )
    return ctx.wizard.next()
  },

  // Шаг 2: Найти юзера и подтвердить
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const normalized = ctx.message.text.trim().replace(/\D/g, "")

    const user = await db.user.findFirst({
      where: {
        OR: [
          { id: { endsWith: normalized.slice(-8) } },
          { cardNumber: normalized.slice(-5) },
        ]
      },
      select: { id: true, name: true, earnedPoints: true, welcomePoints: true, cardNumber: true },
    })

    if (!user) {
      await ctx.reply("❌ Клиент не найден. Проверьте номер карты и попробуйте ещё раз.")
      return
    }

    const totalPoints = user.earnedPoints + user.welcomePoints
    const state = s(ctx)
    state.userId = user.id
    state.userName = user.name ?? "Клиент"
    state.userPoints = totalPoints

    await ctx.reply(
      `👤 *${state.userName}*\n💎 Баланс: *${totalPoints} баллов*\n\nСколько баллов списать?`,
      { parse_mode: "Markdown" }
    )
    return ctx.wizard.next()
  },

  // Шаг 3: Подтверждение списания
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    const amount = parseInt(ctx.message.text.trim(), 10)
    const state = s(ctx)

    if (isNaN(amount) || amount <= 0) {
      await ctx.reply("Введите целое положительное число.")
      return
    }
    if (amount > state.userPoints) {
      await ctx.reply(`❌ Недостаточно баллов. У клиента: ${state.userPoints} pts`)
      return
    }

    state.amount = amount
    await ctx.reply(
      `Списать *${amount} баллов* у ${state.userName}?\n\nОтветьте *Да* для подтверждения.`,
      { parse_mode: "Markdown" }
    )
    return ctx.wizard.next()
  },

  // Финал: выполнить списание
  async (ctx) => {
    if (!ctx.message || !("text" in ctx.message)) return
    if (!ctx.message.text.toLowerCase().startsWith("да")) {
      await ctx.reply("Отменено.")
      return ctx.scene.leave()
    }

    const merchant = ctx.merchantData!
    const state = s(ctx)
    const { userId, amount } = state

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { earnedPoints: true, welcomePoints: true },
    })
    if (!user || user.earnedPoints + user.welcomePoints < amount) {
      await ctx.reply("❌ У клиента больше нет нужного количества баллов.")
      return ctx.scene.leave()
    }

    await db.$transaction(async (tx) => {
      const fromEarned = Math.min(amount, user.earnedPoints)
      const fromWelcome = amount - fromEarned

      await tx.user.update({
        where: { id: userId },
        data: {
          earnedPoints:  { decrement: fromEarned },
          welcomePoints: { decrement: fromWelcome },
          spentPoints:   { increment: amount },
        },
      })

      await tx.merchant.update({
        where: { id: merchant.id },
        data: { pointsBalance: { increment: amount } },
      })

      await tx.transaction.create({
        data: {
          userId,
          type:         "REWARD_REDEEMED",
          pointsEarned: -amount,
          status:       "VERIFIED",
          verifiedAt:   new Date(),
        },
      })
    })

    await ctx.reply(
      `✅ *Готово!*\n\nСписано *${amount} баллов* у ${state.userName}.\nВаш баланс пополнен на ${amount} pts.`,
      { parse_mode: "Markdown" }
    )
    return ctx.scene.leave()
  }
)
