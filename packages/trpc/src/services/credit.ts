import type { db as PrismaDb } from "@pulse/db"
import { TRPCError } from "@trpc/server"
import {
  computeCreditOffer,
  effectiveCreditLimit,
  CREDIT_TURNOVER_WINDOW_DAYS,
} from "@pulse/shared"

type Db = typeof PrismaDb
type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0]

// Оборот мерчанта баллами за окно: сумма начисленных клиентам за покупки.
export async function merchantTurnover(db: Db | Tx, merchantId: string): Promise<number> {
  const since = new Date(Date.now() - CREDIT_TURNOVER_WINDOW_DAYS * 86_400_000)
  const agg = await db.transaction.aggregate({
    where: {
      type: "PARTNER_PURCHASE",
      createdAt: { gte: since },
      venue: { ownerId: merchantId },
    },
    _sum: { pointsEarned: true },
  })
  return agg._sum.pointsEarned ?? 0
}

// Текущее кредитное предложение мерчанту (лимит + срок) по его обороту.
export async function creditOfferFor(db: Db | Tx, merchantId: string) {
  const turnover = await merchantTurnover(db, merchantId)
  return computeCreditOffer(turnover)
}

/**
 * Проверяет, может ли мерчант начислить `cost` баллов клиенту.
 * — В пределах баланса или принятого кредита → ок.
 * — Кредит просрочен и баланс в минусе → блок (нужно пополнить).
 * — Не хватает, но кредит покрыл бы → бросает CREDIT_REQUIRED (UI спросит согласие).
 * — Не хватает даже с кредитом → блок.
 */
export async function assertMerchantCanAward(db: Db | Tx, merchantId: string, cost: number): Promise<void> {
  const m = await db.merchant.findUnique({
    where: { id: merchantId },
    select: { pointsBalance: true, creditLimit: true, creditDueAt: true },
  })
  if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Merchant not found" })

  const now = new Date()
  const after = m.pointsBalance - cost
  const effLimit = effectiveCreditLimit(m.creditLimit, m.creditDueAt, now)

  if (after >= -effLimit) return // хватает баланса или принятого кредита

  // Просроченный непогашенный кредит — блок до пополнения
  if (m.creditDueAt && m.creditDueAt.getTime() <= now.getTime() && m.pointsBalance < 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Кредит просрочен. Пополните баланс, чтобы начислять баллы." })
  }

  const offer = await creditOfferFor(db, merchantId)
  if (m.pointsBalance - cost >= -offer.limit) {
    // Кредит покрыл бы — просим согласие (данные кодируем в message для мини-аппа)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `CREDIT_REQUIRED:${offer.limit}:${offer.termDays}`,
    })
  }
  throw new TRPCError({ code: "BAD_REQUEST", message: "Недостаточно баллов даже с учётом кредита. Пополните баланс." })
}

// После пополнения баланса: если вышли в плюс — закрываем кредит.
export async function clearCreditIfRepaid(tx: Tx, merchantId: string): Promise<void> {
  const m = await tx.merchant.findUnique({ where: { id: merchantId }, select: { pointsBalance: true, creditDueAt: true } })
  if (m && m.creditDueAt && m.pointsBalance >= 0) {
    await tx.merchant.update({
      where: { id: merchantId },
      data: { creditLimit: 0, creditDueAt: null, creditAcceptedAt: null },
    })
  }
}
