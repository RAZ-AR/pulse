import { initTRPC, TRPCError } from "@trpc/server"
import superjson from "superjson"
import { ZodError } from "zod"
import type { db } from "@pulse/db"

export type TRPCContext = {
  db: typeof db
  userId?: string
  merchantId?: string
  // Staff fields — set when request comes from a staff JWT
  staffId?: string
  staffVenueId?: string       // the venue this staff member belongs to
  staffMerchantId?: string    // the merchant who owns that venue
}

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } })
})

export const merchantProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.merchantId) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({ ctx: { ...ctx, merchantId: ctx.merchantId } })
})

/**
 * Accepts both owner (merchantId) and staff (staffId).
 * Used for QR scan operations: resolveCustomer, redeemPoints, reward.validate.
 */
export const scanProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.merchantId && !ctx.staffId) {
    throw new TRPCError({ code: "UNAUTHORIZED" })
  }
  return next({ ctx })
})
