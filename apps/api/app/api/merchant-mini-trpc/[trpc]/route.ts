/**
 * tRPC handler for the Merchant + Staff Mini Apps.
 * Authenticates via Bearer JWT (issued by /api/merchant-tg-auth or /api/staff-tg-auth).
 * Reuses the same appRouter:
 *   - merchantProcedure checks ctx.merchantId
 *   - scanProcedure checks ctx.merchantId || ctx.staffId
 */
import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "@pulse/trpc/server"
import type { TRPCContext } from "@pulse/trpc"
import { db } from "@pulse/db"
import { jwtVerify } from "jose"

const JWT_SECRET = new TextEncoder().encode(
  process.env.MERCHANT_AUTH_SECRET ?? "fallback-secret-change-me",
)

async function createContext(req: Request): Promise<TRPCContext> {
  const auth = req.headers.get("Authorization")
  if (!auth?.startsWith("Bearer ")) return { db }

  try {
    const { payload } = await jwtVerify(auth.slice(7), JWT_SECRET)

    // Staff JWT: { staffId, venueId, merchantId, role: "staff" }
    if (payload.role === "staff") {
      const staffId = payload.staffId as string | undefined
      if (!staffId) return { db }
      return {
        db,
        staffId,
        ...(payload.venueId ? { staffVenueId: payload.venueId as string } : {}),
        ...(payload.merchantId ? { staffMerchantId: payload.merchantId as string } : {}),
      }
    }

    // Merchant JWT: { merchantId }
    const merchantId = payload.merchantId as string | undefined
    if (!merchantId) return { db }
    return { db, merchantId }
  } catch {
    return { db }
  }
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/merchant-mini-trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError: ({ path, error }) => {
      if (process.env.NODE_ENV === "development") {
        console.error(`[merchant-mini-trpc] ${path}:`, error.message)
      }
    },
  })

export { handler as GET, handler as POST }
