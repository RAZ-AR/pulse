import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure, merchantProcedure } from "../trpc"
import { extractReceiptData, computeReceiptHash } from "../services/ocr"
import { verifyReceiptPhoto } from "../services/receipt-verify"
import { checkReceiptScanLimits } from "../services/rate-limit"
import {
  SCAN_POINTS_PER_CURRENCY,
  RECEIPT_MAX_AGE_DAYS,
  RECEIPT_SUSPICIOUS_DAILY_COUNT,
  RECEIPT_MANUAL_REVIEW_THRESHOLD,
  OCR_CONFIDENCE_THRESHOLD,
  computeStreakUpdate,
} from "@pulse/shared"

// ── Helpers ───────────────────────────────────────────────────

function validateReceiptDate(dateStr: string): void {
  const receiptDate = new Date(dateStr)
  const now = new Date()
  const maxAge = RECEIPT_MAX_AGE_DAYS * 24 * 3600 * 1000

  if (isNaN(receiptDate.getTime())) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid receipt date" })
  }
  if (receiptDate > now) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Receipt date is in the future" })
  }
  if (now.getTime() - receiptDate.getTime() > maxAge) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Receipt is older than ${RECEIPT_MAX_AGE_DAYS} days`,
    })
  }
}

// ── Router ────────────────────────────────────────────────────

export const transactionRouter = router({
  /**
   * Step 1 — upload image URL, run OCR + AI verification.
   * Returns extracted data for user confirmation (or auto-confirms if confidence is high).
   */
  scanReceipt: protectedProcedure
    .input(
      z.object({
        imageUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Rate limiting (Redis; graceful if not configured)
      await checkReceiptScanLimits(ctx.userId)

      // 2. Suspicious activity flag: check today's scan count
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayCount = await ctx.db.transaction.count({
        where: {
          userId: ctx.userId,
          type: "RECEIPT_SCAN",
          createdAt: { gte: todayStart },
        },
      })
      const isSuspicious = todayCount >= RECEIPT_SUSPICIOUS_DAILY_COUNT

      // 3. OCR
      let ocrResult
      try {
        ocrResult = await extractReceiptData(input.imageUrl)
      } catch (e) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "OCR service unavailable. Try again later.",
        })
      }

      // 4. AI authenticity check (Claude Sonnet)
      let verifyResult
      try {
        verifyResult = await verifyReceiptPhoto(input.imageUrl)
      } catch {
        // Non-blocking: if verification fails, allow but flag
        verifyResult = { isAuthentic: true, confidence: 0.5, reason: "verification_error" }
      }

      if (!verifyResult.isAuthentic && verifyResult.confidence > 0.85) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This does not appear to be a genuine receipt photo.",
        })
      }

      // 5. Compute receipt hash (for dedup check in confirmReceipt)
      let receiptHash: string | null = null
      if (
        ocrResult.data.vendor &&
        ocrResult.data.total !== null &&
        ocrResult.data.currency &&
        ocrResult.data.date
      ) {
        receiptHash = computeReceiptHash({
          vendor: ocrResult.data.vendor,
          total: ocrResult.data.total,
          currency: ocrResult.data.currency,
          date: ocrResult.data.date,
          receiptNumber: ocrResult.data.receiptNumber,
        })

        // Pre-check for duplicate (full check happens in confirmReceipt)
        const existing = await ctx.db.transaction.findUnique({
          where: { receiptHash },
          select: { id: true },
        })
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "This receipt has already been scanned.",
          })
        }
      }

      return {
        ocrData: ocrResult.data,
        confidence: ocrResult.confidence,
        source: ocrResult.source,
        receiptHash,
        requiresConfirmation: ocrResult.confidence < OCR_CONFIDENCE_THRESHOLD,
        isSuspicious,
        aiVerification: {
          isAuthentic: verifyResult.isAuthentic,
          confidence: verifyResult.confidence,
        },
      }
    }),

  /**
   * Step 2 — user confirms (or edits) OCR data, points are awarded.
   */
  confirmReceipt: protectedProcedure
    .input(
      z.object({
        imageUrl: z.string().url(),
        receiptHash: z.string().length(64).optional(), // pre-computed SHA-256
        vendor: z.string().min(1).max(200),
        amount: z.number().positive(),
        currency: z.string().length(3),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().optional(),
        receiptNumber: z.string().optional(),
        ocrConfidence: z.number().min(0).max(1).optional(),
        ocrRawData: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Date validation
      validateReceiptDate(input.date)

      // 2. Compute (or reuse) receipt hash
      const receiptHash =
        input.receiptHash ??
        computeReceiptHash({
          vendor: input.vendor,
          total: input.amount,
          currency: input.currency,
          date: input.date,
          receiptNumber: input.receiptNumber,
        })

      // 3. Duplicate check (unique index enforces this at DB level too)
      const duplicate = await ctx.db.transaction.findUnique({
        where: { receiptHash },
        select: { id: true },
      })
      if (duplicate) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This receipt has already been scanned.",
        })
      }

      // 4. Determine status and points
      const needsManualReview = input.amount > RECEIPT_MANUAL_REVIEW_THRESHOLD
      const status = needsManualReview ? "PENDING" : "VERIFIED"
      const pointsEarned = needsManualReview
        ? 0
        : Math.floor(input.amount * SCAN_POINTS_PER_CURRENCY)

      // 5. Try to match vendor to a known venue (B2B lead if no match)
      const matchedVenue = await ctx.db.venue.findFirst({
        where: { name: { contains: input.vendor, mode: "insensitive" } },
        select: { id: true },
      })

      // 6. Load user for streak calculation
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: {
          earnedPoints: true,
          currentStreak: true,
          longestStreak: true,
          lastCheckinAt: true,
          totalEarnedLifetime: true,
        },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })

      const streak = computeStreakUpdate(
        user.currentStreak,
        user.longestStreak,
        user.lastCheckinAt,
      )
      const totalPoints = pointsEarned + streak.milestoneBonus

      // 7. DB transaction: create Transaction + update user
      const result = await ctx.db.$transaction(async (tx) => {
        const transaction = await tx.transaction.create({
          data: {
            userId: ctx.userId,
            venueId: matchedVenue?.id ?? null,
            type: "RECEIPT_SCAN",
            amount: input.amount,
            currency: input.currency,
            pointsEarned: totalPoints,
            receiptImageUrl: input.imageUrl,
            receiptHash,
            ocrRawData: input.ocrRawData ?? null,
            ocrConfidence: input.ocrConfidence ?? null,
            status,
            verifiedAt: status === "VERIFIED" ? new Date() : null,
          },
        })

        const updatedUser = await tx.user.update({
          where: { id: ctx.userId },
          data: {
            earnedPoints: { increment: totalPoints },
            totalEarnedLifetime: { increment: totalPoints },
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            lastCheckinAt: new Date(),
          },
          select: { earnedPoints: true, welcomePoints: true, currentStreak: true },
        })

        // Milestone bonus transaction record
        if (streak.milestoneBonus > 0) {
          await tx.transaction.create({
            data: {
              userId: ctx.userId,
              type: "BONUS",
              pointsEarned: streak.milestoneBonus,
              status: "VERIFIED",
              verifiedAt: new Date(),
            },
          })
        }

        return { transaction, updatedUser }
      })

      return {
        transactionId: result.transaction.id,
        pointsEarned: totalPoints,
        streakBonus: streak.milestoneBonus,
        newStreak: streak.currentStreak,
        newTotalPoints: result.updatedUser.earnedPoints + result.updatedUser.welcomePoints,
        status,
        needsManualReview,
        matchedVenue: matchedVenue?.id ?? null,
      }
    }),

  /**
   * Called by Merchant Web App to award partner-rate points.
   * Implemented in Tier 1 Step 4.
   */
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
      // TODO: Tier 1 Step 4
      return { pointsEarned: 0 }
    }),

  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(20),
        cursor: z.string().optional(),
        type: z.enum([
          "PARTNER_PURCHASE", "RECEIPT_SCAN", "CHECKIN_PHOTO",
          "REFERRAL", "CHALLENGE_COMPLETE", "BONUS",
          "GIFT_RECEIVED", "GIFT_SENT", "REWARD_REDEEMED",
        ]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const transactions = await ctx.db.transaction.findMany({
        where: {
          userId: ctx.userId,
          type: input.type,
        },
        take: input.limit + 1,
        cursor: input.cursor ? { id: input.cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: { venue: { select: { id: true, name: true } } },
      })

      let nextCursor: string | undefined
      if (transactions.length > input.limit) nextCursor = transactions.pop()!.id

      return { transactions, nextCursor }
    }),
})
