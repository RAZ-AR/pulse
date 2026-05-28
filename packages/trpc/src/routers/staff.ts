import { z } from "zod"
import { TRPCError } from "@trpc/server"
import { router, merchantProcedure, scanProcedure } from "../trpc"

const INVITE_TTL_DAYS = 7

export const staffRouter = router({
  /**
   * Owner creates an invite link for a staff member.
   * Staff opens `t.me/PartnerBot?start=staff_<token>` to register.
   */
  createInvite: merchantProcedure
    .input(z.object({ venueId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Verify venue belongs to this merchant
      const venue = await ctx.db.venue.findFirst({
        where: { id: input.venueId, ownerId: ctx.merchantId },
        select: { id: true, name: true },
      })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" })

      const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000)
      const invite = await ctx.db.staffInvite.create({
        data: {
          venueId: input.venueId,
          merchantId: ctx.merchantId,
          expiresAt,
        },
        select: { token: true, expiresAt: true },
      })

      const botUsername = process.env.PARTNER_BOT_USERNAME ?? "ayoo_partner_bot"
      return {
        token: invite.token,
        expiresAt: invite.expiresAt,
        inviteUrl: `https://t.me/${botUsername}?start=staff_${invite.token}`,
        venueName: venue.name,
      }
    }),

  /**
   * List active staff for a venue. Owner only.
   */
  list: merchantProcedure
    .input(z.object({ venueId: z.string() }))
    .query(async ({ ctx, input }) => {
      const venue = await ctx.db.venue.findFirst({
        where: { id: input.venueId, ownerId: ctx.merchantId },
        select: { id: true },
      })
      if (!venue) throw new TRPCError({ code: "NOT_FOUND", message: "Venue not found" })

      return ctx.db.staffMember.findMany({
        where: { venueId: input.venueId, isActive: true },
        select: { id: true, name: true, telegramChatId: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      })
    }),

  /**
   * Revoke staff access. Owner only.
   */
  revoke: merchantProcedure
    .input(z.object({ staffId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const staff = await ctx.db.staffMember.findFirst({
        where: { id: input.staffId, merchantId: ctx.merchantId },
        select: { id: true },
      })
      if (!staff) throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found" })

      await ctx.db.staffMember.update({
        where: { id: input.staffId },
        data: { isActive: false },
      })
      return { ok: true }
    }),

  /**
   * Staff gets their own profile — venue name + merchant name.
   * Used by the Staff Mini App on load.
   */
  me: scanProcedure.query(async ({ ctx }) => {
    if (!ctx.staffId) throw new TRPCError({ code: "UNAUTHORIZED" })

    const staff = await ctx.db.staffMember.findUnique({
      where: { id: ctx.staffId },
      select: {
        id: true,
        name: true,
        isActive: true,
        venue: { select: { id: true, name: true, city: true } },
        merchant: { select: { id: true, name: true } },
      },
    })
    if (!staff || !staff.isActive) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Staff access revoked" })
    }
    return staff
  }),
})
