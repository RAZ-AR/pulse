import { z } from "zod"
import { Prisma } from "@pulse/db"
import type { db as PrismaDb } from "@pulse/db"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure, merchantProcedure } from "../trpc"
import { extractReceiptData, computeReceiptHash } from "../services/ocr"
import { verifyReceiptPhoto } from "../services/receipt-verify"
import { decodeSerbiaQrUrl, fetchVendorInfo } from "../services/serbia-qr"
import { checkReceiptScanLimits, checkImageFingerprint, checkVendorVelocity } from "../services/rate-limit"
import { trackSpend } from "../services/challenge-progress"
import { checkAndAwardBadges } from "../services/badges"
import { sendPushToUser, sendTelegram } from "../services/push"
import {
  SCAN_POINTS_PER_CURRENCY,
  RECEIPT_MAX_AGE_DAYS,
  RECEIPT_SUSPICIOUS_DAILY_COUNT,
  RECEIPT_MANUAL_REVIEW_THRESHOLD,
  OCR_CONFIDENCE_THRESHOLD,
  calculatePartnerPoints,
  computeStreakUpdate,
  stepMultiplier,
  REFERRAL_REWARD_POINTS,
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

type StreakResult = { currentStreak: number; longestStreak: number; milestoneBonus: number }

/**
 * Shared DB transaction for both confirmReceipt and scanQrReceipt.
 * Creates receipt transaction + updates user streak + awards badges.
 */
async function runReceiptTx(
  db: typeof PrismaDb,
  params: {
    userId: string
    venueId: string | null
    amount: number
    currency: string
    totalPoints: number
    streak: StreakResult
    status: "VERIFIED" | "PENDING"
    record: {
      receiptHash?: string | null
      receiptNumber?: string | null
      receiptImageUrl?: string | null
      ocrRawData?: Prisma.InputJsonValue | null
      ocrConfidence?: number | null
    }
  },
) {
  return db.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        userId: params.userId,
        venueId: params.venueId,
        type: "RECEIPT_SCAN",
        amount: params.amount,
        currency: params.currency,
        pointsEarned: params.totalPoints,
        status: params.status,
        verifiedAt: params.status === "VERIFIED" ? new Date() : null,
        receiptHash:      params.record.receiptHash      ?? null,
        receiptNumber:    params.record.receiptNumber    ?? null,
        receiptImageUrl:  params.record.receiptImageUrl  ?? null,
        ocrRawData:       params.record.ocrRawData       ?? Prisma.JsonNull,
        ocrConfidence:    params.record.ocrConfidence    ?? null,
      },
    })

    const updatedUser = await tx.user.update({
      where: { id: params.userId },
      data: {
        earnedPoints: { increment: params.totalPoints },
        totalEarnedLifetime: { increment: params.totalPoints },
        currentStreak: params.streak.currentStreak,
        longestStreak: params.streak.longestStreak,
        lastCheckinAt: new Date(),
      },
      select: { earnedPoints: true, welcomePoints: true, currentStreak: true },
    })

    if (params.streak.milestoneBonus > 0) {
      await tx.transaction.create({
        data: {
          userId: params.userId,
          type: "BONUS",
          pointsEarned: params.streak.milestoneBonus,
          status: "VERIFIED",
          verifiedAt: new Date(),
        },
      })
    }

    let newBadges: string[] = []
    if (params.status === "VERIFIED") {
      await trackSpend(tx, params.userId, params.amount)
      newBadges = await checkAndAwardBadges(tx, params.userId)
    }

    return { transaction, updatedUser, newBadges }
  })
}

/** Sends a push notification for newly earned badges. Best-effort, fire-and-forget. */
async function notifyBadges(db: typeof PrismaDb, userId: string, newBadges: string[]) {
  if (newBadges.length === 0) return
  const u = await db.user.findUnique({ where: { id: userId }, select: { pushToken: true } })
  void sendPushToUser(u?.pushToken, "🏅 New badge!", `You earned: ${newBadges.join(", ")}`)
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

      // 1b. Image fingerprint dedup — same URL = same photo upload
      const isDuplicateImage = await checkImageFingerprint(input.imageUrl)
      if (isDuplicateImage) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This receipt photo has already been scanned.",
        })
      }

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

      // 1b. Per-vendor velocity (max 2 receipts/day per user per vendor)
      await checkVendorVelocity(ctx.userId, input.vendor)

      // 2. Compute (or reuse) receipt hash
      const receiptHash =
        input.receiptHash ??
        computeReceiptHash({
          vendor: input.vendor,
          total: input.amount,
          currency: input.currency,
          date: input.date,
          receiptNumber: input.receiptNumber ?? null,
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

      // 5. Try to match vendor to a known venue (B2B lead if no match)
      const matchedVenue = await ctx.db.venue.findFirst({
        where: { name: { contains: input.vendor, mode: "insensitive" } },
        select: { id: true },
      })

      // 6. Load user for streak + step-multiplier calculation
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: {
          earnedPoints: true,
          currentStreak: true,
          longestStreak: true,
          lastCheckinAt: true,
          totalEarnedLifetime: true,
          stepsToday: true,
        },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })

      // 4. Determine status and points (after user load so we can apply step multiplier)
      const needsManualReview = input.amount > RECEIPT_MANUAL_REVIEW_THRESHOLD
      const status = needsManualReview ? "PENDING" : "VERIFIED"
      const stepMult = stepMultiplier(user.stepsToday)
      const pointsEarned = needsManualReview
        ? 0
        : Math.floor(input.amount * SCAN_POINTS_PER_CURRENCY * stepMult)

      const streak = computeStreakUpdate(
        user.currentStreak,
        user.longestStreak,
        user.lastCheckinAt,
      )
      const totalPoints = pointsEarned + streak.milestoneBonus

      // 7. DB transaction
      const result = await runReceiptTx(ctx.db, {
        userId: ctx.userId,
        venueId: matchedVenue?.id ?? null,
        amount: input.amount,
        currency: input.currency,
        totalPoints,
        streak,
        status,
        record: {
          receiptHash,
          receiptImageUrl: input.imageUrl,
          ocrRawData: (input.ocrRawData as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          ocrConfidence: input.ocrConfidence ?? null,
        },
      })

      await notifyBadges(ctx.db, ctx.userId, result.newBadges)

      return {
        transactionId: result.transaction.id,
        pointsEarned: totalPoints,
        streakBonus: streak.milestoneBonus,
        newStreak: streak.currentStreak,
        newTotalPoints: result.updatedUser.earnedPoints + result.updatedUser.welcomePoints,
        status,
        needsManualReview,
        matchedVenue: matchedVenue?.id ?? null,
        newBadges: result.newBadges,
      }
    }),

  /**
   * Scan a Serbian fiscal receipt QR code.
   * Decodes the government-issued QR directly — no AI, no OCR, 100% accurate.
   * Single step: decodes, validates, awards points.
   */
  scanQrReceipt: protectedProcedure
    .input(z.object({ qrUrl: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      // 1. Decode QR — throws if not a valid Serbian fiscal QR
      let qr
      try {
        qr = decodeSerbiaQrUrl(input.qrUrl)
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e instanceof Error ? e.message : "Invalid QR code",
        })
      }

      // 2. Date validation
      validateReceiptDate(qr.date)

      // 3. Rate limiting
      await checkReceiptScanLimits(ctx.userId)

      // 4. Dedup by receipt number (unique across all Serbian fiscal receipts)
      const existingByNumber = await ctx.db.transaction.findFirst({
        where: { receiptNumber: qr.receiptNumber },
        select: { id: true },
      })
      if (existingByNumber) {
        throw new TRPCError({ code: "CONFLICT", message: "This receipt has already been scanned." })
      }

      // 5. Fetch vendor name + PIB from PURS (best-effort, non-blocking)
      const vendorInfo = await fetchVendorInfo(qr.verificationUrl)
      const vendorName = vendorInfo.name ?? qr.requestedBy

      // 6. Per-vendor velocity check
      await checkVendorVelocity(ctx.userId, vendorName)

      // 7. Try to match to a known venue (by name or by partner PIB)
      const [matchedVenue, partnerMerchant] = await Promise.all([
        ctx.db.venue.findFirst({
          where: { name: { contains: vendorName, mode: "insensitive" } },
          select: { id: true, isPartner: true, pointsPerCurrency: true, boostMultiplier: true, boostUntil: true },
        }),
        // PIB match: if the receipt belongs to a registered PULSE partner
        vendorInfo.pib
          ? ctx.db.merchant.findFirst({
              where: { taxId: vendorInfo.pib, status: "ACTIVE" },
              include: { venues: { where: { isPartner: true }, take: 1, select: { id: true, pointsPerCurrency: true, boostMultiplier: true, boostUntil: true } } },
            })
          : Promise.resolve(null),
      ])

      // 8. Load user
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: {
          earnedPoints: true,
          currentStreak: true,
          longestStreak: true,
          lastCheckinAt: true,
          totalEarnedLifetime: true,
          stepsToday: true,
        },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })

      // 9. Calculate points — partner rate if PIB matches, otherwise scan rate
      const needsManualReview = qr.totalRsd > RECEIPT_MANUAL_REVIEW_THRESHOLD
      const stepMult = stepMultiplier(user.stepsToday)

      // Resolve partner venue: prefer name-matched, fall back to PIB-matched
      const partnerVenue = matchedVenue?.isPartner
        ? matchedVenue
        : partnerMerchant?.venues[0] ?? null

      const isPartnerReceipt = !!partnerVenue
      const pointsEarned = needsManualReview
        ? 0
        : isPartnerReceipt && partnerVenue?.pointsPerCurrency
          ? Math.floor(calculatePartnerPoints(
              qr.totalRsd,
              partnerVenue.pointsPerCurrency,
              partnerVenue.boostMultiplier,
              partnerVenue.boostUntil,
            ) * stepMult)
          : Math.floor(qr.totalRsd * SCAN_POINTS_PER_CURRENCY * stepMult)

      const streak = computeStreakUpdate(user.currentStreak, user.longestStreak, user.lastCheckinAt)
      const totalPoints = pointsEarned + streak.milestoneBonus

      const resolvedVenueId = partnerVenue
        ? (matchedVenue?.isPartner ? matchedVenue.id : partnerMerchant?.venues[0]?.id ?? null)
        : (matchedVenue?.id ?? null)

      // 10. DB transaction
      const result = await runReceiptTx(ctx.db, {
        userId: ctx.userId,
        venueId: resolvedVenueId,
        amount: qr.totalRsd,
        currency: "RSD",
        totalPoints,
        streak,
        status: needsManualReview ? "PENDING" : "VERIFIED",
        record: {
          receiptNumber: qr.receiptNumber,
          ocrConfidence: 1.0,
          ocrRawData: {
            source: "serbia_qr",
            requestedBy: qr.requestedBy,
            signedBy: qr.signedBy,
            vendorName,
            vendorPib: vendorInfo.pib,
            verificationUrl: qr.verificationUrl,
            isPartnerReceipt,
          },
        },
      })

      await notifyBadges(ctx.db, ctx.userId, result.newBadges)

      return {
        transactionId: result.transaction.id,
        pointsEarned: totalPoints,
        streakBonus: streak.milestoneBonus,
        newStreak: streak.currentStreak,
        newTotalPoints: result.updatedUser.earnedPoints + result.updatedUser.welcomePoints,
        status: needsManualReview ? "PENDING" : "VERIFIED",
        needsManualReview,
        vendorName,
        totalRsd: qr.totalRsd,
        date: qr.date,
        receiptNumber: qr.receiptNumber,
        matchedVenue: matchedVenue?.id ?? null,
        newBadges: result.newBadges,
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
    .mutation(async ({ ctx, input }) => {
      // 1. Load venue and verify merchant ownership
      const venue = await ctx.db.venue.findUnique({
        where: { id: input.venueId },
        select: {
          id: true,
          ownerId: true,
          isPartner: true,
          pointsPerCurrency: true,
          boostMultiplier: true,
          boostUntil: true,
        },
      })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" })
      if (venue.ownerId !== ctx.merchantId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Venue does not belong to this merchant" })
      }
      if (!venue.isPartner || !venue.pointsPerCurrency) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Venue is not an active partner" })
      }

      // 2. Load user (streak + referral info + steps for multiplier)
      const [user, priorPurchaseCount] = await Promise.all([
        ctx.db.user.findUnique({
          where: { id: input.userId },
          select: {
            id: true,
            earnedPoints: true,
            currentStreak: true,
            longestStreak: true,
            lastCheckinAt: true,
            referredById: true,
            stepsToday: true,
          },
        }),
        ctx.db.transaction.count({
          where: { userId: input.userId, type: "PARTNER_PURCHASE", status: "VERIFIED" },
        }),
      ])
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" })

      const isFirstPurchase = priorPurchaseCount === 0

      // 3. Calculate points (apply step multiplier to base earnings)
      const stepMult = stepMultiplier(user.stepsToday)
      const basePoints = calculatePartnerPoints(
        input.amount,
        venue.pointsPerCurrency,
        venue.boostMultiplier,
        venue.boostUntil,
      )
      const pointsEarned = Math.floor(basePoints * stepMult)

      const streak = computeStreakUpdate(user.currentStreak, user.longestStreak, user.lastCheckinAt)
      const totalPoints = pointsEarned + streak.milestoneBonus

      // 4. DB transaction: award points + update streak
      const result = await ctx.db.$transaction(async (tx) => {
        const transaction = await tx.transaction.create({
          data: {
            userId: input.userId,
            venueId: input.venueId,
            type: "PARTNER_PURCHASE",
            amount: input.amount,
            currency: input.currency,
            pointsEarned: totalPoints,
            status: "VERIFIED",
            verifiedAt: new Date(),
          },
        })

        const updatedUser = await tx.user.update({
          where: { id: input.userId },
          data: {
            earnedPoints: { increment: totalPoints },
            totalEarnedLifetime: { increment: totalPoints },
            currentStreak: streak.currentStreak,
            longestStreak: streak.longestStreak,
            lastCheckinAt: new Date(),
          },
          select: { earnedPoints: true, welcomePoints: true, currentStreak: true },
        })

        if (streak.milestoneBonus > 0) {
          await tx.transaction.create({
            data: {
              userId: input.userId,
              type: "BONUS",
              pointsEarned: streak.milestoneBonus,
              status: "VERIFIED",
              verifiedAt: new Date(),
            },
          })
        }

        // Challenge progress: SPEND_AMOUNT
        await trackSpend(tx, input.userId, input.amount)

        // Referral reward: referrer gets 100pts on referee's first partner purchase
        if (isFirstPurchase && user.referredById) {
          await tx.user.update({
            where: { id: user.referredById },
            data: {
              earnedPoints: { increment: REFERRAL_REWARD_POINTS },
              totalEarnedLifetime: { increment: REFERRAL_REWARD_POINTS },
            },
          })
          await tx.transaction.create({
            data: {
              userId: user.referredById,
              type: "REFERRAL",
              pointsEarned: REFERRAL_REWARD_POINTS,
              status: "VERIFIED",
              verifiedAt: new Date(),
            },
          })
          // Referrer may have just unlocked the "Connector"/"Influencer" badge
          await checkAndAwardBadges(tx, user.referredById)
        }

        // Badge check for the buyer
        const newBadges = await checkAndAwardBadges(tx, input.userId)

        return { transaction, updatedUser, newBadges }
      })

      // Notify buyer about new badges
      await notifyBadges(ctx.db, input.userId, result.newBadges)

      // Notify merchant via Telegram (best-effort)
      const merchant = await ctx.db.merchant.findUnique({
        where: { id: ctx.merchantId },
        select: { telegramChatId: true },
      })
      void sendTelegram(
        merchant?.telegramChatId ?? "",
        `💳 *Новая покупка*\n\nКлиент потратил *${input.amount} ${input.currency}* → начислено *+${totalPoints} pts*`,
      )

      return {
        transactionId: result.transaction.id,
        pointsEarned: totalPoints,
        streakBonus: streak.milestoneBonus,
        newStreak: streak.currentStreak,
        newTotalPoints: result.updatedUser.earnedPoints + result.updatedUser.welcomePoints,
        referralRewarded: isFirstPurchase && !!user.referredById,
        newBadges: result.newBadges,
      }
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
          ...(input.type ? { type: input.type } : {}),
        },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "desc" },
        include: { venue: { select: { id: true, name: true } } },
      })

      let nextCursor: string | undefined
      if (transactions.length > input.limit) nextCursor = transactions.pop()!.id

      return { transactions, nextCursor }
    }),
})
