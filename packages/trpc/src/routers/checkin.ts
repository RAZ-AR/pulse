import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, protectedProcedure } from "../trpc"
import { verifyCheckinPhoto } from "../services/checkin-verify"
import { trackVisit, trackStreak } from "../services/challenge-progress"
import { checkAndAwardBadges } from "../services/badges"
import {
  haversineMeters,
  CHECKIN_POINTS,
  CHECKIN_RADIUS_METERS,
  CHECKIN_ACCURACY_THRESHOLD,
  computeStreakUpdate,
} from "@pulse/shared"

const CHECKIN_COOLDOWN_HOURS = 12 // same venue, same user

export const checkinRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        venueId: z.string(),
        photoUrl: z.string().url(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        accuracyMeters: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Load venue
      const venue = await ctx.db.venue.findUnique({
        where: { id: input.venueId },
        select: { id: true, lat: true, lng: true, name: true },
      })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" })

      // 2. GPS accuracy guard
      if (input.accuracyMeters !== undefined && input.accuracyMeters > CHECKIN_ACCURACY_THRESHOLD) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "GPS signal too weak for check-in. Move to an open area and try again.",
        })
      }

      // 3. Distance check
      const distanceMeters = haversineMeters(input.lat, input.lng, venue.lat, venue.lng)
      if (distanceMeters > CHECKIN_RADIUS_METERS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `You must be within ${CHECKIN_RADIUS_METERS}m of the venue (currently ${Math.round(distanceMeters)}m away)`,
        })
      }

      // 4. Cooldown: same venue, same user — once per 12h
      const cooldownCutoff = new Date(Date.now() - CHECKIN_COOLDOWN_HOURS * 3_600_000)
      const recentCheckin = await ctx.db.checkin.findFirst({
        where: {
          userId: ctx.userId,
          venueId: input.venueId,
          createdAt: { gte: cooldownCutoff },
        },
        select: { id: true },
      })
      if (recentCheckin) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: `Already checked in here recently. Try again in ${CHECKIN_COOLDOWN_HOURS}h.`,
        })
      }

      // 5. AI photo verification
      let verification: { isValid: boolean; confidence: number; reason: string }
      try {
        verification = await verifyCheckinPhoto(input.photoUrl)
      } catch {
        verification = { isValid: true, confidence: 0.5, reason: "verification_error" }
      }

      // Hard reject only on high-confidence fake
      if (!verification.isValid && verification.confidence > 0.85) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Photo does not appear to be taken at a physical venue.",
        })
      }

      // 6. Points + streak
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { currentStreak: true, longestStreak: true, lastCheckinAt: true },
      })
      if (!user) throw new TRPCError({ code: "NOT_FOUND" })

      const streak = computeStreakUpdate(user.currentStreak, user.longestStreak, user.lastCheckinAt)
      const totalPoints = CHECKIN_POINTS + streak.milestoneBonus

      // 7. DB transaction
      const result = await ctx.db.$transaction(async (tx) => {
        const checkin = await tx.checkin.create({
          data: {
            userId: ctx.userId,
            venueId: input.venueId,
            photoUrl: input.photoUrl,
            lat: input.lat,
            lng: input.lng,
            distanceFromVenue: distanceMeters,
            aiVerification: verification,
            status: "VERIFIED",
            pointsEarned: totalPoints,
          },
        })

        await tx.transaction.create({
          data: {
            userId: ctx.userId,
            venueId: input.venueId,
            type: "CHECKIN_PHOTO",
            pointsEarned: totalPoints,
            status: "VERIFIED",
            verifiedAt: new Date(),
          },
        })

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

        // Challenge progress
        await trackVisit(tx, ctx.userId)
        await trackStreak(tx, ctx.userId, streak.currentStreak)

        // Badge check (after stats are committed in same tx)
        const newBadges = await checkAndAwardBadges(tx, ctx.userId)

        return { checkin, updatedUser, newBadges }
      })

      return {
        checkinId: result.checkin.id,
        pointsEarned: totalPoints,
        streakBonus: streak.milestoneBonus,
        newStreak: streak.currentStreak,
        newTotalPoints: result.updatedUser.earnedPoints + result.updatedUser.welcomePoints,
        distanceMeters: Math.round(distanceMeters),
        newBadges: result.newBadges,
      }
    }),

  history: protectedProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const checkins = await ctx.db.checkin.findMany({
        where: { userId: ctx.userId },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor } } : {}),
        orderBy: { createdAt: "desc" },
        include: { venue: { select: { id: true, name: true } } },
      })
      let nextCursor: string | undefined
      if (checkins.length > input.limit) {
        nextCursor = checkins.pop()!.id
      }
      return { checkins, nextCursor }
    }),
})
