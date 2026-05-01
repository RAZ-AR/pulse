import { fetchRequestHandler } from "@trpc/server/adapters/fetch"
import { appRouter } from "@pulse/trpc/server"
import type { TRPCContext } from "@pulse/trpc"
import { db } from "@pulse/db"
import { auth } from "@pulse/auth/user"
import { merchantAuth } from "@pulse/auth/merchant"

async function createContext(req: Request): Promise<TRPCContext> {
  const [session, merchantSession] = await Promise.all([
    auth(),
    merchantAuth(),
  ])

  return {
    db,
    userId: session?.user?.id,
    merchantId: (merchantSession as { merchant?: { id: string } } | null)?.merchant?.id,
  }
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createContext(req),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => console.error(`tRPC error on ${path}:`, error)
        : undefined,
  })

export { handler as GET, handler as POST }
