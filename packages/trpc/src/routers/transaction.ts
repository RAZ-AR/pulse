import { z } from "zod"
import { router, protectedProcedure, merchantProcedure } from "../trpc"

export const transactionRouter = router({
  scanReceipt: protectedProcedure
    .input(
      z.object({
        imageUrl: z.string().url(),
        imageHash: z.string(),
      })
    )
    .mutation(async () => {
      // TODO (Tier 1 step 3): OCR pipeline
      // 1. Anti-fraud: check receiptHash, rate limits, date validation
      // 2. OCR via Google Vision / GPT-4o
      // 3. Return extracted data for user confirmation
      return { status: "PENDING" as const }
    }),

  confirmReceipt: protectedProcedure
    .input(
      z.object({
        receiptHash: z.string(),
        vendor: z.string(),
        amount: z.number().positive(),
        currency: z.string().length(3),
        date: z.string().datetime(),
      })
    )
    .mutation(async () => {
      // TODO: create Transaction, award points
      return { pointsEarned: 0 }
    }),

  partnerPurchase: merchantProcedure
    .input(
      z.object({
        userId: z.string(),
        venueId: z.string(),
        amount: z.number().positive(),
        currency: z.string().length(3),
      })
    )
    .mutation(async () => {
      // TODO (Tier 1 step 4): award partner-rate points
      return { pointsEarned: 0 }
    }),

  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const transactions = await ctx.db.transaction.findMany({
        where: { userId: ctx.userId },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: { venue: { select: { id: true, name: true } } },
      })
      let nextCursor: string | undefined
      if (transactions.length > input.limit) {
        nextCursor = transactions.pop()!.id
      }
      return { transactions, nextCursor }
    }),
})
