import { z } from "zod"
import { createHmac, timingSafeEqual } from "node:crypto"
import { Prisma } from "@pulse/db"
import type { db as PrismaDb } from "@pulse/db"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure, merchantProcedure } from "../trpc"
import { extractReceiptData, computeReceiptHash } from "../services/ocr"
import { verifyReceiptPhoto } from "../services/receipt-verify"
import {
  fetchSerbiaReceipt,
  receiptDayInBelgrade,
  SerbiaReceiptError,
  validateReceiptEligibility,
} from "../services/serbia-qr"
import { checkReceiptScanLimits, checkImageFingerprint, checkVendorVelocity } from "../services/rate-limit"
import { trackSpend } from "../services/challenge-progress"
import { checkAndAwardBadges } from "../services/badges"
import { sendPushToUser, sendTelegram, notifyPetEvolution } from "../services/push"
import {
  SCAN_POINTS_PER_CURRENCY,
  MIN_PARTNER_POINTS_PER_CURRENCY,
  RECEIPT_MAX_AGE_DAYS,
  RECEIPT_MAX_AGE_HOURS,
  RECEIPT_MAX_AMOUNT_RSD,
  RECEIPT_SUSPICIOUS_DAILY_COUNT,
  RECEIPT_MANUAL_REVIEW_THRESHOLD,
  OCR_CONFIDENCE_THRESHOLD,
  calculatePartnerPoints,
  computeStreakUpdate,
  stepMultiplier,
  REFERRAL_REWARD_POINTS,
} from "@pulse/shared"
import { assertMerchantCanAward } from "../services/credit"

// ── Helpers ───────────────────────────────────────────────────

const RECEIPT_SCAN_TOKEN_TTL_MS = 15 * 60_000

type ReceiptScanToken = {
  v: 1
  userId: string
  imageUrl: string
  vendor: string | null
  total: number | null
  currency: string | null
  date: string | null
  receiptNumber: string | null
  receiptHash: string | null
  confidence: number
  rawData: Prisma.InputJsonValue
  exp: number
}

function b64url(input: string): string {
  return Buffer.from(input).toString("base64url")
}

function receiptTokenSecret(): string {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === "production") {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Receipt scan token secret is not configured" })
  }
  return "dev-receipt-scan-secret"
}

function signReceiptScanToken(payload: ReceiptScanToken): string {
  const body = b64url(JSON.stringify(payload))
  const sig = createHmac("sha256", receiptTokenSecret()).update(body).digest("base64url")
  return `${body}.${sig}`
}

function readReceiptScanToken(token: string): ReceiptScanToken {
  const [body, sig] = token.split(".")
  if (!body || !sig) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid receipt scan token" })
  }

  const expected = createHmac("sha256", receiptTokenSecret()).update(body).digest("base64url")
  const got = Buffer.from(sig)
  const want = Buffer.from(expected)
  if (got.length !== want.length || !timingSafeEqual(got, want)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid receipt scan token" })
  }

  let payload: ReceiptScanToken
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ReceiptScanToken
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid receipt scan token" })
  }
  if (payload.v !== 1 || payload.exp < Date.now()) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Receipt scan expired. Please scan again." })
  }
  return payload
}

function cleanOptionalText(value: string | null | undefined): string | null {
  const text = value?.trim()
  return text ? text : null
}

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

type PartnerReceiptVenue = {
  id: string
  name: string
  address: string
  city: string
  category: "CAFE" | "RESTAURANT" | "RETAIL" | "SERVICE" | "BEAUTY" | "FITNESS" | "YOGA" | "OTHER"
  pointsPerCurrency: number | null
  boostMultiplier: number | null
  boostUntil: Date | null
}

function comparableText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9а-я]+/g, " ")
    .trim()
}

function textMatchScore(left: string, right: string, weight: number): number {
  const a = comparableText(left)
  const b = comparableText(right)
  if (!a || !b) return 0
  return a === b ? weight * 2 : a.includes(b) || b.includes(a) ? weight : 0
}

function choosePartnerVenue<T extends PartnerReceiptVenue>(
  venues: T[],
  receipt: { vendorName: string; locationName: string; address: string; city: string },
): T | null {
  if (venues.length === 0) return null
  if (venues.length === 1) return venues[0]!

  let best = venues[0]!
  let bestScore = -1
  for (const venue of venues) {
    const score =
      textMatchScore(venue.name, receipt.locationName, 5) +
      textMatchScore(venue.name, receipt.vendorName, 3) +
      textMatchScore(venue.address, receipt.address, 4) +
      textMatchScore(venue.city, receipt.city, 1)
    if (score > bestScore) {
      best = venue
      bestScore = score
    }
  }
  return best
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
    earnedPoints: number
    totalPoints: number
    streak: StreakResult
    status: "VERIFIED" | "PENDING"
    record: {
      receiptHash?: string | null
      receiptNumber?: string | null
      receiptImageUrl?: string | null
      ocrRawData?: Prisma.InputJsonValue | null
      ocrConfidence?: number | null
      receiptDay?: string | null
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
        pointsEarned: params.earnedPoints,
        status: params.status,
        verifiedAt: params.status === "VERIFIED" ? new Date() : null,
        receiptHash:      params.record.receiptHash      ?? null,
        receiptNumber:    params.record.receiptNumber    ?? null,
        receiptDay:       params.record.receiptDay       ?? null,
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
  const u = await db.user.findUnique({ where: { id: userId }, select: { pushToken: true, language: true } })
  const lang = u?.language ?? "EN"
  const [title, body] = lang === "RU"
    ? ["🏅 Новый значок!", `Ты получил: ${newBadges.join(", ")}`]
    : lang === "SR"
    ? ["🏅 Nova značka!", `Zaradio si: ${newBadges.join(", ")}`]
    : ["🏅 New badge!", `You earned: ${newBadges.join(", ")}`]
  void sendPushToUser(u?.pushToken, title, body)
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
        scanToken: signReceiptScanToken({
          v: 1,
          userId: ctx.userId,
          imageUrl: input.imageUrl,
          vendor: ocrResult.data.vendor ?? null,
          total: ocrResult.data.total,
          currency: ocrResult.data.currency ?? null,
          date: ocrResult.data.date ?? null,
          receiptNumber: ocrResult.data.receiptNumber ?? null,
          receiptHash,
          confidence: ocrResult.confidence,
          rawData: ocrResult.data as Prisma.InputJsonValue,
          exp: Date.now() + RECEIPT_SCAN_TOKEN_TTL_MS,
        }),
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
        scanToken: z.string().min(20),
        imageUrl: z.string().url().optional(),
        vendor: z.string().min(1).max(200).optional(),
        amount: z.number().positive().optional(),
        currency: z.string().length(3).optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        time: z.string().optional(),
        receiptNumber: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const scan = readReceiptScanToken(input.scanToken)
      if (scan.userId !== ctx.userId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Receipt scan belongs to another user" })
      }
      const vendor = cleanOptionalText(input.vendor) ?? scan.vendor
      const amount = input.amount ?? scan.total
      const currency = cleanOptionalText(input.currency)?.toUpperCase() ?? scan.currency
      const date = cleanOptionalText(input.date) ?? scan.date
      const receiptNumber = cleanOptionalText(input.receiptNumber) ?? scan.receiptNumber
      const imageUrl = input.imageUrl ?? scan.imageUrl

      if (!vendor || amount === null || !currency || !date) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Receipt scan is incomplete. Please scan again." })
      }

      // 1. Date validation
      validateReceiptDate(date)

      // 1b. Per-vendor velocity (max 2 receipts/day per user per vendor)
      await checkVendorVelocity(ctx.userId, vendor)

      // 2. Compute from confirmed fields; user edits must affect dedup.
      const receiptHash = computeReceiptHash({
        vendor,
        total: amount,
        currency,
        date,
        receiptNumber,
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
        where: { name: { contains: vendor, mode: "insensitive" } },
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
      const needsManualReview = amount > RECEIPT_MANUAL_REVIEW_THRESHOLD
      const status = needsManualReview ? "PENDING" : "VERIFIED"
      const stepMult = stepMultiplier(user.stepsToday)
      const pointsEarned = needsManualReview
        ? 0
        : Math.floor(amount * SCAN_POINTS_PER_CURRENCY * stepMult)

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
        amount,
        currency,
        earnedPoints: pointsEarned,
        totalPoints,
        streak,
        status,
        record: {
          receiptHash,
          receiptNumber,
          receiptImageUrl: imageUrl,
          ocrRawData: {
            ...(typeof scan.rawData === "object" && scan.rawData !== null && !Array.isArray(scan.rawData) ? scan.rawData : {}),
            confirmed: { vendor, amount, currency, date, receiptNumber },
          },
          ocrConfidence: scan.confidence,
        },
      })

      await notifyBadges(ctx.db, ctx.userId, result.newBadges)
      await notifyPetEvolution(ctx.db, ctx.userId, totalPoints)

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
    .input(z.object({ qrUrl: z.string().min(10).max(4_000) }))
    .mutation(async ({ ctx, input }) => {
      // 1. Ask the official PURS verification endpoint for documented JSON.
      // Never trust locally decoded QR internals for awarding points.
      let receipt
      try {
        receipt = await fetchSerbiaReceipt(input.qrUrl)
        validateReceiptEligibility(
          receipt,
          new Date(),
          RECEIPT_MAX_AGE_HOURS,
          RECEIPT_MAX_AMOUNT_RSD,
        )
      } catch (e) {
        throw new TRPCError({
          code: e instanceof SerbiaReceiptError && e.kind === "UNAVAILABLE"
            ? "SERVICE_UNAVAILABLE"
            : "BAD_REQUEST",
          message: e instanceof Error ? e.message : "Invalid QR code",
        })
      }

      // 2. General anti-abuse limits.
      await checkReceiptScanLimits(ctx.userId)

      // 3. A fiscal receipt can be claimed once across the entire platform.
      const existingByNumber = await ctx.db.transaction.findFirst({
        where: { receiptNumber: receipt.receiptNumber },
        select: { id: true },
      })
      if (existingByNumber) {
        throw new TRPCError({ code: "CONFLICT", message: "This receipt has already been scanned." })
      }

      // 4. Match an active partner by normalized PIB. Among its branches, prefer
      // the venue whose name/address is closest to the fiscal location.
      const partnerMerchant = await ctx.db.merchant.findFirst({
        where: { taxIdNormalized: receipt.pib, status: "ACTIVE" },
        include: {
          venues: {
            where: { isPartner: true },
            select: {
              id: true,
              name: true,
              address: true,
              city: true,
              category: true,
              pointsPerCurrency: true,
              boostMultiplier: true,
              boostUntil: true,
            },
          },
        },
      })
      const partnerVenue = choosePartnerVenue(partnerMerchant?.venues ?? [], receipt)
      const isPartnerReceipt = partnerVenue !== null
      const category = partnerVenue?.category ?? null

      // Learn every verified issuer once. Unknown APR category stays null until
      // it is explicitly verified; partner categories are already trusted.
      await ctx.db.receiptIssuer.upsert({
        where: { taxId: receipt.pib },
        create: {
          taxId: receipt.pib,
          businessName: receipt.vendorName,
          lastLocationName: receipt.locationName || null,
          category,
          verifiedAt: isPartnerReceipt ? new Date() : null,
        },
        update: {
          businessName: receipt.vendorName,
          lastLocationName: receipt.locationName || null,
          ...(isPartnerReceipt ? { category, verifiedAt: new Date() } : {}),
        },
      })

      await checkVendorVelocity(ctx.userId, receipt.pib)

      // 5. Non-partner rewards are platform-funded and limited to one per
      // Belgrade calendar day. Partner receipts are not subject to this cap.
      const receiptDay = isPartnerReceipt
        ? null
        : receiptDayInBelgrade(new Date().toISOString())
      if (receiptDay) {
        const claimedToday = await ctx.db.transaction.findFirst({
          where: { userId: ctx.userId, receiptDay },
          select: { id: true },
        })
        if (claimedToday) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Only one non-partner receipt can earn points per day.",
          })
        }
      }

      // 6. Load user for streak bookkeeping.
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

      // 7. Partner rate never falls below the platform's 1% baseline. Receipt
      // rewards intentionally do not use the steps multiplier: 1% means 1%.
      const rawPoints = isPartnerReceipt && partnerVenue?.pointsPerCurrency
        ? calculatePartnerPoints(
            receipt.totalRsd,
            Math.max(partnerVenue.pointsPerCurrency, MIN_PARTNER_POINTS_PER_CURRENCY),
            partnerVenue.boostMultiplier,
            partnerVenue.boostUntil,
          )
        : receipt.totalRsd * SCAN_POINTS_PER_CURRENCY
      const pointsEarned = Math.max(1, Math.floor(rawPoints))

      const streak = computeStreakUpdate(user.currentStreak, user.longestStreak, user.lastCheckinAt)
      const totalPoints = pointsEarned + streak.milestoneBonus

      // 8. The unique receipt number and (for non-partners) user/day key make
      // concurrent duplicate claims fail atomically at the database layer.
      let result
      try {
        result = await runReceiptTx(ctx.db, {
          userId: ctx.userId,
          venueId: partnerVenue?.id ?? null,
          amount: receipt.totalRsd,
          currency: "RSD",
          earnedPoints: pointsEarned,
          totalPoints,
          streak,
          status: "VERIFIED",
          record: {
            receiptNumber: receipt.receiptNumber,
            receiptDay,
            ocrConfidence: 1.0,
            ocrRawData: {
              source: "serbia_purs_json",
              requestedBy: receipt.requestedBy,
              signedBy: receipt.signedBy,
              vendorName: receipt.vendorName,
              vendorPib: receipt.pib,
              locationName: receipt.locationName,
              category,
              verificationUrl: receipt.verificationUrl,
              isPartnerReceipt,
            },
          },
        })
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new TRPCError({ code: "CONFLICT", message: "This receipt has already been claimed." })
        }
        throw error
      }

      await notifyBadges(ctx.db, ctx.userId, result.newBadges)
      await notifyPetEvolution(ctx.db, ctx.userId, totalPoints)

      return {
        transactionId: result.transaction.id,
        pointsEarned: totalPoints,
        streakBonus: streak.milestoneBonus,
        newStreak: streak.currentStreak,
        newTotalPoints: result.updatedUser.earnedPoints + result.updatedUser.welcomePoints,
        status: "VERIFIED" as const,
        needsManualReview: false,
        vendorName: receipt.vendorName,
        vendorPib: receipt.pib,
        isPartnerReceipt,
        category,
        totalRsd: receipt.totalRsd,
        date: receipt.date,
        receiptNumber: receipt.receiptNumber,
        matchedVenue: partnerVenue?.id ?? null,
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
        idempotencyKey: z.string().min(8).max(120).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.idempotencyKey) {
        const existing = await ctx.db.transaction.findUnique({
          where: { merchantRequestId: input.idempotencyKey },
          select: {
            id: true,
            userId: true,
            venueId: true,
            amount: true,
            currency: true,
            pointsEarned: true,
            user: { select: { earnedPoints: true, welcomePoints: true, currentStreak: true } },
          },
        })
        if (existing) {
          if (
            existing.userId !== input.userId ||
            existing.venueId !== input.venueId ||
            existing.amount !== input.amount ||
            existing.currency !== input.currency
          ) {
            throw new TRPCError({ code: "CONFLICT", message: "Idempotency key was already used for another purchase" })
          }
          return {
            transactionId: existing.id,
            pointsEarned: existing.pointsEarned,
            streakBonus: 0,
            newStreak: existing.user.currentStreak,
            newTotalPoints: existing.user.earnedPoints + existing.user.welcomePoints,
            referralRewarded: false,
            newBadges: [],
          }
        }
      }

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

      // Мерчант финансирует конвертацию покупки (pointsEarned). Платформенные
      // бонусы (стрик, реферал) с баланса мерчанта не списываются.
      // Проверяем баланс/кредит (может бросить CREDIT_REQUIRED для согласия).
      await assertMerchantCanAward(ctx.db, ctx.merchantId, pointsEarned)

      // 4. DB transaction: award points + update streak
      const result = await ctx.db.$transaction(async (tx) => {
        const transaction = await tx.transaction.create({
          data: {
            userId: input.userId,
            venueId: input.venueId,
            type: "PARTNER_PURCHASE",
            amount: input.amount,
            currency: input.currency,
            pointsEarned,
            merchantRequestId: input.idempotencyKey ?? null,
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

        // Списываем сконвертированные баллы с баланса мерчанта
        await tx.merchant.update({
          where: { id: ctx.merchantId },
          data: { pointsBalance: { decrement: pointsEarned } },
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
      await notifyPetEvolution(ctx.db, input.userId, totalPoints)

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

  /**
   * Kept for client compatibility, but manual data cannot prove validity, date,
   * buyer type, seller PIB, or amount. It must never award automatic points.
   */
  submitFiscalNumber: protectedProcedure
    .input(z.object({
      fiscalNumber: z.string()
        .min(5)
        .max(60)
        .regex(/^[A-Z0-9]{1,20}-[A-Z0-9]{1,20}-\d{1,10}$/i, "Format: XXXXXXXX-XXXXXXXX-12345"),
      amountRsd: z.number().positive(),
    }))
    .mutation(() => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Manual receipt entry cannot earn points. Please scan the fiscal QR code.",
      })
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

  /** Merchant accepts loyalty points from a customer (customer pays with points). */
  spendPoints: merchantProcedure
    .input(z.object({
      userId:  z.string(),
      venueId: z.string(),
      points:  z.number().int().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const venue = await ctx.db.venue.findFirst({
        where: { id: input.venueId, ownerId: ctx.merchantId },
        select: { id: true },
      })
      if (!venue) throw new TRPCError({ code: "FORBIDDEN", message: "Venue not found" })

      const user = await ctx.db.user.findUnique({
        where: { id: input.userId },
        select: { id: true, earnedPoints: true },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" })

      if (user.earnedPoints < input.points) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Недостаточно баллов. Доступно: ${user.earnedPoints}`,
        })
      }

      await ctx.db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: input.userId },
          data: {
            earnedPoints: { decrement: input.points },
            spentPoints:  { increment: input.points },
          },
        })
        await tx.merchant.update({
          where: { id: ctx.merchantId },
          data: { pointsBalance: { increment: input.points } },
        })
        await tx.transaction.create({
          data: {
            userId:      input.userId,
            venueId:     input.venueId,
            type:        "REWARD_REDEEMED",
            pointsEarned: -input.points,
            status:      "VERIFIED",
            verifiedAt:  new Date(),
          },
        })
      })

      return {
        pointsSpent:     input.points,
        newEarnedPoints: user.earnedPoints - input.points,
      }
    }),
})
