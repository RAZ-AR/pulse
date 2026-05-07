import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "@pulse/trpc/server"
import type { TRPCContext } from "@pulse/trpc"
import { db } from "@pulse/db"
import { auth } from "@pulse/auth/user"
import { merchantAuth } from "@pulse/auth/merchant"
import { verifyMobileToken } from "@pulse/auth/mobile-jwt"

async function resolveUserId(req: Request): Promise<string | undefined> {
  // 1. Mobile clients send `Authorization: Bearer <jwt>` — verify with shared AUTH_SECRET
  const authz = req.headers.get("authorization")
  if (authz?.startsWith("Bearer ")) {
    const token = authz.slice("Bearer ".length).trim()
    const payload = await verifyMobileToken(token)
    if (payload) return payload.userId
  }

  // 2. Web (apps/api) — NextAuth cookie session
  const session = await auth()
  return session?.user?.id
}

async function createContext(req: Request): Promise<TRPCContext> {
  const [userId, merchantSession] = await Promise.all([
    resolveUserId(req),
    merchantAuth(),
  ])
  const merchantId = (merchantSession as { merchant?: { id: string } } | null)?.merchant?.id

  return {
    db,
    ...(userId !== undefined && { userId }),
    ...(merchantId !== undefined && { merchantId }),
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type,authorization,trpc-accept",
}

function withCors(response: Response): Response {
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value)
  }
  return response
}

const handler = async (req: Request) =>
  withCors(await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: ({ path, error }: { path: string | undefined; error: any }) => {
      if (process.env.NODE_ENV === "development") {
        console.error(`tRPC error on ${path}:`, error)
      }
    },
  }))

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders })
}

export { handler as GET, handler as POST }
