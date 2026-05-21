/**
 * tRPC handler for the Merchant Mini App.
 * Authenticates via Bearer JWT (issued by /api/merchant-tg-auth).
 * Reuses the same appRouter — merchantProcedure checks ctx.merchantId.
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
